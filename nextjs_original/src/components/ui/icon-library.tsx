
'use client';

import React from 'react';
import {
  LucideIcon,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  Moon,
  Sunrise,
  Sunset,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube,
  Github
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Icon size presets
export const iconSizes = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  default: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
  '2xl': 'h-10 w-10',
  '3xl': 'h-12 w-12',
} as const;

export type IconSize = keyof typeof iconSizes;

// Icon color presets
export const iconColors = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  primary: 'text-primary',
  secondary: 'text-secondary',
  success: 'text-green-600',
  warning: 'text-yellow-600',
  error: 'text-red-600',
  info: 'text-blue-600',
  accent: 'text-accent-foreground',
} as const;

export type IconColor = keyof typeof iconColors;

// Animated icon wrapper
interface AnimatedIconProps {
  icon: LucideIcon;
  animation?: 'spin' | 'pulse' | 'bounce' | 'wiggle' | 'float';
  size?: IconSize;
  color?: IconColor;
  className?: string;
  speed?: 'slow' | 'default' | 'fast';
}

export function AnimatedIcon({
  icon: Icon,
  animation = 'spin',
  size = 'default',
  color = 'default',
  className,
  speed = 'default'
}: AnimatedIconProps) {
  const animationClasses = {
    spin: 'animate-spin',
    pulse: 'animate-pulse',
    bounce: 'animate-bounce',
    wiggle: 'animate-pulse hover:animate-bounce',
    float: 'animate-bounce hover:animate-pulse',
  };

  const speedClasses = {
    slow: 'animate-[spin_3s_linear_infinite]',
    default: 'animate-spin',
    fast: 'animate-[spin_0.5s_linear_infinite]',
  };

  const speedClass = speedClasses[speed];

  return (
    <Icon className={cn(
      iconSizes[size],
      iconColors[color],
      animation === 'spin' && speed !== 'default' ? speedClass : animationClasses[animation],
      className
    )} />
  );
}

// Icon with badge/badge counter
interface IconWithBadgeProps {
  icon: LucideIcon;
  badge?: string | number;
  badgeColor?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: IconSize;
  color?: IconColor;
  className?: string;
  showZero?: boolean;
}

export function IconWithBadge({
  icon: Icon,
  badge,
  badgeColor = 'error',
  size = 'default',
  color = 'default',
  className,
  showZero = false
}: IconWithBadgeProps) {
  const badgeColors = {
    primary: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    success: 'bg-green-600 text-white',
    warning: 'bg-yellow-600 text-white',
    error: 'bg-red-600 text-white',
  };

  const shouldShowBadge = badge !== undefined && badge !== null &&
    (showZero || (!showZero && badge !== 0 && badge !== '0'));

  return (
    <div className={cn('relative inline-flex', className)}>
      <Icon className={cn(iconSizes[size], iconColors[color])} />
      {shouldShowBadge && (
        <span className={cn(
          'absolute -top-2 -right-2 flex items-center justify-center min-w-[1rem] h-4 px-1 text-xs font-medium rounded-full',
          badgeColors[badgeColor]
        )}>
          {badge}
        </span>
      )}
    </div>
  );
}

// Icon with tooltip
interface IconWithTooltipProps {
  icon: LucideIcon;
  tooltip: string;
  size?: IconSize;
  color?: IconColor;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function IconWithTooltip({
  icon: Icon,
  tooltip,
  size = 'default',
  color = 'default',
  className,
  position = 'top'
}: IconWithTooltipProps) {
  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2',
  };

  return (
    <div className={cn('relative group inline-block', className)}>
      <Icon className={cn(iconSizes[size], iconColors[color])} />
      <div className={cn(
        'absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none',
        positionClasses[position]
      )}>
        {tooltip}
        <div className={cn(
          'absolute w-2 h-2 bg-gray-900 transform rotate-45',
          position === 'top' && 'top-full left-1/2 -translate-x-1/2 -mt-1',
          position === 'bottom' && 'bottom-full left-1/2 -translate-x-1/2 -mb-1',
          position === 'left' && 'left-full top-1/2 -translate-y-1/2 -ml-1',
          position === 'right' && 'right-full top-1/2 -translate-y-1/2 -mr-1',
        )} />
      </div>
    </div>
  );
}

