import React from 'react';

interface ToolRailButtonProps {
  id: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  label: string;
  isActive: boolean;
  onClick: () => void;
  shortcut?: string;
  className?: string;
}

export const ToolRailButton: React.FC<ToolRailButtonProps> = ({
  id,
  icon: Icon,
  label,
  isActive,
  onClick,
  shortcut,
  className = '',
}) => {
  return (
    <button
      type="button"
      data-rail-tab={id}
      data-testid={`rail-tab-${id}`}
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`w-full h-11 px-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors select-none ${
        isActive
          ? 'bg-[#181D26] text-[#E7EAF0] border-l-2 border-[#4f6bf5]'
          : 'text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#141820]'
      } ${className}`}
    >
      <Icon size={16} className={isActive ? 'text-[#4f6bf5]' : 'text-[#929AA8]'} />
      <span className="text-[9px] font-medium leading-none tracking-tight truncate max-w-full">
        {label}
      </span>
    </button>
  );
};
