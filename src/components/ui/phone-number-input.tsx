'use client';

import * as React from 'react';
import PhoneInput, { Country, getCountries, getCountryCallingCode, parsePhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type PhoneNumberInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  onChange: (value: string | undefined) => void;
  value?: string;
  defaultCountry?: Country;
};

const PhoneNumberInput = React.forwardRef<HTMLInputElement, PhoneNumberInputProps>(
  ({ className, onChange, value, defaultCountry = 'KH', ...props }, ref) => {
    const [country, setCountry] = React.useState<Country>(defaultCountry || 'KH');
    const [phoneNumber, setPhoneNumber] = React.useState<string>(value || '');
    const [nationalNumber, setNationalNumber] = React.useState<string>('');

    // Extract country and national number from phone number if it starts with +
    React.useEffect(() => {
      if (value && value.startsWith('+')) {
        try {
          const phoneNumberObj = parsePhoneNumber(value);
          if (phoneNumberObj?.country) {
            setCountry(phoneNumberObj.country);
            // Extract national number (without country code) for display
            if (phoneNumberObj.nationalNumber) {
              setNationalNumber(phoneNumberObj.nationalNumber);
            }
          }
        } catch (e) {
          // If parsing fails, try manual detection with supported countries only
          const supportedCountries: Country[] = ['US', 'KH', 'PH', 'CN'];
          for (const c of supportedCountries) {
            const code = getCountryCallingCode(c);
            if (value.startsWith(`+${code}`)) {
              setCountry(c);
              // Extract national number by removing country code
              const national = value.replace(`+${code}`, '').trim();
              setNationalNumber(national);
              break;
            }
          }
        }
      } else {
        // Default to KH (Cambodia) if no value provided
        setCountry(defaultCountry || 'KH');
        setNationalNumber(value || '');
      }
    }, [value, defaultCountry]);

    // Update phone number when value prop changes
    React.useEffect(() => {
      if (value !== undefined) {
        setPhoneNumber(value);
        // Extract national number for display
        if (value && value.startsWith('+')) {
          try {
            const phoneNumberObj = parsePhoneNumber(value);
            if (phoneNumberObj?.nationalNumber) {
              setNationalNumber(phoneNumberObj.nationalNumber);
            } else {
              // Fallback: remove country code manually
              const countryCode = getCountryCallingCode(country);
              setNationalNumber(value.replace(`+${countryCode}`, '').trim());
            }
          } catch (e) {
            // Fallback: remove country code manually
            const countryCode = getCountryCallingCode(country);
            setNationalNumber(value.replace(`+${countryCode}`, '').trim());
          }
        } else {
          setNationalNumber(value || '');
        }
      }
    }, [value, country]);

    const handleCountryChange = (newCountry: Country) => {
      const countryCode = getCountryCallingCode(newCountry);
      let newValue: string;
      
      // Use the national number (without country code) and combine with new country code
      if (nationalNumber && nationalNumber.trim() !== '') {
        newValue = `+${countryCode}${nationalNumber}`;
      } else if (phoneNumber && phoneNumber.trim() !== '' && phoneNumber !== '+') {
        // Fallback: extract national number from existing phone number
        try {
          const phoneNumberObj = parsePhoneNumber(phoneNumber);
          if (phoneNumberObj && phoneNumberObj.nationalNumber) {
            newValue = `+${countryCode}${phoneNumberObj.nationalNumber}`;
            setNationalNumber(phoneNumberObj.nationalNumber);
          } else {
            const numberWithoutCode = phoneNumber.replace(/^\+\d+\s*/g, '').trim();
            newValue = numberWithoutCode ? `+${countryCode}${numberWithoutCode}` : `+${countryCode}`;
            setNationalNumber(numberWithoutCode);
          }
        } catch (e) {
          const numberWithoutCode = phoneNumber.replace(/^\+\d+\s*/g, '').trim();
          newValue = numberWithoutCode ? `+${countryCode}${numberWithoutCode}` : `+${countryCode}`;
          setNationalNumber(numberWithoutCode);
        }
      } else {
        // If no phone number, just set the country code
        newValue = `+${countryCode}`;
        setNationalNumber('');
      }
      
      // Update both country and phone number state
      setCountry(newCountry);
      setPhoneNumber(newValue);
      onChange?.(newValue);
    };

    const handlePhoneChange = (newValue: string | undefined) => {
      // When international={false}, PhoneInput still returns international format if valid
      // Extract national number for display and store international format
      if (newValue && newValue.startsWith('+')) {
        try {
          const phoneNumberObj = parsePhoneNumber(newValue);
          if (phoneNumberObj?.nationalNumber) {
            setNationalNumber(phoneNumberObj.nationalNumber);
            setPhoneNumber(newValue);
            onChange?.(newValue);
          } else {
            // Fallback: extract national number manually
            const countryCode = getCountryCallingCode(country);
            const nationalNum = newValue.replace(`+${countryCode}`, '').trim();
            setNationalNumber(nationalNum);
            setPhoneNumber(newValue);
            onChange?.(newValue);
          }
        } catch (e) {
          // If parsing fails, extract national number manually
          const countryCode = getCountryCallingCode(country);
          const nationalNum = newValue.replace(`+${countryCode}`, '').trim();
          setNationalNumber(nationalNum);
          setPhoneNumber(newValue);
          onChange?.(newValue);
        }
      } else {
        // If no country code, treat as national number and convert to international
        const countryCode = getCountryCallingCode(country);
        const internationalValue = newValue ? `+${countryCode}${newValue}` : `+${countryCode}`;
        setNationalNumber(newValue || '');
        setPhoneNumber(internationalValue);
        onChange?.(internationalValue);
      }
    };

    // Only show supported countries: US, Cambodia, Philippines, China
    const supportedCountries: Country[] = ['US', 'KH', 'PH', 'CN'];
    const countries = getCountries().filter((c) => supportedCountries.includes(c));

    return (
      <div className={cn('flex items-center gap-2 w-full', className)}>
        {/* Country Selector with Flag - Shorter Width */}
        <Select value={country} onValueChange={handleCountryChange}>
          <SelectTrigger className="w-[100px] sm:w-[110px] h-10 shrink-0">
            <div className="flex items-center gap-1.5">
              <CountryFlag country={country} />
              <SelectValue>
                <span className="text-sm font-medium">+{getCountryCallingCode(country)}</span>
              </SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                <div className="flex items-center gap-2">
                  <CountryFlag country={c} />
                  <span className="text-sm">
                    +{getCountryCallingCode(c)} {getCountryName(c)}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Phone Number Input - Longer Width */}
        <div className="flex-1 min-w-0 phone-input-wrapper">
          <PhoneInput
            key={country}
            international={false}
            country={country}
            value={phoneNumber || undefined}
            onChange={handlePhoneChange}
            defaultCountry={country}
            countries={supportedCountries}
            className={cn(
              'PhoneInput phone-input-custom w-full',
              '[&_.PhoneInputInput]:flex [&_.PhoneInputInput]:h-10 [&_.PhoneInputInput]:w-full [&_.PhoneInputInput]:min-w-0 [&_.PhoneInputInput]:rounded-md [&_.PhoneInputInput]:border [&_.PhoneInputInput]:border-input [&_.PhoneInputInput]:bg-background [&_.PhoneInputInput]:px-3 [&_.PhoneInputInput]:py-2 [&_.PhoneInputInput]:text-sm [&_.PhoneInputInput]:ring-offset-background [&_.PhoneInputInput]:placeholder:text-muted-foreground [&_.PhoneInputInput]:focus-visible:outline-none [&_.PhoneInputInput]:focus-visible:ring-2 [&_.PhoneInputInput]:focus-visible:ring-ring [&_.PhoneInputInput]:focus-visible:ring-offset-2 [&_.PhoneInputInput]:disabled:cursor-not-allowed [&_.PhoneInputInput]:disabled:opacity-50',
              // Hide the country code display in the input
              '[&_.PhoneInputCountryIcon]:hidden [&_.PhoneInputCountrySelect]:hidden [&_.PhoneInputCountrySelectArrow]:hidden [&_.PhoneInputCountry]:hidden'
            )}
            {...props}
          />
        </div>
      </div>
    );
  }
);
PhoneNumberInput.displayName = 'PhoneNumberInput';

// Country Flag Component
function CountryFlag({ country }: { country: Country }) {
  return (
    <span
      className="inline-block w-5 h-4 rounded-sm overflow-hidden border border-border"
      style={{
        backgroundImage: `url(https://flagcdn.com/w20/${country.toLowerCase()}.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
      title={getCountryName(country)}
    />
  );
}

// Get country name (simplified - you might want to use a proper i18n solution)
function getCountryName(country: Country): string {
  // Only supported countries
  const supportedCountryNames: Record<string, string> = {
    US: 'United States',
    KH: 'Cambodia',
    PH: 'Philippines',
    CN: 'China',
  };
  
  return supportedCountryNames[country] || country;
}

export { PhoneNumberInput };
