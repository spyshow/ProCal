import React from 'react';

interface ProCalLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
  variant?: 'symbol' | 'lockup';
  monoColor?: string;
}

/**
 * Official ProCal Brand Logo — The Phase Monogram
 * Represents 3-phase power distribution (L1, L2, L3 busbars)
 * with a vertical feeder stem and 45° chamfered terminal lug.
 */
export function ProCalLogo({
  size = 24,
  className = '',
  variant = 'symbol',
  monoColor,
  ...props
}: ProCalLogoProps) {
  if (variant === 'lockup') {
    return (
      <svg
        width={size * 3.43}
        height={size}
        viewBox="0 0 880 256"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="ProCal"
        className={className}
        {...props}
      >
        <g transform="translate(36, 34) scale(0.74)">
          <path d="M 44 28 H 92 V 204 L 68 228 H 44 Z" fill={monoColor || '#0f172a'} />
          <path
            fill={monoColor || '#ea580c'}
            fillRule="evenodd"
            d="M 92 28 H 156 C 189.1 28 216 54.9 216 88 C 216 121.1 189.1 148 156 148 H 92 V 122 H 152 C 170.8 122 186 106.8 186 88 C 186 69.2 170.8 54 152 54 H 92 Z"
          />
          <path
            d="M 92 74 H 144 C 151.7 74 158 80.3 158 88 C 158 95.7 151.7 102 144 102 H 92 Z"
            fill={monoColor || '#f59e0b'}
          />
        </g>
        <g fill={monoColor || '#0f172a'}>
          <text
            x="248"
            y="150"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="104"
            fontWeight="800"
            letterSpacing="-2"
          >
            Pro<tspan fill={monoColor || '#ea580c'} fontWeight="500">Cal</tspan>
          </text>
          <text
            x="252"
            y="186"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="16"
            fontWeight="600"
            letterSpacing="1.5"
            fill={monoColor ? 'currentColor' : '#64748b'}
          >
            Low Voltage Electrical Design,{' '}
            <tspan fill={monoColor || '#ea580c'} fontWeight="700">
              Solved
            </tspan>
          </text>
        </g>
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="ProCal"
      className={className}
      {...props}
    >
      {/* Master Vertical Feeder Busbar */}
      <path
        d="M 44 28 H 92 V 204 L 68 228 H 44 Z"
        fill={monoColor || 'currentColor'}
        className={monoColor ? undefined : 'text-slate-900 dark:text-slate-200'}
      />
      {/* Outer Phase Loop (ABB Industrial Orange) */}
      <path
        fill={monoColor || '#ea580c'}
        fillRule="evenodd"
        d="M 92 28 H 156 C 189.1 28 216 54.9 216 88 C 216 121.1 189.1 148 156 148 H 92 V 122 H 152 C 170.8 122 186 106.8 186 88 C 186 69.2 170.8 54 152 54 H 92 Z"
      />
      {/* Middle Phase Conductor Tap (Electric Amber) */}
      <path
        d="M 92 74 H 144 C 151.7 74 158 80.3 158 88 C 158 95.7 151.7 102 144 102 H 92 Z"
        fill={monoColor || '#f59e0b'}
      />
    </svg>
  );
}
export default ProCalLogo;
