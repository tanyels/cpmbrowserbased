// Browser Storage Service - for browser-based app only
import { supabase } from './supabaseClient';
import { browserKeyService } from './browserKeyService';

const STORAGE_BUCKET = 'cpm-browser-storage';

class BrowserStorageService {
  generateStoragePath(keyId, filename) {
    const timestamp = Date.now();
    const baseName = filename.replace(/\.cpme$/, '');
    const safeName = baseName.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return `${keyId}/${safeName}_${timestamp}.cpme`;
  }

  async uploadFile(fileBuffer, displayName) {
    const keyId = browserKeyService.getCurrentKeyId();
    const keyData = browserKeyService.getCurrentKeyData();

    if (!keyId || !keyData) {
      throw new Error('No valid access key. Please enter your access key first.');
    }

    // Check quota
    const fileSize = fileBuffer.byteLength;
    const usedBytes = keyData.used_bytes || 0;
    const quotaBytes = keyData.quota_bytes || 104857600; // 100MB default

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
      .from(STORAGE_BUCKET)
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
      .from('browser_cloud_files')
      .insert({
        key_id: keyId,
        storage_path: storagePath,
        display_name: displayName.replace(/\.cpme$/, ''),
        file_size: fileSize
      })
      .select()
      .single();

    if (metaError) {
      // Rollback: delete uploaded file
      await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([storagePath]);
      throw metaError;
    }

    // Update used bytes
    await browserKeyService.updateUsedBytes(fileSize);

    return metaData;
  }

  async downloadFile(storagePath) {
    const keyId = browserKeyService.getCurrentKeyId();
    if (!keyId) {
      throw new Error('No valid access key. Please enter your access key first.');
    }

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
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
    const keyId = browserKeyService.getCurrentKeyId();
    if (!keyId) {
      throw new Error('No valid access key. Please enter your access key first.');
    }

    const { data, error } = await supabase
      .from('browser_cloud_files')
      .select('*')
      .eq('key_id', keyId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async deleteFile(storagePath) {
    const keyId = browserKeyService.getCurrentKeyId();
    if (!keyId) {
      throw new Error('No valid access key. Please enter your access key first.');
    }

    // Get file size before deleting
    const { data: fileData } = await supabase
      .from('browser_cloud_files')
      .select('file_size')
      .eq('storage_path', storagePath)
      .eq('key_id', keyId)
      .single();

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath]);

    if (storageError) throw storageError;

    // Delete metadata
    const { error: metaError } = await supabase
      .from('browser_cloud_files')
      .delete()
      .eq('storage_path', storagePath)
      .eq('key_id', keyId);

    if (metaError) throw metaError;

    // Update used bytes
    if (fileData?.file_size) {
      await browserKeyService.updateUsedBytes(-fileData.file_size);
    }

    return true;
  }

  async renameFile(storagePath, newDisplayName) {
    const keyId = browserKeyService.getCurrentKeyId();
    if (!keyId) {
      throw new Error('No valid access key. Please enter your access key first.');
    }

    const { data, error } = await supabase
      .from('browser_cloud_files')
      .update({ display_name: newDisplayName })
      .eq('storage_path', storagePath)
      .eq('key_id', keyId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateFile(fileBuffer, storagePath) {
    console.log('=== UPDATE FILE ===');
    console.log('storagePath:', storagePath);
    console.log('fileBuffer size:', fileBuffer?.byteLength);

    const keyId = browserKeyService.getCurrentKeyId();
    const keyData = browserKeyService.getCurrentKeyData();

    console.log('keyId:', keyId);

    if (!keyId || !keyData) {
      throw new Error('No valid access key. Please enter your access key first.');
    }

    // Get old file size for quota adjustment
    const { data: oldFileData } = await supabase
      .from('browser_cloud_files')
      .select('file_size')
      .eq('storage_path', storagePath)
      .eq('key_id', keyId)
      .single();

    const oldFileSize = oldFileData?.file_size || 0;
    const newFileSize = fileBuffer.byteLength;

    // Check quota
    const usedBytes = keyData.used_bytes || 0;
    const quotaBytes = keyData.quota_bytes || 104857600;
    const netChange = newFileSize - oldFileSize;

    if (usedBytes + netChange > quotaBytes) {
      const usedMB = (usedBytes / 1024 / 1024).toFixed(1);
      const quotaMB = (quotaBytes / 1024 / 1024).toFixed(1);
      const fileMB = (newFileSize / 1024 / 1024).toFixed(1);
      throw new Error(`Storage quota exceeded. Used: ${usedMB}MB / ${quotaMB}MB. File size: ${fileMB}MB`);
    }

    // Upload to Supabase Storage (upsert to replace existing file)
    console.log('Uploading to Supabase storage...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: 'application/octet-stream',
        upsert: true  // This will overwrite if exists
      });

    console.log('Upload result:', { uploadData, uploadError });
    if (uploadError) throw uploadError;

    // Update metadata
    const { data: metaData, error: metaError } = await supabase
      .from('browser_cloud_files')
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
      await browserKeyService.updateUsedBytes(netChange);
    }

    return metaData;
  }
}

export const browserStorageService = new BrowserStorageService();
