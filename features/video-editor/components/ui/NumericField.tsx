import React from 'react';

interface NumericFieldProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  defaultValue?: number;
  onReset?: () => void;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

export const NumericField: React.FC<NumericFieldProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  defaultValue,
  onReset,
  disabled = false,
  className = '',
  compact = false,
}) => {
  const handleReset = () => {
    if (disabled) return;
    if (onReset) onReset();
    else if (defaultValue !== undefined) onChange(defaultValue);
  };

  return (
    <div
      className={`flex items-center justify-between gap-2 select-none ${
        disabled ? 'opacity-40 pointer-events-none' : ''
      } ${className}`}
    >
      {/* Label */}
      <span
        onDoubleClick={handleReset}
        title={defaultValue !== undefined ? `Sıfırlamak için çift tıklayın (${defaultValue}${unit})` : undefined}
        className="text-[11px] text-[#929AA8] font-medium shrink-0 cursor-default truncate w-20"
      >
        {label}
      </span>

      {/* Scrub Slider (if not strictly compact) */}
      {!compact && (
        <div className="flex-1 flex items-center min-w-[60px]">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-1 bg-[#1C212A] rounded-[2px] cursor-pointer"
          />
        </div>
      )}

      {/* Numeric Input with Unit */}
      <div className="relative shrink-0 w-16">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={isNaN(value) ? '' : Number(value.toFixed(2))}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(v);
          }}
          onDoubleClick={handleReset}
          className="w-full h-6 px-1.5 pr-4 rounded-[3px] bg-[#171B21] border border-[#292F39] text-[#E7EAF0] text-xs font-mono text-right outline-none focus:border-[#4f6bf5] transition-colors"
        />
        {unit && (
          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[#5A6270] font-mono pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};
