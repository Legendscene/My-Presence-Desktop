import { Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { forwardRef, useCallback, useRef, type ButtonHTMLAttributes, type MouseEvent, type MutableRefObject, type ReactNode } from 'react';
import { buttonClassName, type ButtonClassOptions } from './buttonStyles';

export type { ButtonSize, ButtonVariant } from './buttonStyles';

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> &
  ButtonClassOptions & {
    children: ReactNode;
    rotateIconOnHover?: boolean;
    magnetic?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    active = false,
    loading = false,
    iconOnly = false,
    fullWidth = false,
    rotateIconOnHover = false,
    magnetic = false,
    className,
    children,
    disabled,
    type = 'button',
    onClick,
    ...props
  },
  ref
) {
  const resolvedDisabled = disabled || loading;
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const combinedRef = useCallback((node: HTMLButtonElement | null) => {
    btnRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as MutableRefObject<HTMLButtonElement | null>).current = node;
  }, [ref]);

  const handleClick = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    // Ripple is decoration only — never swallow the user's handler, and skip it
    // when the button is disabled or the visitor asked for reduced motion.
    if (e.defaultPrevented || resolvedDisabled) return;
    const btn = btnRef.current;
    if (!btn || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const rect = btn.getBoundingClientRect();
    const diameter = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${diameter}px`;
    ripple.style.left = `${e.clientX - rect.left - diameter / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - diameter / 2}px`;
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }, [resolvedDisabled, onClick]);

  return (
    <button
      {...props}
      ref={combinedRef}
      type={type}
      className={buttonClassName({
        variant,
        size,
        active,
        loading,
        iconOnly,
        fullWidth,
        className: clsx(className, magnetic && 'magnetic')
      })}
      disabled={resolvedDisabled}
      aria-busy={loading || undefined}
      data-rotate-icon={rotateIconOnHover ? 'true' : undefined}
      onClick={handleClick}
    >
      <span className="ui-button__content">{children}</span>
      {loading ? <Loader2 className="ui-button__spinner" size={16} aria-hidden="true" /> : null}
    </button>
  );
});