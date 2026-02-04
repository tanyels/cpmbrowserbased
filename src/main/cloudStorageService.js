const fs = require('fs');
const path = require('path');
const { cloudKeyService } = require('./cloudKeyService');
const { SUPABASE_CONFIG } = require('./supabaseConfig');

class CloudStorageService {
  get supabase() {
    return cloudKeyService.getClient();
  }

  // Generate unique storage path: key_id/filename_timestamp.cpme
  generateStoragePath(keyId, filename) {
    const timestamp = Date.now();
    const baseName = path.basename(filename, '.cpme');
    const safeName = baseName.replace(/[^a-zA-Z0-9_.-]/g, '_');
    return `${keyId}/${safeName}_${timestamp}.cpme`;
  }

  async uploadFile(localPath, displayName) {
    if (!this.supabase) throw new Error('Cloud service not configured');

    // Verify file is .cpme (encrypted)
    if (!localPath.endsWith('.cpme')) {
      throw new Error('Only encrypted .cpme files can be uploaded to cloud');
    }

    // Get current key
    const keyId = cloudKeyService.getCurrentKeyId();
    const keyData = cloudKeyService.getCurrentKeyData();
    if (!keyId || !keyData) {
      throw new Error('No valid access key. Please enter your access key first.');
    }

    // Check quota
    const fileBuffer = fs.readFileSync(localPath);
    const fileSize = fileBuffer.length;
    const usedBytes = keyData.used_bytes || 0;
    const quotaBytes = keyData.quota_bytes || 26214400;

    if (usedBytes + fileSize > quotaBytes) {
      const usedMB = (usedBytes / 1024 / 1024).toFixed(1);
      const quotaMB = (quotaBytes / 1024 / 1024).toFixed(1);
      const fileMB = (fileSize / 1024 / 1024).toFixed(1);
      throw new Error(`Storage quota exceeded. Used: ${usedMB}MB / ${quotaMB}MB. File size: ${fileMB}MB`);
    }

    // Generate storage path
    const storagePath = this.generateStoragePath(keyId, displayName || path.basename(localPath));

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await this.supabase.storage
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
    const { data: metaData, error: metaError } = await this.supabase
      .from('cloud_files')
      .insert({
        key_id: keyId,
        storage_path: storagePath,
        display_name: displayName || path.basename(localPath, '.cpme'),
        original_filename: path.basename(localPath),
        file_size: fileSize
      })
      .select()
      .single();

    if (metaError) {
      // Rollback: delete uploaded file if metadata insert fails
      await this.supabase.storage
        .from(SUPABASE_CONFIG.storageBucket)
        .remove([storagePath]);
      throw metaError;
    }

    // Update used bytes
    await cloudKeyService.updateUsedBytes(fileSize);

    return metaData;
  }

  async downloadFile(storagePath, localDestination) {
    if (!this.supabase) throw new Error('Cloud service not configured');

    const keyId = cloudKeyService.getCurrentKeyId();
    if (!keyId) {
      throw new Error('No valid access key. Please enter your access key first.');
    }

    // Download from Supabase Storage
    const { data, error } = await this.supabase.storage
      .from(SUPABASE_CONFIG.storageBucket)
      .download(storagePath);

    if (error) {
      if (error.message.includes('not found')) {
        throw new Error('File not found in cloud storage');
      }
      throw error;
    }

    // Convert Blob to Buffer and write to local file
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Ensure directory exists
    const dir = path.dirname(localDestination);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(localDestination, buffer);

    return localDestination;
  }

