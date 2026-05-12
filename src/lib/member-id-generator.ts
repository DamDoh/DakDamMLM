/**
 * Generates a unique member ID based on user's name and phone number
 * Format: [First letter of firstName][First letter of surname][Last 4 digits of phone]
 * Example: John Doe with phone +1234567890 -> JD7890
 */

/**
 * Converts a character to an English letter if possible, otherwise uses a fallback
 * Handles Khmer and other non-Latin characters by using fallback letters
 * Always returns A-Z (English uppercase letter)
 */
function getEnglishInitial(char: string): string {
  // Check if character is already an English letter (A-Z, a-z)
  if (/^[A-Za-z]$/.test(char)) {
    return char.toUpperCase();
  }
  
  // For non-English characters (Khmer, Chinese, Arabic, etc.), use a fallback pattern
  // Map to A-Z based on character code to ensure consistent English output
  // This ensures member IDs are always in English format, even for Khmer names
  if (char.length === 0) {
    return 'X'; // Default fallback if empty
  }
  
  const charCode = char.charCodeAt(0);
  // Use modulo to map to A-Z range (65-90 = A-Z)
  // This ensures we always get a valid English letter
  const fallbackLetter = String.fromCharCode(65 + (charCode % 26));
  return fallbackLetter;
}

export function generateMemberId(firstName: string, surname: string, phoneNumber: string): string {
  // Get first character and convert to English letter
  // This ensures member IDs are always in English, even for Khmer names
  const firstInitial = getEnglishInitial(firstName.charAt(0));

  // Get first character of surname and convert to English letter
  const surnameInitial = getEnglishInitial(surname.charAt(0));

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
  checkExistence: (memberId: string) => Promise<boolean>,
  parentMemberId?: string
): Promise<string> {
  // Generate base member ID following parent's pattern if provided
  let memberId: string;
  if (parentMemberId) {
    memberId = generateMemberIdFromParent(parentMemberId, firstName, surname, phoneNumber);
  } else {
    memberId = generateMemberId(firstName, surname, phoneNumber);
  }
  
  let counter = 1;
  const maxAttempts = 999;

  // Check if ID exists and increment counter until we find a unique one
  while (await checkExistence(memberId)) {
    // If parent uses sequential pattern (e.g., MEM001), increment the number
    const sequentialPattern = /^([A-Z]+)(\d+)$/;
    const match = memberId.match(sequentialPattern);
    
    if (match && parentMemberId) {
      // Parent uses sequential pattern - increment the number
      const prefix = match[1];
      const currentNumber = parseInt(match[2], 10);
      const numberLength = match[2].length;
      const nextNumber = (currentNumber + counter).toString().padStart(numberLength, '0');
      memberId = `${prefix}${nextNumber}`;
    } else {
      // Use initials pattern - modify the digits
      if (counter >= maxAttempts) {
        // Fallback: add timestamp-based suffix
        const timestamp = Date.now().toString().slice(-2);
        memberId = `${memberId.slice(0, 4)}${timestamp}`;
        break;
      }
      // Append counter to the last 2 digits, keeping it as 4 digits total
      const baseDigits = memberId.slice(2, 6);
      const newDigits = (parseInt(baseDigits) + counter).toString().padStart(4, '0');
      memberId = `${memberId.slice(0, 2)}${newDigits}`;
    }
    
    counter++;
    
    // Safety check to prevent infinite loops
    if (counter > maxAttempts) {
      // Fallback: add timestamp-based suffix
      const timestamp = Date.now().toString().slice(-2);
      memberId = `${memberId.slice(0, 4)}${timestamp}`;
      break;
    }
  }

  return memberId;
}

/**
 * Generates a member ID following the parent's ID pattern
 * If parent ID is sequential (e.g., MEM001), generates sequential child ID (e.g., MEM002)
 * If parent ID is initials-based (e.g., HA1231), uses initials pattern with phone digits
 */
export function generateMemberIdFromParent(
  parentMemberId: string,
  firstName: string,
  surname: string,
  phoneNumber: string
): string {
  // Check if parent ID follows sequential pattern (e.g., MEM001, ADM001)
  const sequentialPattern = /^([A-Z]+)(\d+)$/;
  const match = parentMemberId.match(sequentialPattern);
  
  if (match) {
    // Parent uses sequential pattern - extract prefix and number
    const prefix = match[1]; // e.g., "MEM" or "ADM"
    const parentNumber = parseInt(match[2], 10);
    
    // Generate child ID with same prefix, incrementing the number
    // Start from parent's number + 1, but we'll need to check uniqueness later
    const childNumber = (parentNumber + 1).toString().padStart(match[2].length, '0');
    return `${prefix}${childNumber}`;
  }
  
  // Parent uses initials pattern or other format - use standard initials pattern
  return generateMemberId(firstName, surname, phoneNumber);
}

/**
 * Example usage:
 *
 * const memberId = generateMemberId("John", "Doe", "+1234567890");
 * // Result: "JD7890"
 *
 * const memberId2 = generateMemberId("Jane", "Smith", "+0987654321");
 * // Result: "JS4321"
 *
 * const memberId3 = generateMemberIdFromParent("MEM001", "Bob", "Smith", "+1234567890");
 * // Result: "MEM002"
 */