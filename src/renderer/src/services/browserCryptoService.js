// Browser Crypto Service - for browser-based app only
// AES-256-GCM encryption with PBKDF2 key derivation (no salt)

class BrowserCryptoService {
  constructor() {
    this.encryptionKey = null;
  }

  // Derive encryption key from access key (no salt, normalized to lowercase)
  async deriveKey(accessKey) {
    const normalizedKey = accessKey.toLowerCase().trim();
    const encoder = new TextEncoder();

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(normalizedKey),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Use PBKDF2 to derive a proper AES key (no salt, just empty buffer)
    this.encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new Uint8Array(16), // Empty salt (16 zero bytes)
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return true;
  }

  hasKey() {
    return this.encryptionKey !== null;
  }

  clearKey() {
    this.encryptionKey = null;
  }

  // Encrypt ArrayBuffer using AES-256-GCM
  async encrypt(data) {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set. Please enter your access key first.');
    }

    // Generate random IV (12 bytes for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      data
    );

    // Format: IV (12 bytes) + Ciphertext (includes auth tag)
    const result = new Uint8Array(12 + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), 12);

    return result.buffer;
  }

  // Decrypt ArrayBuffer using AES-256-GCM
  async decrypt(encryptedData) {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set. Please enter your access key first.');
    }

    const data = new Uint8Array(encryptedData);

    // Extract IV (first 12 bytes)
    const iv = data.slice(0, 12);
    // Rest is ciphertext (includes auth tag)
    const ciphertext = data.slice(12);

    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.encryptionKey,
        ciphertext
      );

      return decrypted;
    } catch (err) {
      throw new Error('Decryption failed. Invalid key or corrupted file.');
    }
  }
}

export const browserCryptoService = new BrowserCryptoService();
