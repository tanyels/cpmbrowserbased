// Browser-compatible Cloud Storage Service
import { supabase, SUPABASE_CONFIG } from './supabaseClient';
import { cloudKeyService } from './cloudKeyService';

class CloudStorageService {
  generateStoragePath(keyId, filename) {
    const timestamp = Date.now();
    const baseName = filename.replace(/\.cpme$/, '');
    const safeName = baseName.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return `${keyId}/${safeName}_${timestamp}.cpme`;
  }

  async uploadFile(fileBuffer, displayName) {
    const keyId = cloudKeyService.getCurrentKeyId();
    const keyData = cloudKeyService.getCurrentKeyData();

    if (!keyId || !keyData) {
      throw new Error('No valid access key. Please enter your access key first.');
    }

    // Check quota
    const fileSize = fileBuffer.byteLength;
    const usedBytes = keyData.used_bytes || 0;
    const quotaBytes = keyData.quota_bytes || 26214400;

    if (usedBytes + fileSize > quotaBytes) {
      const usedMB = (usedBytes / 1024 / 1024).toFixed(1);
      const quotaMB = (quotaBytes / 1024 / 1024).toFixed(1);
      const fileMB = (fileSize / 1024 / 1024).toFixed(1);
      throw new Error(`Storage quota exceeded. Used: ${usedMB}MB / ${quotaMB}MB. File size: ${fileMB}MB`);
    }

    // Generate storage path
    const storagePath = this.generateStoragePath(keyId, displayName);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(SUPABASE_CONFIG.storageBucket)
      .upload(storagePath, fileBuffer, {
        contentType: 'application/octet-stream',
        upsert: false
      });

    if (uploadError) {
      if (uploadError.message.includes('already exists')) {
        throw new Error('A file with this name already exists');
      }
      throw uploadError;
    }

    // Store metadata in database
    const { data: metaData, error: metaError } = await supabase
      .from('cloud_files')
      .insert({
        key_id: keyId,
        storage_path: storagePath,
        display_name: displayName.replace(/\.cpme$/, ''),
        original_filename: displayName,
        file_size: fileSize
      })
      .select()
      .single();

    if (metaError) {
      // Rollback: delete uploaded file
      await supabase.storage
        .from(SUPABASE_CONFIG.storageBucket)
        .remove([storagePath]);
      throw metaError;
    }

    // Update used bytes
    await cloudKeyService.updateUsedBytes(fileSize);

    return metaData;
  }

  async downloadFile(storagePath) {
    const keyId = cloudKeyService.getCurrentKeyId();
    if (!keyId) {
      throw new Error('No valid access key. Please enter your access key first.');
    }

    const { data, error } = await supabase.storage
      .from(SUPABASE_CONFIG.storageBucket)
      .download(storagePath);

    if (error) {
      if (error.message.includes('not found')) {
        throw new Error('File not found in cloud storage');
      }
      throw error;
    }

    // Return as ArrayBuffer
    return await data.arrayBuffer();
  }

  async listFiles() {
    const keyId = cloudKeyService.getCurrentKeyId();
    if (!keyId) {
      throw new Error('No valid access key. Please enter your access key first.');
    }

    const { data, error } = await supabase
      .from('cloud_files')
      .select('*')
      .eq('key_id', keyId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async deleteFile(storagePath) {
    const keyId = cloudKeyService.getCurrentKeyId();
    if (!keyId) {
      throw new Error('No valid access key. Please enter your access key first.');
    }

    // Get file size before deleting
    const { data: fileData } = await supabase
      .from('cloud_files')
      .select('file_size')
      .eq('storage_path', storagePath)
      .eq('key_id', keyId)
      .single();

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(SUPABASE_CONFIG.storageBucket)
      .remove([storagePath]);

    if (storageError) throw storageError;

    // Delete metadata
    const { error: metaError } = await supabase
      .from('cloud_files')
      .delete()
      .eq('storage_path', storagePath)
      .eq('key_id', keyId);

    if (metaError) throw metaError;

    // Update used bytes
    if (fileData?.file_size) {
      await cloudKeyService.updateUsedBytes(-fileData.file_size);
    }

    return true;
  }

  async renameFile(storagePath, newDisplayName) {
    const keyId = cloudKeyService.getCurrentKeyId();
    if (!keyId) {
      throw new Error('No valid access key. Please enter your access key first.');
    }

    const { data, error } = await supabase
      .from('cloud_files')
      .update({ display_name: newDisplayName })
      .eq('storage_path', storagePath)
      .eq('key_id', keyId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateFile(fileBuffer, storagePath) {
    const keyId = cloudKeyService.getCurrentKeyId();
    const keyData = cloudKeyService.getCurrentKeyData();

    if (!keyId || !keyData) {
      throw new Error('No valid access key. Please enter your access key first.');
    }

    // Get old file size for quota adjustment
    const { data: oldFileData } = await supabase
      .from('cloud_files')
      .select('file_size')
      .eq('storage_path', storagePath)
      .eq('key_id', keyId)
      .single();

    const oldFileSize = oldFileData?.file_size || 0;
    const newFileSize = fileBuffer.byteLength;

    // Check quota
    const usedBytes = keyData.used_bytes || 0;
    const quotaBytes = keyData.quota_bytes || 26214400;
    const netChange = newFileSize - oldFileSize;

    if (usedBytes + netChange > quotaBytes) {
      const usedMB = (usedBytes / 1024 / 1024).toFixed(1);
      const quotaMB = (quotaBytes / 1024 / 1024).toFixed(1);
      const fileMB = (newFileSize / 1024 / 1024).toFixed(1);
      throw new Error(`Storage quota exceeded. Used: ${usedMB}MB / ${quotaMB}MB. File size: ${fileMB}MB`);
    }

    // Upload to Supabase Storage (update)
    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_CONFIG.storageBucket)
      .update(storagePath, fileBuffer, {
        contentType: 'application/octet-stream',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Update metadata
    const { data: metaData, error: metaError } = await supabase
      .from('cloud_files')
      .update({
        file_size: newFileSize,
        uploaded_at: new Date().toISOString()
      })
      .eq('storage_path', storagePath)
      .eq('key_id', keyId)
      .select()
      .single();

    if (metaError) throw metaError;

    // Update used bytes
    if (netChange !== 0) {
      await cloudKeyService.updateUsedBytes(netChange);
    }

    return metaData;
  }
}

export const cloudStorageService = new CloudStorageService();
