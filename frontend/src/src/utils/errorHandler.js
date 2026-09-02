/**
 * Formats backend/database error objects into human-readable messages.
 * Catches common constraints (duplicate phone/email) and provides detailed context.
 */
export function formatErrorMessage(error, defaultFallback = 'Submission failed. Please try again.') {
  if (!error) return defaultFallback;

  const rawMessage = typeof error === 'string' ? error : (error.message || JSON.stringify(error));

  // Check for duplicate key / unique constraint errors
  if (rawMessage.includes('Duplicate entry') || rawMessage.includes('uq_phone') || rawMessage.includes('uq_email') || rawMessage.includes('ER_DUP_ENTRY')) {
    if (rawMessage.includes('uq_phone') || rawMessage.includes('phone') || rawMessage.includes('Duplicate entry')) {
      // Check if it specifically mentions phone or matching numbers
      const phoneMatch = rawMessage.match(/'([^']+)'/);
      const phoneVal = phoneMatch ? ` (${phoneMatch[1]})` : '';
      if (rawMessage.toLowerCase().includes('phone') || rawMessage.includes('uq_phone')) {
        return `This phone number${phoneVal} is already registered with ITLC. Please use another phone number or update your existing profile.`;
      }
    }

    if (rawMessage.includes('uq_email') || rawMessage.toLowerCase().includes('email')) {
      const emailMatch = rawMessage.match(/'([^']+)'/);
      const emailVal = emailMatch ? ` (${emailMatch[1]})` : '';
      return `This email address${emailVal} is already registered with ITLC. Please use a different email.`;
    }

    // Generic Duplicate Entry extraction
    const match = rawMessage.match(/Duplicate entry '([^']+)' for key '([^']+)'/);
    if (match) {
      const [, val, keyName] = match;
      const cleanKey = keyName.replace(/^uq_/, '').replace(/_/g, ' ');
      return `Registration failed: Duplicate entry '${val}' for ${cleanKey}. You might already be registered.`;
    }

    return 'This contact information (phone number or email) is already registered in our system.';
  }

  // Clean raw SQL or internal error prefixes if present
  if (rawMessage.startsWith('Error: ')) {
    return rawMessage.replace(/^Error:\s*/, '');
  }

  return rawMessage || defaultFallback;
}
