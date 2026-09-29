import { useState, useCallback } from 'react';
import { authService } from '../services/authService';

export function usePinReset() {
  const [step, setStep] = useState('idle'); // 'idle' | 'code-sent' | 'success'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const requestReset = useCallback(async (phoneNumber) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await authService.forgotPin(phoneNumber);
      setStep('code-sent');
      setSuccessMessage('A 6-digit PIN reset code has been sent to your registered email address.');
      return res;
    } catch (err) {
      setError(err.message || 'Failed to send reset code');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const submitReset = useCallback(async ({ phoneNumber, resetCode, newPin }) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await authService.resetPin({ phoneNumber, resetCode, newPin });
      setStep('success');
      setSuccessMessage('Your PIN has been successfully reset! You can now log in.');
      return res;
    } catch (err) {
      setError(err.message || 'Failed to reset PIN');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const resetState = useCallback(() => {
    setStep('idle');
    setLoading(false);
    setError(null);
    setSuccessMessage(null);
  }, []);

  return {
    step,
    loading,
    error,
    successMessage,
    requestReset,
    submitReset,
    resetState,
    setStep
  };
}