  async listFiles() {
    if (!this.supabase) throw new Error('Cloud service not configured');

    const keyId = cloudKeyService.getCurrentKeyId();
    if (!keyId) {
      throw new Error('No valid access key. Please enter your access key first.');
    }

    const { data, error } = await this.supabase
      .from('cloud_files')
      .select('*')
      .eq('key_id', keyId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async deleteFile(storagePath) {
    if (!this.supabase) throw new Error('Cloud service not configured');

    const keyId = cloudKeyService.getCurrentKeyId();
    if (!keyId) {
      throw new Error('No valid access key. Please enter your access key first.');
    }

    // Get file size before deleting (for quota update)
    const { data: fileData } = await this.supabase
      .from('cloud_files')
      .select('file_size')
      .eq('storage_path', storagePath)
      .eq('key_id', keyId)
      .single();

    // Delete from storage
    const { error: storageError } = await this.supabase.storage
      .from(SUPABASE_CONFIG.storageBucket)
      .remove([storagePath]);

    if (storageError) throw storageError;

    // Delete metadata
    const { error: metaError } = await this.supabase
      .from('cloud_files')
      .delete()
      .eq('storage_path', storagePath)
      .eq('key_id', keyId);

    if (metaError) throw metaError;

    // Update used bytes (subtract file size)
    if (fileData?.file_size) {
      await cloudKeyService.updateUsedBytes(-fileData.file_size);
    }

    return true;
  }

  async renameFile(storagePath, newDisplayName) {
    if (!this.supabase) throw new Error('Cloud service not configured');

    const keyId = cloudKeyService.getCurrentKeyId();
    if (!keyId) {
      throw new Error('No valid access key. Please enter your access key first.');
    }

    const { data, error } = await this.supabase
      .from('cloud_files')
      .update({ display_name: newDisplayName })
      .eq('storage_path', storagePath)
      .eq('key_id', keyId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateFile(localPath, storagePath) {
    if (!this.supabase) throw new Error('Cloud service not configured');

    // Verify file is .cpme (encrypted)
    if (!localPath.endsWith('.cpme')) {
      throw new Error('Only encrypted .cpme files can be uploaded to cloud');
    }

    const keyId = cloudKeyService.getCurrentKeyId();
    const keyData = cloudKeyService.getCurrentKeyData();
    if (!keyId || !keyData) {
      throw new Error('No valid access key. Please enter your access key first.');
    }

    // Get old file size for quota adjustment
    const { data: oldFileData } = await this.supabase
      .from('cloud_files')
      .select('file_size')
      .eq('storage_path', storagePath)
      .eq('key_id', keyId)
      .single();

    const oldFileSize = oldFileData?.file_size || 0;

    // Read new file
    const fileBuffer = fs.readFileSync(localPath);
    const newFileSize = fileBuffer.length;

    // Check quota (accounting for the file being replaced)
    const usedBytes = keyData.used_bytes || 0;
    const quotaBytes = keyData.quota_bytes || 26214400;
    const netChange = newFileSize - oldFileSize;

    if (usedBytes + netChange > quotaBytes) {
      const usedMB = (usedBytes / 1024 / 1024).toFixed(1);
      const quotaMB = (quotaBytes / 1024 / 1024).toFixed(1);
      const fileMB = (newFileSize / 1024 / 1024).toFixed(1);
      throw new Error(`Storage quota exceeded. Used: ${usedMB}MB / ${quotaMB}MB. File size: ${fileMB}MB`);
    }

    // Upload to Supabase Storage (upsert to replace existing)
    const { error: uploadError } = await this.supabase.storage
      .from(SUPABASE_CONFIG.storageBucket)
      .update(storagePath, fileBuffer, {
        contentType: 'application/octet-stream',
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // Update metadata
    const { data: metaData, error: metaError } = await this.supabase
      .from('cloud_files')
      .update({
        file_size: newFileSize,
        uploaded_at: new Date().toISOString()
      })
      .eq('storage_path', storagePath)
      .eq('key_id', keyId)
      .select()
      .single();

    if (metaError) {
      throw metaError;
    }

    // Update used bytes (net change)
    if (netChange !== 0) {
      await cloudKeyService.updateUsedBytes(netChange);
    }

    return metaData;
  }
}

const cloudStorageService = new CloudStorageService();

module.exports = { cloudStorageService };
