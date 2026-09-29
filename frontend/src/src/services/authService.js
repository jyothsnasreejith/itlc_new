const API_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) 
  || (typeof process !== 'undefined' && process.env && process.env.VITE_API_URL)
  || 'http://localhost:5000/api';

export const authService = {
  /**
   * Request a 6-digit temporary PIN reset code sent to the member's registered email
   */
  async forgotPin(phoneNumber) {
    if (!phoneNumber) throw new Error('Phone number is required');
    const response = await fetch(`${API_URL}/auth/forgot-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: phoneNumber.trim() })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to send PIN reset code');
    }
    return data;
  },

  /**
   * Reset member login PIN using the 6-digit code received on email
   */
  async resetPin({ phoneNumber, resetCode, newPin }) {
    if (!phoneNumber || !resetCode || !newPin) {
      throw new Error('Phone number, reset code, and new PIN are required');
    }

    const response = await fetch(`${API_URL}/auth/reset-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: phoneNumber.trim(),
        resetCode: resetCode.trim(),
        newPin: newPin.trim()
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Failed to reset PIN');
    }
    return data;
  },

  /**
   * Member login with Phone Number and 4-digit PIN
   */
  async memberLogin({ phoneNumber, pin }) {
    if (!phoneNumber || !pin) {
      throw new Error('Phone number and PIN are required');
    }

    const response = await fetch(`${API_URL}/auth/member-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: phoneNumber.trim(),
        pin: pin.trim()
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Login failed');
    }
    return data;
  }
};
