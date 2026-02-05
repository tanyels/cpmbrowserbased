// Browser Key Service - for browser-based app only
import { supabase } from './supabaseClient';

const STORAGE_KEY = 'cpm-browser-key';

class BrowserKeyService {
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

  async hashKey(plainKey) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plainKey.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async _validateAndLoadKey(plainKey) {
    const keyHash = await this.hashKey(plainKey);

    const { data, error } = await supabase
      .from('browser_access_keys')
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
    const normalizedKey = plainKey.toLowerCase().trim();
    const keyData = await this._validateAndLoadKey(normalizedKey);

    const now = new Date().toISOString();
    const updates = { last_used_at: now };

    // If not yet activated, activate it now
    if (!keyData.activated_at) {
      updates.activated_at = now;

      // Set expiration to 1 year from activation if not already set
      if (!keyData.expires_at) {
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        updates.expires_at = expiresAt.toISOString();
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('browser_access_keys')
      .update(updates)
      .eq('id', keyData.id)
      .select()
      .single();

    if (!updateError && updated) {
      this.currentKeyData = updated;
    }

    // Save key locally (normalized)
    this.currentKey = normalizedKey;
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

  getCurrentKey() {
    return this.currentKey;
  }

  clearKey() {
    this.currentKey = null;
    this.currentKeyData = null;
    localStorage.removeItem(STORAGE_KEY);
  }

  // Validate that a plaintext key matches a specific key_id
  async validateKeyForKeyId(plainKey, expectedKeyId) {
    const keyHash = await this.hashKey(plainKey);
    const { data, error } = await supabase
      .from('browser_access_keys')
      .select('id')
      .eq('key_hash', keyHash)
      .eq('id', expectedKeyId)
      .single();

    return !error && !!data;
  }

  // Initialize service from a known valid key (session restore)
  async initializeWithKey(plainKey) {
    const normalizedKey = plainKey.toLowerCase().trim();
    const keyData = await this._validateAndLoadKey(normalizedKey);
    this.currentKey = normalizedKey;
    return keyData;
  }

  async updateUsedBytes(deltaBytes) {
    if (!this.currentKeyData) return;

    const newUsed = Math.max(0, (this.currentKeyData.used_bytes || 0) + deltaBytes);

    const { error } = await supabase
      .from('browser_access_keys')
      .update({ used_bytes: newUsed })
      .eq('id', this.currentKeyData.id);

    if (!error) {
      this.currentKeyData.used_bytes = newUsed;
    }
  }
}

export const browserKeyService = new BrowserKeyService();
