/**
 * Generates a unique member ID based on user's name and phone number
 * Format: [First letter of firstName][First letter of surname][Last 4 digits of phone]
 * Example: John Doe with phone +1234567890 -> JD7890
 */

export function generateMemberId(firstName: string, surname: string, phoneNumber: string): string {
  // Get first letter of first name (uppercase)
  const firstInitial = firstName.charAt(0).toUpperCase();

  // Get first letter of surname (uppercase)
  const surnameInitial = surname.charAt(0).toUpperCase();

  // Extract last 4 digits from phone number
  // Remove all non-digit characters first
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const lastFourDigits = cleanPhone.slice(-4);

  // Ensure we have exactly 4 digits
  if (lastFourDigits.length !== 4) {
    throw new Error('Phone number must contain at least 4 digits');
  }

  // Combine: Initials + last 4 digits
  const memberId = `${firstInitial}${surnameInitial}${lastFourDigits}`;

  return memberId;
}

/**
 * Validates if a generated member ID follows the expected format
 */
export function validateMemberId(memberId: string): boolean {
  // Should be exactly 6 characters: 2 letters + 4 digits
  const memberIdRegex = /^[A-Z]{2}\d{4}$/;
  return memberIdRegex.test(memberId);
}

/**
 * Generates a unique member ID with collision checking
 * If the generated ID already exists, appends a sequential number
 */
export async function generateUniqueMemberId(
  firstName: string,
  surname: string,
  phoneNumber: string,
  checkExistence: (memberId: string) => Promise<boolean>
): Promise<string> {
  let memberId = generateMemberId(firstName, surname, phoneNumber);
  let counter = 1;

  // Check if ID exists and increment counter until we find a unique one
  while (await checkExistence(memberId)) {
    // If counter reaches 99, we'll need a different approach
    if (counter >= 99) {
      // Fallback: add timestamp-based suffix
      const timestamp = Date.now().toString().slice(-2);
      memberId = `${memberId.slice(0, 4)}${timestamp}`;
      break;
    }

    // Append counter to the last 2 digits, keeping it as 4 digits total
    const baseDigits = memberId.slice(2, 6);
    const newDigits = (parseInt(baseDigits) + counter).toString().padStart(4, '0');
    memberId = `${memberId.slice(0, 2)}${newDigits}`;
    counter++;
  }

  return memberId;
}

/**
 * Example usage:
 *
 * const memberId = generateMemberId("John", "Doe", "+1234567890");
 * // Result: "JD7890"
 *
 * const memberId2 = generateMemberId("Jane", "Smith", "+0987654321");
 * // Result: "JS4321"
 */