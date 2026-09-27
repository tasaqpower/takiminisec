import React, { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';

interface InspectorSectionProps {
  title: string;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  onReset?: () => void;
  badge?: string | number;
  children: React.ReactNode;
  className?: string;
}

export const InspectorSection: React.FC<InspectorSectionProps> = ({
  title,
  defaultOpen = true,
  isOpen: controlledIsOpen,
  onToggle,
  onReset,
  badge,
  children,
  className = '',
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isExpanded = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;

  const handleHeaderClick = () => {
    if (onToggle) onToggle();
    else setInternalOpen((prev) => !prev);
  };

  return (
    <div className={`border-b border-[#292F39] bg-[#111419] ${className}`}>
      {/* Section Header */}
      <div
        onClick={handleHeaderClick}
        className="h-8 px-3 flex items-center justify-between cursor-pointer select-none hover:bg-[#151921] transition-colors"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[#929AA8] text-xs">
            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
          <span className="text-[11px] font-semibold tracking-wider uppercase text-[#E7EAF0] truncate">
            {title}
          </span>
          {badge !== undefined && (
            <span className="px-1 py-0.2 rounded-[2px] bg-[#171B21] border border-[#292F39] text-[9px] text-[#929AA8] font-mono leading-none">
              {badge}
            </span>
          )}
        </div>

        {onReset && isExpanded && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
            title="Bölümü Varsayılana Sıfırla"
            className="p-1 rounded-[3px] text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#171B21] transition-colors"
          >
            <RotateCcw size={11} />
          </button>
        )}
      </div>

      {/* Section Content */}
      {isExpanded && <div className="p-3 pt-2 space-y-2.5">{children}</div>}
    </div>
  );
};
