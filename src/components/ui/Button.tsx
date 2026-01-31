import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = cn(
      'inline-flex items-center justify-center gap-2 font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive-accent focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'rounded-md'
    );

    const variantStyles = {
      default: cn(
        'bg-interactive-normal text-text-normal',
        'hover:bg-interactive-hover',
        'active:bg-interactive-accent active:text-white'
      ),
      primary: cn(
        'bg-interactive-accent text-white',
        'hover:brightness-110',
        'active:brightness-90'
      ),
      secondary: cn(
        'bg-background-secondary text-text-normal',
        'border border-background-modifier-border',
        'hover:bg-background-modifier-hover',
        'active:bg-background-modifier-active'
      ),
      ghost: cn(
        'bg-transparent text-text-normal',
        'hover:bg-background-modifier-hover',
        'active:bg-background-modifier-active'
      ),
      destructive: cn(
        'bg-red-600 text-white',
        'hover:bg-red-700',
        'active:bg-red-800'
      ),
    };

    const sizeStyles = {
      sm: 'h-7 px-2.5 text-xs',
      md: 'h-9 px-4 text-sm',
      lg: 'h-11 px-6 text-base',
      icon: 'h-9 w-9 p-0',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
