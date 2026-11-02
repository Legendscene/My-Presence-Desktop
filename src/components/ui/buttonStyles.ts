import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'outline' | 'text';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'fab';

export type ButtonClassOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  active?: boolean;
  loading?: boolean;
  iconOnly?: boolean;
  fullWidth?: boolean;
  className?: string;
};

// Lives apart from Button.tsx so that module only exports components, which is
// what React Fast Refresh needs to swap them without a full reload.
export function buttonClassName({
  variant = 'secondary',
  size = 'md',
  active = false,
  loading = false,
  iconOnly = false,
  fullWidth = false,
  className
}: ButtonClassOptions = {}) {
  return clsx(
    'ui-button',
    `ui-button--${variant}`,
    `ui-button--${size}`,
    {
      'is-active': active,
      'is-loading': loading,
      'is-icon-only': iconOnly || size === 'icon' || size === 'fab',
      'is-full-width': fullWidth
    },
    className
  );
}