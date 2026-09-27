import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'subtle' | 'primary' | 'accent' | 'danger' | 'active';
  tooltip?: string;
  shortcut?: string;
  badge?: number | string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      label,
      size = 'md',
      variant = 'ghost',
      tooltip,
      shortcut,
      badge,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      xs: 'w-5 h-5 text-[11px] p-0.5',
      sm: 'w-6 h-6 text-xs p-1',
      md: 'w-7 h-7 text-sm p-1.5',
      lg: 'w-8 h-8 text-base p-1.5',
    }[size];

    const variantClasses = {
      ghost:
        'text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#171B21] active:bg-[#202631]',
      subtle:
        'bg-[#171B21] text-[#E7EAF0] hover:bg-[#202631] border border-[#292F39]',
      primary:
        'bg-[#4f6bf5] text-white hover:bg-[#3b55d9] active:bg-[#2e47c7] border border-[#4f6bf5]/60',
      accent:
        'bg-[#4f6bf5]/15 text-[#b0c2ff] hover:bg-[#4f6bf5]/25 border border-[#4f6bf5]/40',
      danger:
        'text-[#929AA8] hover:text-red-300 hover:bg-red-950/40 active:bg-red-900/50',
      active:
        'bg-[#202631] text-[#E7EAF0] border border-[#4f6bf5]/50',
    }[variant];

    const displayTitle = tooltip || label ? `${tooltip || label}${shortcut ? ` (${shortcut})` : ''}` : undefined;

    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={displayTitle}
        disabled={disabled}
        className={`relative inline-flex items-center justify-center rounded-[3px] font-medium transition-colors shrink-0 select-none outline-none focus-visible:ring-1 focus-visible:ring-[#4f6bf5] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        <span className="flex items-center justify-center pointer-events-none">{icon}</span>
        {badge !== undefined && (
          <span className="absolute -top-1 -right-1 px-1 min-w-[14px] h-[14px] rounded-full bg-indigo-600 text-[9px] font-bold text-white flex items-center justify-center border border-[#13161c]">
            {badge}
          </span>
        )}
      </button>
    );
  }
);

IconButton.displayName = 'IconButton';
