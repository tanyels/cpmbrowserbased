// Browser-compatible Cloud Key Service using localStorage
import { supabase } from './supabaseClient';

const STORAGE_KEY = 'cpm-cloud-key';

class CloudKeyService {
  constructor() {
    this.currentKey = null;
    this.currentKeyData = null;
    this._initFromStorage();
  }

  _initFromStorage() {
    const savedKey = localStorage.getItem(STORAGE_KEY);
    if (savedKey) {
      this.currentKey = savedKey;
      this._validateAndLoadKey(savedKey).catch(() => {
        this.clearKey();
      });
    }
  }

  isConfigured() {
    return true; // Always configured in web version
  }

  async hashKey(plainKey) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plainKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async _validateAndLoadKey(plainKey) {
    const keyHash = await this.hashKey(plainKey.toLowerCase().trim());

    const { data, error } = await supabase
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

      const { data: updated, error: updateError } = await supabase
        .from('cloud_access_keys')
        .update({
          activated_at: activatedAt.toISOString(),
          expires_at: expiresAt.toISOString()
        })
        .eq('id', keyData.id)
        .select()
        .single();

      if (!updateError && updated) {
        this.currentKeyData = updated;
      }
    }

    // Save key locally
    this.currentKey = plainKey.toLowerCase().trim();
    localStorage.setItem(STORAGE_KEY, this.currentKey);

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
    localStorage.removeItem(STORAGE_KEY);
  }

  async updateUsedBytes(deltaBytes) {
    if (!this.currentKeyData) return;

    const newUsed = Math.max(0, (this.currentKeyData.used_bytes || 0) + deltaBytes);

    const { error } = await supabase
      .from('cloud_access_keys')
      .update({ used_bytes: newUsed })
      .eq('id', this.currentKeyData.id);

    if (!error) {
      this.currentKeyData.used_bytes = newUsed;
    }
  }
}

export const cloudKeyService = new CloudKeyService();
