const { createClient } = require('@supabase/supabase-js');
const Store = require('electron-store');
const crypto = require('crypto');
const { SUPABASE_CONFIG } = require('./supabaseConfig');

// Store for saving the active key locally
const cloudStore = new Store({
  name: 'cpm-cloud-key',
  encryptionKey: 'cpm-cloud-key-2024'
});

class CloudKeyService {
  constructor() {
    this.supabase = null;
    this.currentKey = null;
    this.currentKeyData = null;
    this._initClient();
  }

  _initClient() {
    if (SUPABASE_CONFIG.url === 'YOUR_SUPABASE_URL') {
      console.warn('Supabase not configured. Cloud features will be disabled.');
      return;
    }

    this.supabase = createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.anonKey
    );

    // Try to restore saved key
    const savedKey = cloudStore.get('activeKey');
    if (savedKey) {
      this.currentKey = savedKey;
      this._validateAndLoadKey(savedKey).catch(() => {
        // Key no longer valid, clear it
        this.clearKey();
      });
    }
  }

  isConfigured() {
    return this.supabase !== null;
  }

  hashKey(plainKey) {
    return crypto.createHash('sha256').update(plainKey).digest('hex');
  }

  async _validateAndLoadKey(plainKey) {
    if (!this.supabase) throw new Error('Cloud service not configured');

    const keyHash = this.hashKey(plainKey.toLowerCase().trim());

    const { data, error } = await this.supabase
      .from('cloud_access_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .single();

    if (error || !data) {
      throw new Error('Invalid access key');
    }

    if (!data.is_active) {
      throw new Error('This access key has been deactivated');
    }

    // Check if expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      throw new Error('This access key has expired');
    }

    this.currentKeyData = data;
    return data;
  }

  async validateKey(plainKey) {
    const keyData = await this._validateAndLoadKey(plainKey);

    // If not yet activated, activate it now
    if (!keyData.activated_at) {
      const activatedAt = new Date();
      const expiresAt = new Date(activatedAt);
      expiresAt.setFullYear(expiresAt.getFullYear() + keyData.duration_years);

      const { data: updated, error: updateError } = await this.supabase
        .from('cloud_access_keys')
        .update({
          activated_at: activatedAt.toISOString(),
          expires_at: expiresAt.toISOString()
        })
        .eq('id', keyData.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error activating key:', updateError);
      } else {
        this.currentKeyData = updated;
      }
    }

    // Save key locally
    this.currentKey = plainKey.toLowerCase().trim();
    cloudStore.set('activeKey', this.currentKey);

    return this.currentKeyData;
  }

  async getKeyStatus() {
    if (!this.currentKey) {
      return { hasKey: false };
    }

    try {
      const keyData = await this._validateAndLoadKey(this.currentKey);
      return {
        hasKey: true,
        keyPreview: keyData.key_preview,
        quotaBytes: keyData.quota_bytes,
        usedBytes: keyData.used_bytes,
        expiresAt: keyData.expires_at,
        maxUsers: keyData.max_users,
        isActive: keyData.is_active
      };
    } catch (err) {
      // Key no longer valid
      this.clearKey();
      return { hasKey: false, error: err.message };
    }
  }

  getCurrentKeyId() {
    return this.currentKeyData?.id || null;
  }

  getCurrentKeyData() {
    return this.currentKeyData;
  }

  clearKey() {
    this.currentKey = null;
    this.currentKeyData = null;
    cloudStore.delete('activeKey');
  }

  async updateUsedBytes(deltaBytes) {
    if (!this.currentKeyData) return;

    const newUsed = Math.max(0, (this.currentKeyData.used_bytes || 0) + deltaBytes);

    const { error } = await this.supabase
      .from('cloud_access_keys')
      .update({ used_bytes: newUsed })
      .eq('id', this.currentKeyData.id);

    if (!error) {
      this.currentKeyData.used_bytes = newUsed;
    }
  }

  getClient() {
    return this.supabase;
  }
}

const cloudKeyService = new CloudKeyService();

module.exports = { cloudKeyService };