// Loading icon with text
interface LoadingIconProps {
  text?: string;
  size?: IconSize;
  color?: IconColor;
  className?: string;
}

export function LoadingIcon({
  text = 'Loading...',
  size = 'default',
  color = 'primary',
  className
}: LoadingIconProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Loader2 className={cn(iconSizes[size], iconColors[color], 'animate-spin')} />
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </div>
  );
}

// Status icon with label
interface StatusIconProps {
  status: 'success' | 'error' | 'warning' | 'info' | 'loading';
  label?: string;
  size?: IconSize;
  className?: string;
  animated?: boolean;
}

export function StatusIcon({
  status,
  label,
  size = 'default',
  className,
  animated = false
}: StatusIconProps) {
  const statusConfig = {
    success: { icon: CheckCircle, color: 'success' as IconColor },
    error: { icon: XCircle, color: 'error' as IconColor },
    warning: { icon: AlertCircle, color: 'warning' as IconColor },
    info: { icon: Info, color: 'info' as IconColor },
    loading: { icon: Loader2, color: 'primary' as IconColor, animated: true },
  };

  const config = statusConfig[status];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <config.icon className={cn(
        iconSizes[size],
        iconColors[config.color],
        (animated || status === 'loading') && 'animate-spin'
      )} />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

// Icon button group
interface IconButtonGroupProps {
  buttons: Array<{
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    variant?: 'default' | 'outline' | 'ghost';
  }>;
  size?: IconSize;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export function IconButtonGroup({
  buttons,
  size = 'default',
  className,
  orientation = 'horizontal'
}: IconButtonGroupProps) {
  return (
    <div className={cn(
      'flex gap-1',
      orientation === 'horizontal' ? 'flex-row' : 'flex-col',
      className
    )}>
      {buttons.map((button, index) => (
        <button
          key={index}
          onClick={button.onClick}
          disabled={button.disabled}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            button.active && 'bg-primary text-primary-foreground',
            !button.active && 'hover:bg-muted'
          )}
        >
          <button.icon className={iconSizes[size]} />
          <span>{button.label}</span>
        </button>
      ))}
    </div>
  );
}

// Social media icon set
interface SocialIconsProps {
  platforms: Array<'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'youtube' | 'github'>;
  size?: IconSize;
  color?: IconColor;
  className?: string;
}

