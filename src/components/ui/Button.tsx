import React from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const variantClasses: Record<Variant, string> = {
  primary: 'bg-[#059669] hover:bg-[#047857] text-white border border-transparent',
  secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300',
  danger: 'bg-red-600 hover:bg-red-700 text-white border border-transparent',
  ghost: 'bg-transparent hover:bg-slate-100 text-slate-700 border border-transparent',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  leftIcon?: React.ReactNode;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  leftIcon,
  size = 'md',
  fullWidth,
  isLoading,
  className = '',
  children,
  disabled,
  ...props
}) => {
  const sizeClasses = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-xs';
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${fullWidth ? 'w-full justify-center' : ''} ${sizeClasses} ${variantClasses[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" aria-hidden="true" />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      {children}
    </button>
  );
};

export default Button;
