import React, { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  tooltip?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-neon-cyan/10 dark:bg-neon-cyan/20 border-neon-cyan text-neon-cyan hover:bg-neon-cyan/20 dark:hover:bg-neon-cyan/30 glow-cyan transition-colors duration-400',
  secondary: 'bg-slate-100 dark:bg-black/50 border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:text-neon-cyan hover:border-neon-cyan/50 hover:bg-neon-cyan/10 transition-colors duration-400',
  ghost: 'bg-transparent border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800/50 transition-colors duration-400',
  destructive: 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 hover:border-red-400 dark:hover:border-red-500 hover:text-red-700 dark:hover:text-red-300 transition-colors duration-400',
  icon: 'bg-transparent border-transparent text-slate-500 dark:text-zinc-500 hover:text-neon-cyan hover:bg-slate-200 dark:hover:bg-zinc-800/50 p-1.5 transition-colors duration-400'
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-[10px]',
  md: 'px-5 py-2 text-xs',
  lg: 'px-6 py-3 text-sm',
  icon: 'p-2'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className = '', 
    variant = 'secondary', 
    size = 'md', 
    isLoading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    tooltip,
    children, 
    disabled,
    'aria-label': ariaLabel,
    ...props 
  }, ref) => {
    
    const baseClasses = 'inline-flex items-center justify-center font-mono uppercase tracking-widest transition-all duration-300 rounded-sm border focus:outline-none focus:ring-1 focus:ring-neon-cyan/50';
    const activeDisabled = disabled || isLoading;
    const disabledClasses = activeDisabled ? 'opacity-50 cursor-not-allowed shadow-none hover:bg-transparent hover:border-slate-300 dark:hover:border-zinc-700 hover:text-slate-400 dark:hover:text-zinc-500' : 'cursor-pointer';
    const widthClass = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantStyles[variant]} ${sizeStyles[size]} ${disabledClasses} ${widthClass} ${className}`}
        disabled={activeDisabled}
        aria-label={ariaLabel || tooltip || (typeof children === 'string' ? children : undefined)}
        title={tooltip}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>
    );
  }
);
Button.displayName = 'Button';
