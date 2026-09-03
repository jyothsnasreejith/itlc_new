import { useState, useEffect } from 'react';
import { onamRegistrationService } from '../services/onamRegistrationService';

export function useOnamRegistration() {
  const [attendeeType, setAttendeeType] = useState('member'); // 'member' or 'guest'

  // Member form state
  const [numAttendees, setNumAttendees] = useState(1);
  const [registeredMobile, setRegisteredMobile] = useState('');
  const [isVerifyingMobile, setIsVerifyingMobile] = useState(false);
  const [mobileVerificationState, setMobileVerificationState] = useState({
    status: 'idle', // 'idle', 'verified', 'error'
    message: '',
    memberData: null
  });

  const [attendees, setAttendees] = useState([
    { id: 1, name: '', relation: 'self', isMinor: false, amount: 300 }
  ]);

  // Guest form state
  const [guestCategory, setGuestCategory] = useState('Tech Partner');
  const [guestForm, setGuestForm] = useState({
    name: '',
    company: '',
    designation: '',
    mobile: '',
    email: ''
  });
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState({ discount: 0, netPayable: 750, valid: false });

  // Mobile verification action
  const verifyMobileNumber = async (mobileToVerify) => {
    const targetMobile = mobileToVerify || registeredMobile;
    if (!targetMobile || targetMobile.trim().length < 10) {
      setMobileVerificationState({
        status: 'error',
        message: 'Please enter a valid 10-digit mobile number',
        memberData: null
      });
      return;
    }

    setIsVerifyingMobile(true);
    try {
      const result = await onamRegistrationService.verifyMemberPhone(targetMobile);
      if (result && result.verified) {
        setMobileVerificationState({
          status: 'verified',
          message: '✓ Verified',
          memberData: result.member
        });
        // Auto-fill row 1 name if blank or updated
        setAttendees(prev => prev.map((att, idx) => idx === 0 ? { ...att, name: result.member.full_name || att.name } : att));
      } else {
        setMobileVerificationState({
          status: 'error',
          message: '✗ Not registered mobile no, try another',
          memberData: null
        });
      }
    } catch (err) {
      setMobileVerificationState({
        status: 'error',
        message: '✗ Not registered mobile no, try another',
        memberData: null
      });
    } finally {
      setIsVerifyingMobile(false);
    }
  };

  // Sync attendee row count with dropdown
  useEffect(() => {
    const count = parseInt(numAttendees, 10) || 1;
    setAttendees(prev => {
      if (prev.length === count) return prev;
      if (prev.length < count) {
        const newRows = [...prev];
        for (let i = prev.length; i < count; i++) {
          newRows.push({
            id: i + 1,
            name: '',
            relation: i === 0 ? 'self' : 'spouse',
            isMinor: false,
            amount: 450
          });
        }
        return recalculateAmounts(newRows);
      } else {
        return recalculateAmounts(prev.slice(0, count));
      }
    });
  }, [numAttendees]);

  const recalculateAmounts = (rowsList) => {
    const { breakdown } = onamRegistrationService.calculateMemberFee(rowsList);
    return breakdown.map(item => ({
      ...item,
      amount: item.calculatedFee
    }));
  };

  const updateAttendee = (index, field, value) => {
    // Primary member row (index 0) cannot be altered for relation or minor status
    if (index === 0 && (field === 'isMinor' || field === 'relation')) return;
    setAttendees(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return recalculateAmounts(updated);
    });
  };

  const handleApplyPromo = () => {
    const res = onamRegistrationService.applyPromoCode(promoCode, 750);
    setPromoResult(res);
  };

  const memberTotalAmount = attendees.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const netPayable = attendeeType === 'member' ? memberTotalAmount : promoResult.netPayable;

  return {
    attendeeType,
    setAttendeeType,
    numAttendees,
    setNumAttendees,
    registeredMobile,
    setRegisteredMobile,
    isVerifyingMobile,
    mobileVerificationState,
    verifyMobileNumber,
    attendees,
    updateAttendee,
    guestCategory,
    setGuestCategory,
    guestForm,
    setGuestForm,
    promoCode,
    setPromoCode,
    promoResult,
    handleApplyPromo,
    netPayable
  };
}