export function SocialIcons({
  platforms,
  size = 'default',
  color = 'muted',
  className
}: SocialIconsProps) {
  const socialIcons = {
    facebook: Facebook,
    twitter: Twitter,
    instagram: Instagram,
    linkedin: Linkedin,
    youtube: Youtube,
    github: Github,
  };

  return (
    <div className={cn('flex gap-3', className)}>
      {platforms.map((platform) => {
        const Icon = socialIcons[platform];
        return (
          <a
            key={platform}
            href={`https://${platform}.com`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-70 transition-opacity"
          >
            <Icon className={cn(iconSizes[size], iconColors[color])} />
          </a>
        );
      })}
    </div>
  );
}

// Progress icon (for steps, progress indicators)
interface ProgressIconProps {
  status: 'completed' | 'current' | 'pending' | 'error';
  number?: number;
  size?: IconSize;
  className?: string;
}

export function ProgressIcon({
  status,
  number,
  className
}: ProgressIconProps) {
  const statusConfig = {
    completed: { bg: 'bg-green-500', text: 'text-white', icon: 'check' },
    current: { bg: 'bg-primary', text: 'text-primary-foreground', icon: null },
    pending: { bg: 'bg-muted', text: 'text-muted-foreground', icon: null },
    error: { bg: 'bg-red-500', text: 'text-white', icon: 'x' },
  };

  const config = statusConfig[status];

  return (
    <div className={cn(
      'flex items-center justify-center w-8 h-8 rounded-full border-2',
      config.bg,
      className
    )}>
      {number ? (
        <span className={cn('text-sm font-medium', config.text)}>{number}</span>
      ) : (
        <div className={cn('w-2 h-2 rounded-full', config.text.replace('text-', 'bg-'))} />
      )}
    </div>
  );
}

// Icon with text (common pattern)
interface IconWithTextProps {
  icon: LucideIcon;
  text: string;
  size?: IconSize;
  color?: IconColor;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  gap?: 'sm' | 'default' | 'lg';
}

export function IconWithText({
  icon: Icon,
  text,
  size = 'default',
  color = 'default',
  className,
  orientation = 'horizontal',
  gap = 'default'
}: IconWithTextProps) {
  const gapClasses = {
    sm: 'gap-1',
    default: 'gap-2',
    lg: 'gap-3',
  };

  return (
    <div className={cn(
      'flex items-center',
      orientation === 'horizontal' ? 'flex-row' : 'flex-col text-center',
      gapClasses[gap],
      className
    )}>
      <Icon className={cn(iconSizes[size], iconColors[color])} />
      <span className="text-sm">{text}</span>
    </div>
  );
}

// Feature icon (for feature highlights)
interface FeatureIconProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  size?: IconSize;
  color?: IconColor;
  className?: string;
}

export function FeatureIcon({
  icon: Icon,
  title,
  description,
  size = 'lg',
  color = 'primary',
  className
}: FeatureIconProps) {
  return (
    <div className={cn('flex flex-col items-center text-center space-y-2', className)}>
      <div className="p-3 bg-primary/10 rounded-full">
        <Icon className={cn(iconSizes[size], iconColors[color])} />
      </div>
      <div>
        <h4 className="font-medium">{title}</h4>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

// Weather/time based icon
interface ContextualIconProps {
  condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'night' | 'dawn' | 'dusk';
  size?: IconSize;
  color?: IconColor;
  className?: string;
}

export function ContextualIcon({
  condition,
  size = 'default',
  color = 'default',
  className
}: ContextualIconProps) {
  const conditionIcons = {
    sunny: Sun,
    cloudy: Cloud,
    rainy: CloudRain,
    snowy: CloudSnow,
    night: Moon,
    dawn: Sunrise,
    dusk: Sunset,
  };

  const Icon = conditionIcons[condition];

  return (
    <Icon className={cn(iconSizes[size], iconColors[color], className)} />
  );
}

// Icon grid for dashboards
interface IconGridProps {
  items: Array<{
    icon: LucideIcon;
    label: string;
    value?: string | number;
    color?: IconColor;
    onClick?: () => void;
  }>;
  columns?: 2 | 3 | 4 | 5 | 6;
  size?: IconSize;
  className?: string;
}

export function IconGrid({
  items,
  columns = 3,
  size = 'lg',
  className
}: IconGridProps) {
  return (
    <div className={cn(
      `grid grid-cols-${columns} gap-4`,
      className
    )}>
      {items.map((item, index) => (
        <div
          key={index}
          className="flex flex-col items-center text-center space-y-2 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={item.onClick}
        >
          <item.icon className={cn(iconSizes[size], iconColors[item.color || 'default'])} />
          <div>
            <p className="font-medium text-sm">{item.label}</p>
            {item.value && (
              <p className="text-xs text-muted-foreground">{item.value}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Export all icon utilities
export const IconUtils = {
  sizes: iconSizes,
  colors: iconColors,
  AnimatedIcon,
  IconWithBadge,
  IconWithTooltip,
  LoadingIcon,
  StatusIcon,
  IconButtonGroup,
  SocialIcons,
  ProgressIcon,
  IconWithText,
  FeatureIcon,
  ContextualIcon,
  IconGrid,
};

// Custom icons for this app
export const CustomIcons = {
  // Add any custom SVG icons here if needed
}
