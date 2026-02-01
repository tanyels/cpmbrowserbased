const { machineIdSync } = require('node-machine-id');
const Store = require('electron-store');
const os = require('os');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { app } = require('electron');

// License configuration
const LICENSE_CONFIG = {
  PRODUCT_SLUG: 'cpm-software',
  API_BASE_URL: 'https://lamosa-store.vercel.app', // Production URL
  TRIAL_DAYS: 7,
  GRACE_PERIOD_DAYS: 14,
  VALIDATION_INTERVAL_DAYS: 30, // Monthly validation
  TRIAL_LIMITS: {
    MAX_BUSINESS_UNITS: 2,
    MAX_KPIS: 10,
    MAX_TEAM_MEMBERS: 5,
    EXPORT_ALLOWED: false
  }
};

// License states
const LICENSE_STATE = {
  VALID: 'valid',
  TRIAL: 'trial',
  TRIAL_EXPIRED: 'trial_expired',
  EXPIRED: 'expired',
  GRACE_PERIOD: 'grace_period',
  INVALID: 'invalid',
  NEEDS_VALIDATION: 'needs_validation'
};

// Initialize persistent store
const store = new Store({
  name: 'cpm-license',
  encryptionKey: 'cpm-strategy-cascade-2024', // Basic obfuscation
  defaults: {
    licenseKey: null,
    activationId: null,
    licenseStatus: null,
    expiresAt: null,
    productName: null,
    companyName: null,
    companyLogoUrl: null,
    companyLogoPath: null,
    lastValidation: null,
    trialStartDate: null,
    isTrialMode: false,
    machineId: null
  }
});

class LicenseService {
  constructor() {
    this.machineId = null;
    this.machineName = os.hostname();
  }

