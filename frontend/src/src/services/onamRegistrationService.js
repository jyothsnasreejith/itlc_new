const API_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) 
  || (typeof process !== 'undefined' && process.env && process.env.VITE_API_URL)
  || 'http://localhost:5000/api';

export const onamRegistrationService = {
  /**
   * Verify registered mobile number against ITLC members database table
   */
  async verifyMemberPhone(phone) {
    if (!phone) throw new Error('Phone number is required');
    const cleanPhone = phone.trim();

    const response = await fetch(`${API_URL}/onam-registration/verify-member-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cleanPhone })
    });

    const data = await response.json();
    return data;
  },

  /**
   * Calculate registration breakdown total
   */
  calculateMemberFee(attendees) {
    let total = 0;
    const breakdown = attendees.map(a => {
      let fee = 0;
      if (a.isMinor) {
        fee = 0;
      } else if (a.relation === 'self') {
        fee = 300;
      } else {
        // Spouse, Children, Parents, Siblings, etc.
        fee = 250;
      }
      total += fee;
      return { ...a, calculatedFee: fee };
    });

    return { total, breakdown };
  },

  /**
   * Apply promo code calculation for Guest category
   */
  applyPromoCode(code, baseAmount = 750) {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) return { discount: 0, netPayable: baseAmount, valid: false };

    if (cleanCode === 'SDZEN' || cleanCode === 'ABICTS' || cleanCode === 'ONAM100') {
      return { discount: 750, netPayable: Math.max(0, baseAmount - 750), valid: true, code: cleanCode };
    } else if (cleanCode === 'SD500') {
      return { discount: 500, netPayable: Math.max(0, baseAmount - 500), valid: true, code: cleanCode };
    } else if (cleanCode === 'ONAM50') {
      const discount = Math.round(baseAmount * 0.5);
      return { discount, netPayable: baseAmount - discount, valid: true, code: cleanCode };
    }

    return { discount: 0, netPayable: baseAmount, valid: false, error: 'Invalid Promo Code' };
  }
};
