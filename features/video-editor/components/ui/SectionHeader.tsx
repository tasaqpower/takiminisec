import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  isOpen?: boolean;
  defaultOpen?: boolean;
  onToggle?: () => void;
  badge?: string | number;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  isOpen: controlledIsOpen,
  defaultOpen = true,
  onToggle,
  badge,
  action,
  icon,
  children,
  className = '',
  contentClassName = '',
}) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    }
    if (controlledIsOpen === undefined) {
      setInternalOpen(!internalOpen);
    }
  };

  return (
    <div className={`select-none ${className}`}>
      <div className="flex items-center justify-between py-1.5 px-3 bg-[#13161c] border-b border-[#202532] hover:bg-[#181c24] transition-colors group">
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-2 flex-1 text-left min-w-0"
        >
          <span className="text-gray-500 group-hover:text-gray-300 transition-colors">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          {icon && <span className="text-gray-400 group-hover:text-gray-200">{icon}</span>}
          <span className="text-[11px] font-semibold tracking-wider uppercase text-gray-300 group-hover:text-white truncate">
            {title}
          </span>
          {badge !== undefined && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1c212c] text-gray-400 border border-[#2b3342]">
              {badge}
            </span>
          )}
        </button>
        {action && <div className="shrink-0 ml-2">{action}</div>}
      </div>
      {isOpen && children && (
        <div className={contentClassName}>
          {children}
        </div>
      )}
    </div>
  );
};