  // Download company logo from URL and save locally
  async downloadCompanyLogo(logoUrl) {
    if (!logoUrl) return null;

    try {
      const userDataPath = app.getPath('userData');
      const logoDir = path.join(userDataPath, 'company');

      // Create directory if it doesn't exist
      if (!fs.existsSync(logoDir)) {
        fs.mkdirSync(logoDir, { recursive: true });
      }

      // Get file extension from URL
      const urlObj = new URL(logoUrl);
      const ext = path.extname(urlObj.pathname) || '.png';
      const logoPath = path.join(logoDir, `logo${ext}`);

      // Download the image
      return new Promise((resolve, reject) => {
        const protocol = logoUrl.startsWith('https') ? https : http;
        const file = fs.createWriteStream(logoPath);

        protocol.get(logoUrl, (response) => {
          // Handle redirects
          if (response.statusCode === 301 || response.statusCode === 302) {
            file.close();
            fs.unlinkSync(logoPath);
            this.downloadCompanyLogo(response.headers.location).then(resolve).catch(reject);
            return;
          }

          if (response.statusCode !== 200) {
            file.close();
            fs.unlinkSync(logoPath);
            reject(new Error(`Failed to download logo: ${response.statusCode}`));
            return;
          }

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            console.log('Company logo downloaded to:', logoPath);
            resolve(logoPath);
          });
        }).on('error', (err) => {
          file.close();
          if (fs.existsSync(logoPath)) {
            fs.unlinkSync(logoPath);
          }
          reject(err);
        });
      });
    } catch (error) {
      console.error('Failed to download company logo:', error);
      return null;
    }
  }

  // Get unique machine identifier
  getMachineId() {
    if (!this.machineId) {
      try {
        this.machineId = machineIdSync({ original: true });
        store.set('machineId', this.machineId);
      } catch (error) {
        console.error('Failed to get machine ID:', error);
        // Fallback to stored ID or generate one
        this.machineId = store.get('machineId') || `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        store.set('machineId', this.machineId);
      }
    }
    return this.machineId;
  }

  // Get stored license data
  getLicenseData() {
    return {
      licenseKey: store.get('licenseKey'),
      activationId: store.get('activationId'),
      licenseStatus: store.get('licenseStatus'),
      expiresAt: store.get('expiresAt'),
      productName: store.get('productName'),
      companyName: store.get('companyName'),
      companyLogoUrl: store.get('companyLogoUrl'),
      companyLogoPath: store.get('companyLogoPath'),
      lastValidation: store.get('lastValidation'),
      trialStartDate: store.get('trialStartDate'),
      isTrialMode: store.get('isTrialMode'),
      machineId: this.getMachineId()
    };
  }

  // Start trial mode
  startTrial() {
    const trialStartDate = new Date().toISOString();
    store.set('trialStartDate', trialStartDate);
    store.set('isTrialMode', true);
    store.set('licenseKey', null);
    store.set('activationId', null);
    return {
      success: true,
      state: LICENSE_STATE.TRIAL,
      trialStartDate,
      trialDaysRemaining: LICENSE_CONFIG.TRIAL_DAYS
    };
  }

  // Check trial status
  getTrialStatus() {
    const trialStartDate = store.get('trialStartDate');
    if (!trialStartDate) {
      return { isInTrial: false, trialDaysRemaining: 0, trialExpired: false };
    }

    const start = new Date(trialStartDate);
    const now = new Date();
    const daysPassed = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, LICENSE_CONFIG.TRIAL_DAYS - daysPassed);

    return {
      isInTrial: daysRemaining > 0,
      trialDaysRemaining: daysRemaining,
      trialExpired: daysPassed >= LICENSE_CONFIG.TRIAL_DAYS,
      trialStartDate
    };
  }

  // Calculate grace period status
  getGracePeriodStatus() {
    const expiresAt = store.get('expiresAt');
    if (!expiresAt) return { inGracePeriod: false, graceDaysRemaining: 0 };

    const expiry = new Date(expiresAt);
    const now = new Date();

    if (now <= expiry) {
      return { inGracePeriod: false, graceDaysRemaining: 0 };
    }

    const daysSinceExpiry = Math.floor((now - expiry) / (1000 * 60 * 60 * 24));
    const graceDaysRemaining = Math.max(0, LICENSE_CONFIG.GRACE_PERIOD_DAYS - daysSinceExpiry);

    return {
      inGracePeriod: graceDaysRemaining > 0,
      graceDaysRemaining,
      graceExpired: daysSinceExpiry >= LICENSE_CONFIG.GRACE_PERIOD_DAYS
    };
  }

  // Check if validation is needed
  needsOnlineValidation() {
    const lastValidation = store.get('lastValidation');
    if (!lastValidation) return true;

    const last = new Date(lastValidation);
    const now = new Date();
    const daysSinceValidation = Math.floor((now - last) / (1000 * 60 * 60 * 24));

    return daysSinceValidation >= LICENSE_CONFIG.VALIDATION_INTERVAL_DAYS;
  }

  // Validate license with server
  async validateLicense(licenseKey, companyInfo = null) {
    const machineId = this.getMachineId();

    try {
      const requestBody = {
        license_key: licenseKey,
        machine_id: machineId,
        machine_name: this.machineName,
        product_slug: LICENSE_CONFIG.PRODUCT_SLUG
      };

      // Add company info if provided
      if (companyInfo) {
        requestBody.company_name = companyInfo.companyName;
        requestBody.company_logo_url = companyInfo.companyLogoUrl || null;
      }

      const response = await fetch(`${LICENSE_CONFIG.API_BASE_URL}/api/licenses/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (data.valid) {
        // Store successful validation
        store.set('licenseKey', licenseKey.toUpperCase());
        store.set('activationId', data.activation_id);
        store.set('licenseStatus', data.license?.status || 'active');
        store.set('expiresAt', data.license?.expires_at || null);
        store.set('productName', data.license?.product_name || 'CPM Software');
        store.set('companyName', data.license?.company_name || null);
        store.set('companyLogoUrl', data.license?.company_logo_url || null);
        store.set('lastValidation', new Date().toISOString());
        store.set('isTrialMode', false);

        // Download company logo if available
        if (data.license?.company_logo_url) {
          try {
            const logoPath = await this.downloadCompanyLogo(data.license.company_logo_url);
            if (logoPath) {
              store.set('companyLogoPath', logoPath);
            }
          } catch (err) {
            console.error('Failed to download company logo:', err);
          }
        }

        return {
          success: true,
          message: data.message,
          state: LICENSE_STATE.VALID,
          license: data.license,
          activationId: data.activation_id
        };
      } else {
        // Check if company info is needed
        if (data.needs_company_info) {
          return {
            success: false,
            needsCompanyInfo: true,
            message: data.message,
            state: LICENSE_STATE.INVALID
          };
        }

        return {
          success: false,
          message: data.message,
          state: LICENSE_STATE.INVALID
        };
      }
    } catch (error) {
      console.error('License validation error:', error);

      // Check if we have cached valid license for offline use
      const cachedKey = store.get('licenseKey');
      if (cachedKey && cachedKey.toUpperCase() === licenseKey.toUpperCase()) {
        const expiresAt = store.get('expiresAt');
        const isExpired = expiresAt && new Date(expiresAt) < new Date();

        if (!isExpired) {
          return {
            success: true,
            message: 'License validated from cache (offline)',
            state: LICENSE_STATE.VALID,
            offline: true
          };
        }
      }

      return {
        success: false,
        message: 'Unable to connect to license server. Please check your internet connection.',
        state: LICENSE_STATE.NEEDS_VALIDATION,
        offline: true
      };
    }
  }

  // Activate a new license key
  async activateLicense(licenseKey, companyInfo = null) {
    return this.validateLicense(licenseKey, companyInfo);
  }

  // Deactivate license
  async deactivateLicense() {
    const licenseKey = store.get('licenseKey');
    const machineId = this.getMachineId();

    if (!licenseKey) {
      return { success: false, message: 'No license to deactivate' };
    }

    try {
      const response = await fetch(`${LICENSE_CONFIG.API_BASE_URL}/api/licenses/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          license_key: licenseKey,
          machine_id: machineId
        })
      });

      const data = await response.json();

      if (data.success) {
        // Clear local license data
        store.set('licenseKey', null);
        store.set('activationId', null);
        store.set('licenseStatus', null);
        store.set('expiresAt', null);
        store.set('lastValidation', null);

        return {
          success: true,
          message: 'License deactivated successfully'
        };
      } else {
        return {
          success: false,
          message: data.message
        };
      }
    } catch (error) {
      console.error('Deactivation error:', error);
      return {
        success: false,
        message: 'Unable to connect to license server'
      };
    }
  }

  // Get current license state
  async getCurrentState() {
    const licenseKey = store.get('licenseKey');
    const isTrialMode = store.get('isTrialMode');
    const trialStatus = this.getTrialStatus();
    const graceStatus = this.getGracePeriodStatus();

    // No license and no trial - prompt for license or trial
    if (!licenseKey && !isTrialMode && !trialStatus.trialStartDate) {
      return {
        state: LICENSE_STATE.INVALID,
        message: 'No license found',
        canStartTrial: true,
        limits: null
      };
    }

    // In trial mode
    if (isTrialMode || (trialStatus.trialStartDate && !licenseKey)) {
      if (trialStatus.isInTrial) {
        return {
          state: LICENSE_STATE.TRIAL,
          message: `Trial mode: ${trialStatus.trialDaysRemaining} days remaining`,
          trialDaysRemaining: trialStatus.trialDaysRemaining,
          limits: LICENSE_CONFIG.TRIAL_LIMITS,
          readOnly: false
        };
      } else {
        return {
          state: LICENSE_STATE.TRIAL_EXPIRED,
          message: 'Trial period has expired',
          limits: LICENSE_CONFIG.TRIAL_LIMITS,
          readOnly: true
        };
      }
    }

    // Has license key - check validity
    if (licenseKey) {
      const expiresAt = store.get('expiresAt');
      const isExpired = expiresAt && new Date(expiresAt) < new Date();

      if (isExpired) {
        // Check grace period
        if (graceStatus.inGracePeriod) {
          return {
            state: LICENSE_STATE.GRACE_PERIOD,
            message: `License expired. Grace period: ${graceStatus.graceDaysRemaining} days remaining (read-only mode)`,
            graceDaysRemaining: graceStatus.graceDaysRemaining,
            limits: null,
            readOnly: true
          };
        } else {
          return {
            state: LICENSE_STATE.EXPIRED,
            message: 'License and grace period have expired',
            limits: null,
            readOnly: true
          };
        }
      }

      // Check if needs online validation
      if (this.needsOnlineValidation()) {
        try {
          const result = await this.validateLicense(licenseKey);
          if (result.success) {
            return {
              state: LICENSE_STATE.VALID,
              message: 'License is valid',
              expiresAt: store.get('expiresAt'),
              limits: null,
              readOnly: false
            };
          }
        } catch (error) {
          // Offline - use cached data if still within validation window
          console.log('Offline validation - using cached license');
        }
      }

      // Valid license
      return {
        state: LICENSE_STATE.VALID,
        message: 'License is valid',
        expiresAt: store.get('expiresAt'),
        limits: null,
        readOnly: false
      };
    }

    return {
      state: LICENSE_STATE.INVALID,
      message: 'Unknown license state',
      canStartTrial: true,
      limits: null
    };
  }

  // Get feature limits based on current state
  async getFeatureLimits() {
    const state = await this.getCurrentState();

    if (state.state === LICENSE_STATE.TRIAL) {
      return {
        ...LICENSE_CONFIG.TRIAL_LIMITS,
        readOnly: false
      };
    }

    if (state.state === LICENSE_STATE.GRACE_PERIOD ||
        state.state === LICENSE_STATE.TRIAL_EXPIRED ||
        state.state === LICENSE_STATE.EXPIRED) {
      return {
        readOnly: true,
        EXPORT_ALLOWED: false
      };
    }

    // Full license - no limits
    return {
      MAX_BUSINESS_UNITS: Infinity,
      MAX_KPIS: Infinity,
      MAX_TEAM_MEMBERS: Infinity,
      EXPORT_ALLOWED: true,
      readOnly: false
    };
  }

  // Clear all license data (for testing)
  clearLicenseData() {
    store.clear();
    return { success: true, message: 'License data cleared' };
  }
}

// Export singleton instance
const licenseService = new LicenseService();

module.exports = {
  licenseService,
  LICENSE_STATE,
  LICENSE_CONFIG
};
