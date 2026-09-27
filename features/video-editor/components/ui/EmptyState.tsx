import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-6 text-center rounded-lg border border-dashed border-[#242b38] bg-[#101319]/40 ${className}`}
    >
      <div className="w-10 h-10 rounded-md bg-[#161a22] border border-[#232835] text-gray-400 flex items-center justify-center mb-3 shadow-inner">
        {icon}
      </div>
      <h4 className="text-xs font-semibold text-gray-200 mb-1">{title}</h4>
      {description && <p className="text-[11px] text-gray-500 max-w-xs mb-3">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};
