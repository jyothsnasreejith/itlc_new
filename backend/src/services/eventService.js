import { eventRepository } from '../repositories/eventRepository.js';
import { memberRepository } from '../repositories/memberRepository.js';

export const eventService = {
  async sendInvites({ eventId, chapter, targetEmail, targetPhone }) {
    const event = await eventRepository.findById(eventId);
    if (!event) {
      const err = new Error('Event not found');
      err.statusCode = 404;
      throw err;
    }

    const members = await memberRepository.findMembersForInvite({ targetEmail, targetPhone, chapter });
    if (members.length === 0) {
      const err = new Error('No members found for invitation criteria');
      err.statusCode = 400;
      throw err;
    }

    const mailtrapToken = process.env.MAILTRAP_TOKEN;
    const frontendUrl = process.env.APP_URL || 'http://localhost:5173';

    if (mailtrapToken) {
      const senderEmail = process.env.MAILTRAP_SENDER_EMAIL || 'noreply@yourdomain.com';
      const senderName = process.env.MAILTRAP_SENDER_NAME || 'ITLC Events Team';

      const emailPromises = members.map(async (member) => {
        const registrationUrl = `${frontendUrl}/event-registration/${event.id}?member=${member.id}`;
        
        const emailPayload = {
          from: { email: senderEmail, name: senderName },
          to: [{ email: member.email, name: member.full_name }],
          subject: `You're Invited: ${event.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
              <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
                <div style="text-align: center; margin-bottom: 20px;">
                  <span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase;">You're Invited</span>
                  <h1 style="color: #1a1a1a; margin-top: 10px;">Event Invitation</h1>
                </div>
                <p>Dear ${member.full_name},</p>
                <p>We are delighted to invite you to: <strong>${event.title}</strong></p>
                <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
                  <p><strong>Date:</strong> ${event.date}</p>
                  <p><strong>Time:</strong> ${event.time || 'N/A'}</p>
                  <p><strong>Location:</strong> ${event.location || 'N/A'}</p>
                </div>
                <p style="text-align: center; margin: 30px 0;">
                  <a href="${registrationUrl}&action=accept" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-right: 10px;">✓ Accept Invitation</a>
                  <a href="${registrationUrl}&action=decline" style="background: #f3f4f6; color: #6b7280; border: 1px solid #e5e7eb; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">✗ Decline</a>
                </p>
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
      });

      await Promise.all(emailPromises);
    } else {
      console.log(`[DEV MODE] Printing invitations to console for ${members.length} members.`);
    }

    return {
      success: true,
      message: `Successfully processed ${members.length} invitations`,
      count: members.length
    };
  }
};
