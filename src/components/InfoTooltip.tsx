'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

export interface InfoTooltipProps {
  label: string;
  helper: string;
  iconSize?: number;
  className?: string;
}

export default function InfoTooltip({
  label,
  helper,
  iconSize = 14,
  className = '',
}: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 6,
        left: rect.left + rect.width / 2,
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current && !tooltipRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleScroll = (event: Event) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onMouseEnter={() => { updatePosition(); setIsOpen(true); }}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => { updatePosition(); setIsOpen(true); }}
        onBlur={() => setIsOpen(false)}
        className={`inline-flex items-center justify-center rounded text-gray-500 hover:text-orange-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 transition-colors ${className}`}
        aria-label={`${label} info`}
      >
        <Info size={iconSize} />
      </button>

      {isOpen && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          className="fixed z-[9999] max-w-xs -translate-x-1/2 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-3 text-left"
          style={{ top: position.top, left: position.left }}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          <p className="text-xs font-semibold text-gray-200 mb-1">{label}</p>
          <p className="text-[11px] text-gray-400 leading-relaxed">{helper}</p>
        </div>,
        document.body
      )}
    </>
  );
}
