import React, { useState } from 'react';
import { useOnamRegistration } from '../hooks/useOnamRegistration';
import { supabase } from '../lib/supabase';

export default function OnamEventRegistration() {
  const {
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
  } = useOnamRegistration();

  const [submitting, setSubmitting] = useState(false);
  const [ticketData, setTicketData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Admin auth modal for export
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminCreds, setAdminCreds] = useState({ username: '', password: '' });
  const [adminAuthError, setAdminAuthError] = useState('');
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);
  const [exportUnlocked, setExportUnlocked] = useState(false);
  const [exportUnlockedAt, setExportUnlockedAt] = useState(null);

  const handleMobileSubmitVerify = (e) => {
    e.preventDefault();
    verifyMobileNumber();
  };

  const handlePayment = async () => {
    setErrorMessage('');
    if (attendeeType === 'member') {
      if (!registeredMobile || registeredMobile.trim().length < 10) {
        setErrorMessage('Please enter a valid 10-digit registered mobile number.');
        return;
      }
      if (mobileVerificationState.status !== 'verified') {
        setErrorMessage('Please verify registered ITLC mobile number before payment.');
        return;
      }
    } else {
      if (!guestForm.name || !guestForm.name.trim()) {
        setErrorMessage('Please enter Guest Name.');
        return;
      }
      if (!guestForm.company || !guestForm.company.trim()) {
        setErrorMessage('Please enter Company Name.');
        return;
      }
      if (!guestForm.designation || !guestForm.designation.trim()) {
        setErrorMessage('Please enter Designation.');
        return;
      }
      if (!guestForm.mobile || !guestForm.mobile.trim()) {
        setErrorMessage('Please enter Mobile Number.');
        return;
      }
      const cleanGuestPhone = guestForm.mobile.replace(/\D/g, '');
      if (cleanGuestPhone.length < 10) {
        setErrorMessage('Please enter a valid 10-digit mobile number.');
        return;
      }
      if (!guestForm.email || !guestForm.email.trim()) {
        setErrorMessage('Please enter Email Address.');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(guestForm.email.trim())) {
        setErrorMessage('Please enter a valid email address.');
        return;
      }
    }

    // ── Strict Fee Tamper & Bypass Guard ──
    if (attendeeType === 'guest') {
      if (netPayable === 0 && (!promoResult?.valid || promoResult?.discount < 750)) {
        setErrorMessage('Invalid fee calculation. Guest registration fee is ₹750.');
        return;
      }
      if (netPayable !== promoResult.netPayable) {
        setErrorMessage('Fee mismatch detected. Please re-apply any promo code.');
        return;
      }
    } else {
      if (netPayable < 300) {
        setErrorMessage('Member registration fee must be at least ₹300 for primary attendee.');
        return;
      }
    }

    setSubmitting(true);

    try {
      const regId = 'ONAM-' + Math.floor(100000 + Math.random() * 900000);
      const payerName = attendeeType === 'member' ? (mobileVerificationState.memberData?.full_name || attendees[0]?.name) : guestForm.name;
      const payerPhone = attendeeType === 'member' ? registeredMobile : guestForm.mobile;
      const payerEmail = attendeeType === 'member' ? mobileVerificationState.memberData?.email : guestForm.email;

      let paymentId = 'PAY-' + Date.now();

      // If netPayable > 0, trigger Razorpay Checkout
      if (netPayable > 0) {
        const loadScript = () => {
          return new Promise((resolve) => {
            if (window.Razorpay) {
              resolve(true);
              return;
            }
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
          });
        };

        const scriptLoaded = await loadScript();
        if (!scriptLoaded) {
          throw new Error('Failed to load Razorpay payment gateway. Please check internet connection.');
        }

        const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_T6i7oIk1mcbrzQ';

        const rzpResponse = await new Promise((resolve, reject) => {
          const options = {
            key: razorpayKey,
            amount: Math.round(netPayable * 100),
            currency: 'INR',
            name: 'ITLC Onam Celebration 2026',
            description: `Onam Event Registration Fee (${attendeeType === 'member' ? 'Member' : 'Guest'})`,
            prefill: {
              name: payerName,
              email: payerEmail,
              contact: payerPhone
            },
            theme: { color: '#059669' },
            handler: (res) => resolve(res),
            modal: {
              ondismiss: () => reject(new Error('Payment cancelled by user'))
            }
          };
          const rzp = new window.Razorpay(options);
          rzp.on('payment.failed', (res) => reject(new Error(res.error?.description || 'Payment Failed')));
          rzp.open();
        });

        if (rzpResponse && rzpResponse.razorpay_payment_id) {
          paymentId = rzpResponse.razorpay_payment_id;
        }
      }

      // Save main registration to dedicated 'onam_registrations' table
      const mainPayload = {
        id: regId,
        attendee_type: attendeeType,
        primary_name: payerName,
        phone_number: payerPhone,
        email: payerEmail,
        // For members: fetch real company & designation from verified member profile
        company: attendeeType === 'member'
          ? (mobileVerificationState.memberData?.company || '')
          : guestForm.company,
        designation: attendeeType === 'member'
          ? (mobileVerificationState.memberData?.designation || '')
          : guestForm.designation,
        guest_category: attendeeType === 'guest' ? guestCategory : null,
        num_attendees: attendeeType === 'member' ? attendees.length : 1,
        total_payable: netPayable,
        payment_status: netPayable === 0 ? 'completed' : 'paid',
        payment_id: paymentId,
        promo_code: promoCode || null,
        promo_discount: promoResult.discount || 0
      };

      const { error: mainErr } = await supabase.from('onam_registrations').insert([mainPayload]);
      if (mainErr) throw mainErr;

      // Save each attendee row into dedicated 'onam_attendees' table
      if (attendeeType === 'member' && attendees.length > 0) {
        const attendeePayloads = attendees.map((att, idx) => ({
          id: `${regId}-ATT-${idx + 1}`,
          registration_id: regId,
          attendee_index: idx + 1,
          name: att.name || (idx === 0 ? payerName : `Attendee ${idx + 1}`),
          relation: att.relation || 'self',
          is_minor: att.isMinor ? 1 : 0,
          individual_amount: att.amount || 0
        }));

        const { error: attErr } = await supabase.from('onam_attendees').insert(attendeePayloads);
        if (attErr) console.warn('Warning saving individual attendees:', attErr);
      } else {
        const guestAttendeePayload = [{
          id: `${regId}-ATT-1`,
          registration_id: regId,
          attendee_index: 1,
          name: payerName,
          relation: 'guest',
          is_minor: 0,
          individual_amount: netPayable
        }];
        await supabase.from('onam_attendees').insert(guestAttendeePayload);
      }

      setTicketData({
        registrationId: regId,
        paymentId: paymentId,
        name: payerName,
        amount: netPayable,
        type: attendeeType === 'member' ? 'ITLC Member' : `Guest (${guestCategory})`,
        attendeesCount: attendeeType === 'member' ? attendees.length : 1,
        qrValue: `ITLC-ONAM-TICKET:${regId}`
      });

    } catch (err) {
      console.error('Registration Error:', err);
      if (err.message !== 'Payment cancelled by user') {
        setErrorMessage(err.message || 'Failed to complete registration payment');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const shareWhatsApp = () => {
    if (!ticketData) return;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticketData.qrValue)}`;
    const text = `🎉 *ITLC Onam Celebration 2026 Ticket* 🎉\n\n` +
      `Ticket ID: *${ticketData.registrationId}*\n` +
      `Name: ${ticketData.name}\n` +
      `Category: ${ticketData.type}\n` +
      `Attendees: ${ticketData.attendeesCount}\n` +
      `Status: Payment Confirmed (₹${ticketData.amount})\n\n` +
      `📌 *View / Scan Ticket QR Code:* \n${qrImageUrl}\n\n` +
      `Present this ticket QR code at the event entrance!`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const downloadQR = async () => {
    if (!ticketData) return;
    try {
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticketData.qrValue)}`;
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Onam_Ticket_${ticketData.registrationId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download QR failed:', err);
      window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticketData.qrValue)}`, '_blank');
    }
  };


  // ── Admin-gated export ──────────────────────────────────────────────────
  const ADMIN_SESSION_MINUTES = 30;

  const handleExportClick = () => {
    // Check if already unlocked within the session window
    if (exportUnlocked && exportUnlockedAt) {
      const elapsedMs = Date.now() - exportUnlockedAt;
      if (elapsedMs < ADMIN_SESSION_MINUTES * 60 * 1000) {
        handleExportExcel();
        return;
      }
      // Session expired – re-auth
      setExportUnlocked(false);
      setExportUnlockedAt(null);
    }
    setAdminCreds({ username: '', password: '' });
    setAdminAuthError('');
    setShowAdminModal(true);
  };

  const verifyAdminAndExport = async () => {
    setAdminAuthLoading(true);
    setAdminAuthError('');
    await new Promise(r => setTimeout(r, 400)); // brief UX delay
    const savedUsers = localStorage.getItem('systemUsers');
    const users = savedUsers ? JSON.parse(savedUsers) : [];
    const match = users.find(
      u =>
        u.username.toLowerCase() === adminCreds.username.toLowerCase() &&
        u.password === adminCreds.password &&
        u.role === 'admin'
    );
    if (match) {
      setExportUnlocked(true);
      setExportUnlockedAt(Date.now());
      setShowAdminModal(false);
      setAdminCreds({ username: '', password: '' });
      handleExportExcel();
    } else {
      setAdminAuthError('Invalid admin credentials. Access denied.');
    }
    setAdminAuthLoading(false);
  };
  // ────────────────────────────────────────────────────────────────────────

  const handleExportExcel = async () => {
    try {
      setErrorMessage('');
      let query = supabase.from('onam_registrations').select('*');
      if (attendeeType === 'member') {
        query = query.eq('attendee_type', 'member');
      } else {
        query = query.eq('attendee_type', 'guest');
        if (guestCategory) {
          query = query.eq('guest_category', guestCategory);
        }
      }

      const { data: registrations, error } = await query;
      if (error) throw error;

      if (!registrations || registrations.length === 0) {
        const filterDesc = attendeeType === 'member' ? 'ITLC Member' : `Guest (${guestCategory})`;
        setErrorMessage(`No registration records found for ${filterDesc} to export.`);
        return;
      }

      const regIds = registrations.map(r => r.id);
      const { data: attendeesData } = await supabase
        .from('onam_attendees')
        .select('*')
        .in('registration_id', regIds);

      const attendeesMap = {};
      attendeesData?.forEach(att => {
        if (!attendeesMap[att.registration_id]) {
          attendeesMap[att.registration_id] = [];
        }
        attendeesMap[att.registration_id].push(att);
      });

      const headers = [
        'Registration ID',
        'Attendee Type',
        'Guest Category',
        'Primary Member / Guest Name',
        'Phone Number',
        'Email',
        'Company',
        'Designation',
        'Attendee Count',
        'Total Fee (INR)',
        'Payment ID',
        'Promo Code',
        'Attendee Breakdown (Name | Relation | Minor)',
        'Transaction Date & Time (IST)'
      ];

      // ── Sort by created_at ascending (earliest registration first) ──
      const sortedRegistrations = [...registrations].sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at) : new Date(0);
        const db = b.created_at ? new Date(b.created_at) : new Date(0);
        return da - db;
      });

      const rows = sortedRegistrations.map(r => {
        const attList = attendeesMap[r.id] || [];
        const breakdownStr = attList.length > 0 
          ? attList.map(a => `${a.name} (${a.relation}${a.is_minor ? ', Minor <5yrs' : ''})`).join(' ; ')
          : (r.primary_name || 'N/A');

        // Company & Designation: real values from members table (backfilled for old rows)
        const company     = r.company     || '';
        const designation = r.designation || '';

        // Total fee: column is stored as `total_payable` (fallback to total_amount for old rows)
        const totalFee = r.total_payable ?? r.total_amount ?? 0;

        return [
          r.id || '',
          r.attendee_type || '',
          r.guest_category || 'N/A',
          r.primary_name || '',
          r.phone_number || '',
          r.email || '',
          company,
          designation,
          r.num_attendees || (attList.length || 1),
          totalFee,
          r.payment_id || '',
          r.promo_code || 'None',
          breakdownStr,
          r.created_at ? new Date(r.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const filename = `Onam_Registrations_${attendeeType === 'member' ? 'Members' : `Guest_${guestCategory?.replace(/\s+/g, '_') || 'All'}`}_${Date.now()}.csv`;
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting registrations with attendees:', err);
      setErrorMessage('Failed to export Excel report. Please try again.');
    }
  };

  return (
    <>
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Onam Celebration Registration</h1>
        <p style={styles.subtitle}>ITLC Official Onam Event Public Registration Portal</p>
      </header>

      {ticketData ? (
        <div style={styles.ticketCard}>
          {/* QR Code Ticket Display Screen */}
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>🎉</div>
            <h2 style={{ color: '#047857', margin: '0 0 4px 0' }}>Registration Confirmed!</h2>
            <div style={styles.paymentSuccessBadge}>
              ✓ Payment Received & Verified (Txn ID: {ticketData.paymentId || 'SUCCESS'})
            </div>
            <p style={{ color: '#4b5563', fontSize: '14px', marginBottom: '20px' }}>Your Onam Celebration entry ticket is active.</p>
            
            <div style={styles.qrContainer}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(ticketData.qrValue)}`} 
                alt="Event Ticket QR Code" 
                style={{ width: '180px', height: '180px', borderRadius: '8px' }}
              />
              <div style={{ marginTop: '10px', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '16px', letterSpacing: '1px' }}>
                {ticketData.registrationId}
              </div>
            </div>

            <div style={styles.ticketDetails}>
              <div style={styles.ticketRow}><span>Name:</span> <strong>{ticketData.name}</strong></div>
              <div style={styles.ticketRow}><span>Registration Type:</span> <strong>{ticketData.type}</strong></div>
              <div style={styles.ticketRow}><span>Total Attendees:</span> <strong>{ticketData.attendeesCount}</strong></div>
              <div style={styles.ticketRow}><span>Payment Received:</span> <strong style={{ color: '#059669' }}>₹{ticketData.amount} (Paid)</strong></div>
              <div style={styles.ticketRow}><span>Entry Scan Status:</span> <strong style={{ color: '#2563eb' }}>Ready for Gate Scanner</strong></div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button onClick={downloadQR} style={styles.downloadBtn}>
                📥 Download QR Ticket
              </button>
              <button onClick={shareWhatsApp} style={styles.whatsappBtnFlex}>
                📱 Send to WhatsApp
              </button>
            </div>

            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              <button 
                onClick={() => {
                  setTicketData(null);
                  window.location.reload();
                }} 
                style={styles.registerAnotherBtn}
              >
                ➕ Register Another Member / Guest
              </button>
            </div>
          </div>
      ) : (
        /* Form Flow Matching Handwritten Spec */
        <div style={styles.card}>

          {/* Attendee Type Toggle Box & Export Excel */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={styles.typeBox} className="onam-type-box">
              <div style={styles.boxLabel}>Attendee Type :</div>
              <div style={styles.radioGroup}>
                <label style={styles.radioLabel}>
                  <input 
                    type="radio" 
                    name="attendeeType" 
                    value="member"
                    checked={attendeeType === 'member'} 
                    onChange={() => {
                      setAttendeeType('member');
                      // Reset promo when switching to Member tab
                      setPromoCode('');
                      setPromoResult({ discount: 0, netPayable: 750, valid: false });
                    }}
                  />
                  ITLC Member
                </label>
                <label style={styles.radioLabel}>
                  <input 
                    type="radio" 
                    name="attendeeType" 
                    value="guest"
                    checked={attendeeType === 'guest'} 
                    onChange={() => {
                      setAttendeeType('guest');
                      // Reset promo when switching to Guest tab
                      setPromoCode('');
                      setPromoResult({ discount: 0, netPayable: 750, valid: false });
                    }}
                  />
                  Guest
                </label>
              </div>
            </div>

            <button 
              type="button" 
              onClick={handleExportClick}
              style={{
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              🔒 Export to Excel
            </button>
          </div>

          {errorMessage && (
            <div style={styles.errorAlert}>{errorMessage}</div>
          )}

          {/* ITLC MEMBER FORM FLOW */}
          {attendeeType === 'member' && (
            <div style={{ marginTop: '24px' }}>
              <h2 style={styles.sectionHeader}>ITLC Member</h2>

              <div style={styles.formRow} className="onam-form-row">
                <label style={styles.label} className="onam-label">No. of attendees :</label>
                <select 
                  value={numAttendees} 
                  onChange={(e) => setNumAttendees(e.target.value)}
                  style={styles.selectInput}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div style={styles.formRow} className="onam-form-row">
                <label style={styles.label} className="onam-label">
                  Registered Mobile No <span style={{ color: '#ef4444' }}>*</span> :
                </label>
                <div style={{ display: 'flex', gap: '8px', flex: 1, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
                  <input 
                    type="text"
                    placeholder="Enter 10-digit phone"
                    value={registeredMobile}
                    onChange={(e) => setRegisteredMobile(e.target.value)}
                    style={styles.textInput}
                  />
                  <button 
                    type="button"
                    onClick={() => verifyMobileNumber()}
                    disabled={isVerifyingMobile}
                    style={styles.verifyBtn}
                  >
                    {isVerifyingMobile ? 'Checking...' : 'Verify'}
                  </button>
                </div>
              </div>

              {/* Mobile Verification Badge / Status Message */}
              {mobileVerificationState.status === 'verified' && (
                <div style={styles.verifiedBadge}>
                  ✓ Verified ({mobileVerificationState.memberData?.full_name})
                </div>
              )}
              {mobileVerificationState.status === 'error' && (
                <div style={styles.unverifiedBadge}>
                  {mobileVerificationState.message}
                </div>
              )}

              {/* Attendee Details Table */}
              <div style={{ overflowX: 'auto', marginTop: '20px' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>#</th>
                      <th style={styles.th}>Name <span style={{ color: '#ef4444' }}>*</span></th>
                      <th style={styles.th}>Relation</th>
                      <th style={styles.th}>Minor &lt; 5yrs</th>
                      <th style={styles.th}>Amt (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendees.map((att, idx) => (
                      <tr key={att.id}>
                        <td style={styles.td}>{idx + 1}</td>
                        <td style={styles.td}>
                          <input 
                            type="text" 
                            value={att.name}
                            onChange={(e) => updateAttendee(idx, 'name', e.target.value)}
                            placeholder={idx === 0 ? "Verified Member Name" : "Attendee Name"}
                            readOnly={idx === 0}
                            disabled={idx === 0}
                            style={{
                              ...styles.tableInput,
                              ...(idx === 0 ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#334155', fontWeight: '600' } : {})
                            }}
                          />
                        </td>
                        <td style={styles.td}>
                          <select 
                            value={att.relation}
                            onChange={(e) => updateAttendee(idx, 'relation', e.target.value)}
                            disabled={idx === 0}
                            style={{
                              ...styles.tableSelect,
                              ...(idx === 0 ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed' } : {})
                            }}
                          >
                            <option value="self">Self</option>
                            <option value="spouse">Spouse</option>
                            <option value="daughter">Daughter</option>
                            <option value="son">Son</option>
                            <option value="mother">Mother</option>
                            <option value="father">Father</option>
                            <option value="brother">Brother</option>
                            <option value="sister">Sister</option>
                          </select>
                        </td>
                        <td style={styles.td}>
                          <select 
                            value={att.isMinor ? 'Yes' : 'No'}
                            onChange={(e) => updateAttendee(idx, 'isMinor', e.target.value === 'Yes')}
                            disabled={idx === 0}
                            style={{
                              ...styles.tableSelect,
                              ...(idx === 0 ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed' } : {})
                            }}
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </td>
                        <td style={styles.td}>
                          <span style={styles.amtCell}>₹{att.amount}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={styles.totalRow}>
                Total Contribution Payable: <span style={{ color: '#059669', fontSize: '22px' }}>₹{netPayable}</span>
              </div>
            </div>
          )}

          {/* ITLC GUEST FORM FLOW */}
          {attendeeType === 'guest' && (
            <div style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={styles.sectionHeader}>ITLC Guest</h2>
                <div style={styles.guestCategoryBox}>
                  <span style={{ fontWeight: 'bold', fontSize: '13px', marginRight: '10px' }}>Category:</span>
                  <label style={{ marginRight: '12px', fontSize: '13px' }}>
                    <input 
                      type="radio" 
                      name="guestCat" 
                      value="Tech Partner"
                      checked={guestCategory === 'Tech Partner'}
                      onChange={() => setGuestCategory('Tech Partner')}
                    /> Tech Partner
                  </label>
                  <label style={{ fontSize: '13px' }}>
                    <input 
                      type="radio" 
                      name="guestCat" 
                      value="Guest"
                      checked={guestCategory === 'Guest'}
                      onChange={() => setGuestCategory('Guest')}
                    /> Guest
                  </label>
                </div>
              </div>

              <div style={styles.guestSplitLayout} className="onam-guest-split">
                <div style={styles.guestInputsColumn}>
                  <div style={styles.formRow} className="onam-form-row">
                    <label style={styles.guestLabel} className="onam-label">
                      Name <span style={{ color: '#ef4444' }}>*</span> :
                    </label>
                    <input 
                      type="text" 
                      value={guestForm.name}
                      onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })}
                      style={styles.textInput}
                    />
                  </div>
                  <div style={styles.formRow} className="onam-form-row">
                    <label style={styles.guestLabel} className="onam-label">
                      Company <span style={{ color: '#ef4444' }}>*</span> :
                    </label>
                    <input 
                      type="text" 
                      value={guestForm.company}
                      onChange={(e) => setGuestForm({ ...guestForm, company: e.target.value })}
                      style={styles.textInput}
                    />
                  </div>
                  <div style={styles.formRow} className="onam-form-row">
                    <label style={styles.guestLabel} className="onam-label">
                      Designation <span style={{ color: '#ef4444' }}>*</span> :
                    </label>
                    <input 
                      type="text" 
                      value={guestForm.designation}
                      onChange={(e) => setGuestForm({ ...guestForm, designation: e.target.value })}
                      style={styles.textInput}
                    />
                  </div>
                  <div style={styles.formRow} className="onam-form-row">
                    <label style={styles.guestLabel} className="onam-label">
                      Mobile <span style={{ color: '#ef4444' }}>*</span> :
                    </label>
                    <input 
                      type="text" 
                      value={guestForm.mobile}
                      onChange={(e) => setGuestForm({ ...guestForm, mobile: e.target.value })}
                      style={styles.textInput}
                    />
                  </div>
                  <div style={styles.formRow} className="onam-form-row">
                    <label style={styles.guestLabel} className="onam-label">
                      Email <span style={{ color: '#ef4444' }}>*</span> :
                    </label>
                    <input 
                      type="email" 
                      value={guestForm.email}
                      onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                      style={styles.textInput}
                    />
                  </div>
                </div>

                <div style={styles.guestSummaryColumn}>
                  <div style={styles.summaryRow}>
                    <span>Contribution:</span>
                    <span>₹750/-</span>
                  </div>
                  <div style={styles.promoBox}>
                    <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Apply promo code:</label>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      <input 
                        type="text"
                        placeholder="Enter promo code"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value);
                          // Auto-reset discount when promo field is cleared
                          if (!e.target.value.trim()) {
                            setPromoResult({ discount: 0, netPayable: 750, valid: false });
                          }
                        }}
                        style={styles.promoInput}
                      />
                      <button type="button" onClick={handleApplyPromo} style={styles.applyBtn}>Apply</button>
                    </div>
                  </div>
                  <div style={styles.summaryRow}>
                    <span>Discount applied:</span>
                    <span>₹{promoResult.discount}/-</span>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '8px 0' }} />
                  <div style={{ ...styles.summaryRow, fontWeight: 'bold', fontSize: '16px', color: '#111827' }}>
                    <span>Net payable:</span>
                    <span>₹{promoResult.netPayable}/-</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={styles.paymentFooter}>
            <button 
              onClick={handlePayment} 
              disabled={submitting} 
              style={styles.payBtn}
            >
              {submitting 
                ? 'Processing Registration...' 
                : netPayable === 0 
                  ? 'Complete Registration (Free ₹0)' 
                  : `Payment Link (Gateway) - Pay ₹${netPayable}`
              }
            </button>
          </div>

        </div>
      )}
    </div>

      {/* ── Admin Login Modal for Export ── */}
      {showAdminModal && (
        <div style={modalStyles.overlay} onClick={(e) => { if (e.target === e.currentTarget) setShowAdminModal(false); }}>
          <div style={modalStyles.box}>
            <div style={modalStyles.iconWrap}>
              <span style={{ fontSize: '32px' }}>🔐</span>
            </div>
            <h3 style={modalStyles.title}>Admin Authentication Required</h3>
            <p style={modalStyles.subtitle}>Enter your admin credentials to export data.</p>

            {adminAuthError && (
              <div style={modalStyles.errorBox}>{adminAuthError}</div>
            )}

            <div style={modalStyles.field}>
              <label style={modalStyles.label}>Username</label>
              <input
                type="text"
                autoFocus
                value={adminCreds.username}
                onChange={(e) => setAdminCreds({ ...adminCreds, username: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && verifyAdminAndExport()}
                placeholder="Admin username"
                style={modalStyles.input}
              />
            </div>

            <div style={modalStyles.field}>
              <label style={modalStyles.label}>Password</label>
              <input
                type="password"
                value={adminCreds.password}
                onChange={(e) => setAdminCreds({ ...adminCreds, password: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && verifyAdminAndExport()}
                placeholder="Admin password"
                style={modalStyles.input}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => setShowAdminModal(false)}
                disabled={adminAuthLoading}
                style={modalStyles.cancelBtn}
              >
                Cancel
              </button>
              <button
                onClick={verifyAdminAndExport}
                disabled={adminAuthLoading || !adminCreds.username || !adminCreds.password}
                style={modalStyles.confirmBtn}
              >
                {adminAuthLoading ? 'Verifying...' : '🔓 Unlock & Export'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  container: {
    maxWidth: '800px',
    margin: '30px auto',
    padding: '0 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  paymentSuccessBadge: {
    display: 'inline-block',
    background: '#dcfce7',
    color: '#15803d',
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 'bold',
    border: '1px solid #86efac',
    margin: '8px 0 16px 0'
  },
  registerAnotherBtn: {
    width: '100%',
    padding: '12px',
    background: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  downloadBtn: {
    flex: 1,
    padding: '14px',
    background: '#0284c7',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
  },
  whatsappBtnFlex: {
    flex: 1,
    padding: '14px',
    background: '#25D366',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)'
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#1e1b4b',
    margin: 0
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
    marginTop: '6px'
  },
  card: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.01)',
    border: '1px solid #e2e8f0'
  },
  typeBox: {
    border: '2px solid #334155',
    borderRadius: '10px',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    background: '#f8fafc'
  },
  boxLabel: {
    fontWeight: 'bold',
    fontSize: '16px',
    color: '#0f172a'
  },
  radioGroup: {
    display: 'flex',
    gap: '24px'
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  sectionHeader: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1e293b',
    borderBottom: '2px solid #cbd5e1',
    paddingBottom: '6px',
    marginBottom: '16px'
  },
  formRow: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '14px',
    gap: '12px'
  },
  label: {
    width: '180px',
    fontWeight: '600',
    fontSize: '14px',
    color: '#334155'
  },
  guestLabel: {
    width: '110px',
    fontWeight: '600',
    fontSize: '14px',
    color: '#334155'
  },
  selectInput: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    background: '#fff'
  },
  textInput: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    outline: 'none'
  },
  verifyBtn: {
    padding: '8px 16px',
    background: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer'
  },
  verifiedBadge: {
    background: '#dcfce7',
    color: '#15803d',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '700',
    border: '1px solid #86efac',
    marginTop: '4px',
    marginBottom: '12px'
  },
  unverifiedBadge: {
    background: '#fee2e2',
    color: '#b91c1c',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '700',
    border: '1px solid #fca5a5',
    marginTop: '4px',
    marginBottom: '12px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: '16px'
  },
  th: {
    border: '1px solid #cbd5e1',
    background: '#f1f5f9',
    padding: '10px 8px',
    fontSize: '13px',
    textAlign: 'left',
    fontWeight: '700',
    color: '#334155'
  },
  td: {
    border: '1px solid #e2e8f0',
    padding: '6px 8px',
    fontSize: '14px'
  },
  tableInput: {
    width: '100%',
    padding: '6px',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    fontSize: '13px'
  },
  tableSelect: {
    width: '100%',
    padding: '6px',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    fontSize: '13px'
  },
  amtCell: {
    fontWeight: '700',
    color: '#0f172a'
  },
  totalRow: {
    textAlign: 'right',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: '12px'
  },
  guestCategoryBox: {
    border: '1px solid #cbd5e1',
    padding: '8px 12px',
    borderRadius: '8px',
    background: '#f8fafc'
  },
  guestSplitLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 280px',
    gap: '24px'
  },
  guestInputsColumn: {},
  guestSummaryColumn: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px'
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    marginBottom: '10px',
    color: '#475569'
  },
  promoBox: {
    background: '#fff',
    border: '1px solid #cbd5e1',
    padding: '10px',
    borderRadius: '8px',
    marginBottom: '12px'
  },
  promoInput: {
    flex: 1,
    padding: '6px 8px',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    fontSize: '13px'
  },
  applyBtn: {
    padding: '6px 12px',
    background: '#0284c7',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  paymentFooter: {
    marginTop: '28px',
    borderTop: '2px solid #000',
    paddingTop: '20px',
    textAlign: 'center'
  },
  payBtn: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '17px',
    fontWeight: '800',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
  },
  ticketCard: {
    background: '#fff',
    borderRadius: '16px',
    padding: '32px',
    textAlign: 'center',
    border: '1px solid #e2e8f0',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'
  },
  qrContainer: {
    display: 'inline-block',
    background: '#f8fafc',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    marginBottom: '20px'
  },
  ticketDetails: {
    textAlign: 'left',
    background: '#f8fafc',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '24px',
    border: '1px solid #e2e8f0'
  },
  ticketRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
    borderBottom: '1px dashed #e2e8f0',
    fontSize: '14px'
  },
  whatsappBtn: {
    width: '100%',
    padding: '14px',
    background: '#25D366',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)'
  },
  errorAlert: {
    background: '#fee2e2',
    color: '#991b1b',
    padding: '10px 14px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px',
    fontWeight: 'bold'
  }
};

const modalStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '16px'
  },
  box: {
    background: '#ffffff',
    borderRadius: '16px',
    padding: '32px 28px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
    border: '1px solid #e5e7eb'
  },
  iconWrap: {
    textAlign: 'center',
    marginBottom: '12px'
  },
  title: {
    margin: '0 0 6px 0',
    fontSize: '18px',
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center'
  },
  subtitle: {
    margin: '0 0 20px 0',
    fontSize: '13px',
    color: '#6b7280',
    textAlign: 'center'
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fca5a5',
    color: '#b91c1c',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '16px'
  },
  field: {
    marginBottom: '14px'
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '6px'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1.5px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s'
  },
  cancelBtn: {
    flex: 1,
    padding: '11px',
    background: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  confirmBtn: {
    flex: 2,
    padding: '11px',
    background: '#059669',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(5,150,105,0.3)'
  }
};
