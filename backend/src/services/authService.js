import { memberRepository } from '../repositories/memberRepository.js';

export const authService = {
  async requestPinReset(phoneNumber) {
    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }

    const member = await memberRepository.findApprovedByPhone(phoneNumber);
    if (!member) {
      const err = new Error('Member not found or not approved');
      err.statusCode = 404;
      throw err;
    }

    if (!member.email) {
      const err = new Error('No email address found for this member');
      err.statusCode = 400;
      throw err;
    }

    const tempPin = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await memberRepository.updateResetPin(member.id, tempPin, expiryTime);

    const mailtrapToken = process.env.MAILTRAP_TOKEN;
    if (mailtrapToken) {
      const senderEmail = process.env.MAILTRAP_SENDER_EMAIL || 'noreply@yourdomain.com';
      const senderName = process.env.MAILTRAP_SENDER_NAME || 'ITLC Support Team';

      const emailPayload = {
        from: { email: senderEmail, name: senderName },
        to: [{ email: member.email, name: member.full_name }],
        subject: 'Your PIN Reset Code - ITLC Kerala',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 10px;">PIN Reset Code</h2>
              <p>Hello ${member.full_name},</p>
              <p>You have requested to reset your PIN. Here is your temporary reset code:</p>
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 4px; margin: 20px 0; font-family: monospace;">${tempPin}</div>
              <p style="background-color: #fff3cd; color: #856404; padding: 15px; border-radius: 6px;"><strong>Warning:</strong> This code will expire in 15 minutes.</p>
            </div>
          </div>
        `
      };

      await fetch('https://send.api.mailtrap.io/api/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mailtrapToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailPayload)
      });
    } else {
      console.log(`[DEV MODE] Forgot PIN request for ${member.email}. Temp PIN is: ${tempPin}`);
    }

    return {
      success: true,
      message: 'PIN reset code sent to your email',
      emailSent: !!mailtrapToken
    };
  }
};
