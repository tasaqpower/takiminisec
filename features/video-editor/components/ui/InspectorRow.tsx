import React from 'react';
import { RotateCcw } from 'lucide-react';

interface InspectorRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  defaultValue?: number;
  onChange: (val: number) => void;
  tooltip?: string;
}

export const InspectorRow: React.FC<InspectorRowProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  defaultValue,
  onChange,
  tooltip,
}) => {
  const isModified = defaultValue !== undefined && Math.abs(value - defaultValue) > 0.0001;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      onChange(clamped);
    }
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (defaultValue !== undefined) {
      onChange(defaultValue);
    }
  };

  // Format displayed number (up to 2 decimals)
  const displayVal = Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/\.?0+$/, '');

  return (
    <div className="flex items-center gap-2 py-1 px-3 text-[11px] hover:bg-[#161a22] transition-colors group">
      {/* Label */}
      <span
        title={tooltip || label}
        className="w-20 shrink-0 text-gray-400 group-hover:text-gray-300 truncate font-medium"
      >
        {label}
      </span>

      {/* Slider */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 bg-[#242a37] rounded-sm cursor-pointer accent-indigo-500"
      />

      {/* Numeric Input + Unit */}
      <div className="flex items-center w-16 h-6 px-1.5 rounded bg-[#1a1e27] border border-[#2b3240] focus-within:border-indigo-500 transition-colors">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={displayVal}
          onChange={handleInputChange}
          className="w-full bg-transparent text-right font-mono text-[11px] text-gray-200 outline-none"
        />
        {unit && <span className="ml-0.5 text-[10px] text-gray-500 font-mono select-none">{unit}</span>}
      </div>

      {/* Reset icon button */}
      <div className="w-4 h-4 flex items-center justify-center shrink-0">
        {isModified && (
          <button
            type="button"
            onClick={handleReset}
            title="Varsayılana Sıfırla"
            className="text-gray-500 hover:text-indigo-400 transition-colors"
          >
            <RotateCcw size={11} />
          </button>
        )}
      </div>
    </div>
  );
};
