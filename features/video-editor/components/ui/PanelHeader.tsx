import React from 'react';
import { X } from 'lucide-react';

interface PanelHeaderProps {
  title: string;
  badge?: string | number;
  onClose?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  title,
  badge,
  onClose,
  actions,
  className = '',
}) => {
  return (
    <div
      className={`h-9 px-3 border-b border-[#292F39] bg-[#111419] flex items-center justify-between shrink-0 select-none ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-semibold text-[#E7EAF0] uppercase tracking-wide truncate">
          {title}
        </span>
        {badge !== undefined && (
          <span className="px-1.5 py-0.2 rounded-[2px] bg-[#171B21] border border-[#292F39] text-[10px] text-[#929AA8] font-mono leading-tight">
            {badge}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {actions}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Paneli Kapat"
            className="w-6 h-6 rounded-[3px] text-[#929AA8] hover:text-[#E7EAF0] hover:bg-[#171B21] flex items-center justify-center transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
};
