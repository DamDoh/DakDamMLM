
'use client';

import { CheckCircle, XCircle } from 'lucide-react';
import { useI18n } from '@/lib/internationalization';

interface PasswordStrength {
  strength: number;
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

export const getPasswordStrength = (password: string): PasswordStrength => {
  let strength = 0;
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  strength = Object.values(checks).filter(Boolean).length;
  return { strength, checks };
};

interface PasswordStrengthIndicatorProps {
  password?: string;
}

export default function PasswordStrengthIndicator({ password = '' }: PasswordStrengthIndicatorProps) {
  const { t } = useI18n();
  const { strength, checks } = getPasswordStrength(password);

  if (!password) {
    return null;
  }

  const strengthLabels = {
    0: t('register.passwordStrength.weak'),
    1: t('register.passwordStrength.weak'),
    2: t('register.passwordStrength.weak'),
    3: t('register.passwordStrength.fair'),
    4: t('register.passwordStrength.good'),
    5: t('register.passwordStrength.strong'),
  };

  const strengthColors = {
    0: 'bg-red-500',
    1: 'bg-red-500',
    2: 'bg-red-500',
    3: 'bg-yellow-500',
    4: 'bg-blue-500',
    5: 'bg-green-500',
  };

  const Requirement = ({ label, met }: { label: string; met: boolean }) => (
    <div className={`flex items-center gap-1 text-xs ${met ? 'text-green-600' : 'text-muted-foreground'}`}>
      {met ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </div>
  );

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${strengthColors[strength as keyof typeof strengthColors]}`}
            style={{ width: `${(strength / 5) * 100}%` }}
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {strengthLabels[strength as keyof typeof strengthLabels]}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs">
        <Requirement label={t('register.passwordRequirement.length')} met={checks.length} />
        <Requirement label={t('register.passwordRequirement.uppercase')} met={checks.uppercase} />
        <Requirement label={t('register.passwordRequirement.lowercase')} met={checks.lowercase} />
        <Requirement label={t('register.passwordRequirement.number')} met={checks.number} />
        <Requirement label={t('register.passwordRequirement.special')} met={checks.special} />
      </div>
    </div>
  );
}
