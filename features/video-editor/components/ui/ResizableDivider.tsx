import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ResizableDividerProps {
  direction: 'horizontal' | 'vertical'; // vertical = vertical line (drags left/right), horizontal = horizontal line (drags up/down)
  onResize: (delta: number, clientPos: number) => void;
  onReset?: () => void;
  className?: string;
  title?: string;
}

export const ResizableDivider: React.FC<ResizableDividerProps> = ({
  direction,
  onResize,
  onReset,
  className = '',
  title = 'Yeniden boyutlandırmak için sürükleyin (Sıfırlamak için çift tıklayın)',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef(0);

  const isVertical = direction === 'vertical';

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    startPosRef.current = isVertical ? e.clientX : e.clientY;

    document.body.classList.add(isVertical ? 'forma-editor-resizing-active' : 'forma-editor-resizing-active-v');

    const handlePointerMove = (moveEvt: PointerEvent) => {
      const currentPos = isVertical ? moveEvt.clientX : moveEvt.clientY;
      const delta = currentPos - startPosRef.current;
      startPosRef.current = currentPos;
      onResize(delta, currentPos);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      document.body.classList.remove('forma-editor-resizing-active', 'forma-editor-resizing-active-v');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onReset?.();
  };

  return (
    <div
      role="separator"
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
      title={title}
      className={`relative group shrink-0 select-none touch-none transition-colors ${
        isVertical
          ? 'w-[5px] -mx-[2px] cursor-col-resize h-full z-20'
          : 'h-[5px] -my-[2px] cursor-row-resize w-full z-20'
      } ${className}`}
    >
      {/* Visual hair-line */}
      <div
        className={`absolute inset-0 m-auto transition-all ${
          isVertical ? 'w-[1px] h-full' : 'h-[1px] w-full'
        } ${
          isDragging
            ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]'
            : 'bg-[#242a37] group-hover:bg-indigo-400/80'
        }`}
      />
      {/* Subtle grab indicator dot on hover */}
      <div
        className={`absolute inset-0 m-auto w-1 h-3 rounded-full bg-gray-400 opacity-0 group-hover:opacity-70 transition-opacity ${
          isVertical ? '' : 'rotate-90'
        } ${isDragging ? 'opacity-100 !bg-indigo-400' : ''}`}
      />
    </div>
  );
};
