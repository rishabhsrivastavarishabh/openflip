/**
 * Client-side "Remember this device for 60 days" store for 2FA.
 *
 * We persist a small marker in localStorage keyed to (userId, factorId).
 * If the marker is present and not expired, the login flow skips the MFA
 * challenge. This trusts device storage — anyone with access to this browser
 * can log in without a TOTP code until the marker expires or is cleared.
 */

const PREFIX = 'openflip.mfa_trusted';
export const TRUSTED_DEVICE_DAYS = 60;

function key(userId: string, factorId: string) {
  return `${PREFIX}.${userId}.${factorId}`;
}

export function isDeviceTrusted(userId: string, factorId: string): boolean {
  try {
    const raw = localStorage.getItem(key(userId, factorId));
    if (!raw) return false;
    const expiresAt = Number(raw);
    if (!Number.isFinite(expiresAt)) return false;
    if (Date.now() > expiresAt) {
      localStorage.removeItem(key(userId, factorId));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function trustDevice(userId: string, factorId: string, days = TRUSTED_DEVICE_DAYS) {
  try {
    const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
    localStorage.setItem(key(userId, factorId), String(expiresAt));
  } catch {
    // storage disabled — silently ignore
  }
}

export function untrustDevice(userId: string, factorId: string) {
  try {
    localStorage.removeItem(key(userId, factorId));
  } catch {
    // ignore
  }
}

export function untrustAllDevices() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}
