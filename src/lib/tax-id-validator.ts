/**
 * Tax ID Validation Utility
 * Validates tax identification numbers based on country-specific formats
 */

export interface TaxIdValidation {
  isValid: boolean;
  error?: string;
  formatted?: string;
}

/**
 * Validate tax ID based on country code
 */
export function validateTaxId(taxId: string, countryCode: string): TaxIdValidation {
  if (!taxId || !countryCode) {
    return { isValid: true }; // Optional field
  }

  const cleanTaxId = taxId.replace(/[\s\-\.]/g, ''); // Remove separators

  switch (countryCode.toUpperCase()) {
    case 'US':
      return validateUSEIN(cleanTaxId);
    case 'GB':
      return validateUKVAT(cleanTaxId);
    case 'TH':
      return validateThailandTaxId(cleanTaxId);
    case 'KH':
      return validateCambodiaTaxId(cleanTaxId);
    case 'VN':
      return validateVietnamTaxId(cleanTaxId);
    case 'SG':
      return validateSingaporeTaxId(cleanTaxId);
    case 'MY':
      return validateMalaysiaTaxId(cleanTaxId);
    default:
      // Generic validation for unknown countries
      return validateGenericTaxId(cleanTaxId);
  }
}

/**
 * US EIN (Employer Identification Number)
 * Format: XX-XXXXXXX (9 digits)
 */
function validateUSEIN(taxId: string): TaxIdValidation {
  if (!/^\d{9}$/.test(taxId)) {
    return {
      isValid: false,
      error: 'US EIN must be 9 digits (format: XX-XXXXXXX)'
    };
  }

  const formatted = `${taxId.slice(0, 2)}-${taxId.slice(2)}`;
  return { isValid: true, formatted };
}

/**
 * UK VAT Number
 * Format: GB XXXXXXXXX (9-12 digits after GB)
 */
function validateUKVAT(taxId: string): TaxIdValidation {
  // Remove GB prefix if present
  const clean = taxId.replace(/^GB/i, '');
  
  if (!/^\d{9,12}$/.test(clean)) {
    return {
      isValid: false,
      error: 'UK VAT must be 9-12 digits after GB prefix'
    };
  }

  return { isValid: true, formatted: `GB${clean}` };
}

/**
 * Thailand Tax ID
 * Format: X-XXXX-XXXXX-XX-X (13 digits)
 */
function validateThailandTaxId(taxId: string): TaxIdValidation {
  if (!/^\d{13}$/.test(taxId)) {
    return {
      isValid: false,
      error: 'Thailand Tax ID must be 13 digits'
    };
  }

  const formatted = `${taxId.slice(0, 1)}-${taxId.slice(1, 5)}-${taxId.slice(5, 10)}-${taxId.slice(10, 12)}-${taxId.slice(12)}`;
  return { isValid: true, formatted };
}

/**
 * Cambodia Tax ID
 * Format: K00X-XXXXXXXXX (typically starts with K followed by digits)
 */
function validateCambodiaTaxId(taxId: string): TaxIdValidation {
  if (!/^[A-Z0-9]{8,15}$/i.test(taxId)) {
    return {
      isValid: false,
      error: 'Cambodia Tax ID must be 8-15 alphanumeric characters'
    };
  }

  return { isValid: true, formatted: taxId.toUpperCase() };
}

/**
 * Vietnam Tax ID (MST - Mã số thuế)
 * Format: XXXXXXXXXX or XXXXXXXXXX-XXX (10 or 13 digits)
 */
function validateVietnamTaxId(taxId: string): TaxIdValidation {
  if (!/^\d{10}(\d{3})?$/.test(taxId)) {
    return {
      isValid: false,
      error: 'Vietnam Tax ID must be 10 or 13 digits'
    };
  }

  const formatted = taxId.length === 13 
    ? `${taxId.slice(0, 10)}-${taxId.slice(10)}`
    : taxId;
  
  return { isValid: true, formatted };
}

/**
 * Singapore UEN (Unique Entity Number)
 * Format: Various formats (9-10 characters)
 */
function validateSingaporeTaxId(taxId: string): TaxIdValidation {
  if (!/^[0-9]{8,10}[A-Z]?$/i.test(taxId)) {
    return {
      isValid: false,
      error: 'Singapore UEN must be 8-10 characters (alphanumeric)'
    };
  }

  return { isValid: true, formatted: taxId.toUpperCase() };
}

/**
 * Malaysia Tax ID (Company Registration Number)
 * Format: XXXXXX-X (7 characters) or newer format
 */
function validateMalaysiaTaxId(taxId: string): TaxIdValidation {
  if (!/^[0-9]{6,10}[A-Z]?$/i.test(taxId)) {
    return {
      isValid: false,
      error: 'Malaysia Tax ID must be 6-10 alphanumeric characters'
    };
  }

  return { isValid: true, formatted: taxId.toUpperCase() };
}

/**
 * Generic validation for countries without specific rules
 * Allows alphanumeric, ensures reasonable length
 */
function validateGenericTaxId(taxId: string): TaxIdValidation {
  if (taxId.length < 5 || taxId.length > 20) {
    return {
      isValid: false,
      error: 'Tax ID must be between 5 and 20 characters'
    };
  }

  if (!/^[A-Z0-9\-]+$/i.test(taxId)) {
    return {
      isValid: false,
      error: 'Tax ID must contain only letters, numbers, and hyphens'
    };
  }

  return { isValid: true, formatted: taxId.toUpperCase() };
}

/**
 * Get tax ID format description for a country
 */
export function getTaxIdFormat(countryCode: string): string {
  switch (countryCode.toUpperCase()) {
    case 'US':
      return 'EIN format: XX-XXXXXXX (9 digits)';
    case 'GB':
      return 'VAT format: GB XXXXXXXXX (9-12 digits)';
    case 'TH':
      return 'Tax ID format: 13 digits';
    case 'KH':
      return 'Tax ID format: 8-15 alphanumeric characters';
    case 'VN':
      return 'MST format: 10 or 13 digits';
    case 'SG':
      return 'UEN format: 8-10 characters';
    case 'MY':
      return 'Registration Number: 6-10 characters';
    default:
      return 'Tax ID format: 5-20 alphanumeric characters';
  }
}