// Browser Auth Service - seat-based login system
import { supabase } from './supabaseClient';
import { browserKeyService } from './browserKeyService';
import { browserCryptoService } from './browserCryptoService';

const SESSION_KEY = 'cpm-auth-session';

class BrowserAuthService {
  constructor() {
    this.currentUser = null;
    this._initFromStorage();
  }

  _initFromStorage() {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        this.currentUser = JSON.parse(saved);
      } catch {
        this.clearSession();
      }
    }
  }

  // SHA-256 hash (same pattern as admin panel and browserKeyService)
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Login with username + password
  // Returns { user, keyData, needsAccessKey }
  async login(username, password) {
    const passwordHash = await this.hashPassword(password);

    // Find user by username and password
    const { data: user, error } = await supabase
      .from('browser_users')
      .select('*')
      .eq('username', username.trim())
      .eq('password_hash', passwordHash)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      throw new Error('Invalid username or password');
    }

    // Validate the associated key
    const { data: keyData, error: keyError } = await supabase
      .from('browser_access_keys')
      .select('*')
      .eq('id', user.key_id)
      .single();

    if (keyError || !keyData) {
      throw new Error('Access key not found. Contact your administrator.');
    }

    if (!keyData.is_active) {
      throw new Error('Your access key has been deactivated. Contact your administrator.');
    }

    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      throw new Error('Your access key has expired. Contact your administrator.');
    }

    // Update last login
    await supabase
      .from('browser_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', user.id);

    // Save session
    const session = {
      id: user.id,
      key_id: user.key_id,
      username: user.username,
      display_name: user.display_name,
      role: user.role
    };
    this._saveSession(session);

    // Check if access key is available in localStorage for encryption
    const savedKey = browserKeyService.getCurrentKey();
    let needsAccessKey = true;

    if (savedKey) {
      // Verify it matches this user's key
      const matches = await browserKeyService.validateKeyForKeyId(savedKey, user.key_id);
      if (matches) {
        needsAccessKey = false;
        // Initialize key service and crypto
        await browserKeyService.initializeWithKey(savedKey);
        await browserCryptoService.deriveKey(savedKey);
      } else {
        // Wrong key in storage, clear it
        browserKeyService.clearKey();
      }
    }

    return { user: session, keyData, needsAccessKey };
  }

  // Activate a key and create the owner account
  async activateKey(accessKey, username, password, displayName) {
    // Validate the access key first
    const keyData = await browserKeyService.validateKey(accessKey);

    // Check if this key already has an owner
    const { data: existingOwner } = await supabase
      .from('browser_users')
      .select('id')
      .eq('key_id', keyData.id)
      .eq('role', 'owner')
      .single();

    if (existingOwner) {
      throw new Error('This key has already been activated. Please login with your credentials.');
    }

    // Check seat availability
    const { count } = await supabase
      .from('browser_users')
      .select('*', { count: 'exact', head: true })
      .eq('key_id', keyData.id)
      .eq('is_active', true);

    const maxSeats = keyData.max_seats || 5;
    if ((count || 0) >= maxSeats) {
      throw new Error('Maximum number of user seats reached.');
    }

    // Check username uniqueness for this key
    const { data: existingUser } = await supabase
      .from('browser_users')
      .select('id')
      .eq('key_id', keyData.id)
      .eq('username', username.trim())
      .single();

    if (existingUser) {
      throw new Error('Username already taken for this key.');
    }

    // Hash password and create owner account
    const passwordHash = await this.hashPassword(password);

    const { data: newUser, error: insertError } = await supabase
      .from('browser_users')
      .insert({
        key_id: keyData.id,
        username: username.trim(),
        password_hash: passwordHash,
        display_name: displayName.trim(),
        role: 'owner',
        last_login_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      throw new Error('Failed to create account: ' + insertError.message);
    }

    // Derive encryption key
    await browserCryptoService.deriveKey(accessKey);

    // Save session
    const session = {
      id: newUser.id,
      key_id: newUser.key_id,
      username: newUser.username,
      display_name: newUser.display_name,
      role: newUser.role
    };
    this._saveSession(session);

    return { user: session, keyData };
  }

  // Provide access key after login (for new browser scenario)
  async provideAccessKey(accessKey, keyId) {
    // Validate the key
    const keyData = await browserKeyService.validateKey(accessKey);

    // Verify it matches the user's key
    if (keyData.id !== keyId) {
      browserKeyService.clearKey();
      throw new Error('This access key does not match your account.');
    }

    // Derive encryption key
    await browserCryptoService.deriveKey(accessKey);

    return keyData;
  }

  // Create a member account (owner only)
  async createMember(keyId, username, password, displayName) {
    // Check seat count
    const seatInfo = await this.getSeatCount(keyId);
    if (seatInfo.current >= seatInfo.max) {
      throw new Error(`Maximum seats reached (${seatInfo.current}/${seatInfo.max}). Remove a member first.`);
    }

    // Check username uniqueness
    const { data: existing } = await supabase
      .from('browser_users')
      .select('id')
      .eq('key_id', keyId)
      .eq('username', username.trim())
      .single();

    if (existing) {
      throw new Error('Username already taken.');
    }

    const passwordHash = await this.hashPassword(password);

    const { data: newUser, error } = await supabase
      .from('browser_users')
      .insert({
        key_id: keyId,
        username: username.trim(),
        password_hash: passwordHash,
        display_name: displayName.trim(),
        role: 'member'
      })
      .select()
      .single();

    if (error) {
      throw new Error('Failed to create member: ' + error.message);
    }

    return newUser;
  }

  // Update a member (owner only)
  // updates can include: { display_name, password, is_active }
  async updateMember(userId, updates) {
    const updateData = {};

    if (updates.display_name !== undefined) {
      updateData.display_name = updates.display_name.trim();
    }

    if (updates.password) {
      updateData.password_hash = await this.hashPassword(updates.password);
    }

    if (updates.is_active !== undefined) {
      updateData.is_active = updates.is_active;
    }

    const { data, error } = await supabase
      .from('browser_users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      throw new Error('Failed to update member: ' + error.message);
    }

    return data;
  }

  // Delete a member (owner only, cannot delete owner)
  async deleteMember(userId, keyId) {
    // Prevent deleting the owner
    const { data: user } = await supabase
      .from('browser_users')
      .select('role')
      .eq('id', userId)
      .eq('key_id', keyId)
      .single();

    if (!user) {
      throw new Error('User not found.');
    }

    if (user.role === 'owner') {
      throw new Error('Cannot delete the owner account.');
    }

    const { error } = await supabase
      .from('browser_users')
      .delete()
      .eq('id', userId)
      .eq('key_id', keyId);

    if (error) {
      throw new Error('Failed to delete member: ' + error.message);
    }

    return true;
  }

  // List all users for a key
  async listUsers(keyId) {
    const { data, error } = await supabase
      .from('browser_users')
      .select('*')
      .eq('key_id', keyId)
      .order('role', { ascending: false }) // owner first
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error('Failed to list users: ' + error.message);
    }

    return data || [];
  }

  // Get seat count for a key
  async getSeatCount(keyId) {
    const { count, error: countError } = await supabase
      .from('browser_users')
      .select('*', { count: 'exact', head: true })
      .eq('key_id', keyId)
      .eq('is_active', true);

    const { data: keyData, error: keyError } = await supabase
      .from('browser_access_keys')
      .select('max_seats')
      .eq('id', keyId)
      .single();

    return {
      current: count || 0,
      max: keyData?.max_seats || 5
    };
  }

  // Session management
  _saveSession(user) {
    this.currentUser = user;
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  clearSession() {
    this.currentUser = null;
    localStorage.removeItem(SESSION_KEY);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isOwner() {
    return this.currentUser?.role === 'owner';
  }
}

export const browserAuthService = new BrowserAuthService();
