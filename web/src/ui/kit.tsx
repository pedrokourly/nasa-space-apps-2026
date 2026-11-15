import type { ButtonHTMLAttributes, HTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from './cn';

/**
 * Base components with the shadcn/ui API (variant and size props), styled by `kit.css`.
 * Plain CSS classes instead of Tailwind; no extra dependency.
 */

export type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

export function Button({ variant = 'default', size = 'default', block, className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn('ui-btn', `ui-btn--${variant}`, size !== 'default' && `ui-btn--${size}`, block && 'ui-btn--block', className)}
      {...props}
    />
  );
}

export type BadgeVariant = 'success' | 'destructive' | 'warning' | 'outline';

export function Badge({ variant = 'outline', className, ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return <span className={cn('ui-badge', `ui-badge--${variant}`, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('ui-select', className)} {...props} />;
}
