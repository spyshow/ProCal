export function IsometricBuilding() {

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none opacity-45 sm:opacity-65 transition-opacity">
      <svg
        viewBox="0 0 1400 900"
        className="w-full h-full object-cover sm:object-contain object-right-top"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Isometric Gradients */}
          <linearGradient id="isoWallLeft" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
          </linearGradient>

          <linearGradient id="isoWallRight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#1e293b" stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id="isoRoof" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#1e293b" stopOpacity="0.95" />
          </linearGradient>

          <linearGradient id="windowGlowOrange" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ea580c" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.3" />
          </linearGradient>

          <linearGradient id="windowGlowCyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.2" />
          </linearGradient>

          <linearGradient id="substationGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ea580c" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.3" />
          </linearGradient>

          <filter id="neonBlur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient Grid Floor */}
        <g opacity="0.35">
          {Array.from({ length: 12 }).map((_, i) => (
            <line
              key={`grid-x-${i}`}
              x1={600 + i * 70}
              y1={500 - i * 35}
              x2={1400}
              y2={900 - i * 35}
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
          ))}
          {Array.from({ length: 12 }).map((_, i) => (
            <line
              key={`grid-y-${i}`}
              x1={600 + i * 70}
              y1={500 + i * 35}
              x2={200 + i * 70}
              y2={700 + i * 35}
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
          ))}
        </g>

        {/* --- Primary Isometric Residential/Commercial Tower --- */}
        {/* Foundation Base */}
        <path
          d="M 1050 560 L 1230 650 L 1050 740 L 870 650 Z"
          fill="#0f172a"
          stroke="#475569"
          strokeWidth="1.5"
          opacity="0.9"
        />

        {/* Tower Floors 1 to 6 */}
        {Array.from({ length: 6 }).map((_, floor) => {
          const yOff = floor * 55;
          const isTop = floor === 5;
          return (
            <g key={`floor-${floor}`} transform={`translate(0, -${yOff})`}>
              {/* Left Wall Facet */}
              <path
                d="M 870 650 L 1050 740 L 1050 685 L 870 595 Z"
                fill="url(#isoWallLeft)"
                stroke="#334155"
                strokeWidth="1"
              />
              {/* Right Wall Facet */}
              <path
                d="M 1050 740 L 1230 650 L 1230 595 L 1050 685 Z"
                fill="url(#isoWallRight)"
                stroke="#475569"
                strokeWidth="1"
              />
              {/* Floor Slab Division Line */}
              <path
                d="M 870 595 L 1050 685 L 1230 595"
                stroke="#64748b"
                strokeWidth="1.5"
                fill="none"
              />

              {/* Illuminated Windows (Left Facet) */}
              {Array.from({ length: 4 }).map((_, w) => {
                const wx = 895 + w * 35;
                const wy = 625 + w * 17.5;
                const isGlow = (floor + w) % 3 === 0;
                const dur = `${2.4 + (w % 3) * 0.6 + (floor % 2) * 0.4}s`;
                return (
                  <path
                    key={`w-left-${floor}-${w}`}
                    d={`M ${wx} ${wy} L ${wx + 22} ${wy + 11} L ${wx + 22} ${wy - 18} L ${wx} ${wy - 29} Z`}
                    fill={isGlow ? 'url(#windowGlowOrange)' : '#090d16'}
                    stroke={isGlow ? '#f97316' : '#1e293b'}
                    strokeWidth="0.8"
                    opacity={isGlow ? 0.9 : 0.6}
                  >
                    {isGlow && (
                      <animate
                        attributeName="opacity"
                        values="0.9;0.35;0.9"
                        dur={dur}
                        repeatCount="indefinite"
                      />
                    )}
                  </path>
                );
              })}

              {/* Illuminated Windows (Right Facet) */}
              {Array.from({ length: 4 }).map((_, w) => {
                const wx = 1075 + w * 35;
                const wy = 672 - w * 17.5;
                const isGlow = (floor + w + 1) % 2 === 0;
                const dur = `${2.8 + (w % 2) * 0.7 + (floor % 3) * 0.3}s`;
                return (
                  <path
                    key={`w-right-${floor}-${w}`}
                    d={`M ${wx} ${wy} L ${wx + 22} ${wy - 11} L ${wx + 22} ${wy - 40} L ${wx} ${wy - 29} Z`}
                    fill={isGlow ? 'url(#windowGlowCyan)' : '#090d16'}
                    stroke={isGlow ? '#38bdf8' : '#1e293b'}
                    strokeWidth="0.8"
                    opacity={isGlow ? 0.85 : 0.6}
                  >
                    {isGlow && (
                      <animate
                        attributeName="opacity"
                        values="0.85;0.3;0.85"
                        dur={dur}
                        repeatCount="indefinite"
                      />
                    )}
                  </path>
                );
              })}

              {/* Roof Cap on Top Floor */}
              {isTop && (
                <g transform="translate(0, -55)">
                  {/* Roof Top Diamond */}
                  <path
                    d="M 1050 560 L 1230 650 L 1050 740 L 870 650 Z"
                    fill="url(#isoRoof)"
                    stroke="#ea580c"
                    strokeWidth="2"
                  />
                  {/* Rooftop HVAC & Transformer Unit */}
                  <path
                    d="M 1000 625 L 1070 660 L 1070 620 L 1000 585 Z"
                    fill="#1e293b"
                    stroke="#f59e0b"
                    strokeWidth="1"
                  />
                  <path
                    d="M 1070 660 L 1120 635 L 1120 595 L 1070 620 Z"
                    fill="#334155"
                    stroke="#f59e0b"
                    strokeWidth="1"
                  />
                  <path
                    d="M 1000 585 L 1070 620 L 1120 595 L 1050 560 Z"
                    fill="#475569"
                    stroke="#f59e0b"
                    strokeWidth="1"
                  />
                  {/* Antenna / Lightning Rod with Glow Beacon */}
                  <line
                    x1="1050"
                    y1="560"
                    x2="1050"
                    y2="460"
                    stroke="#ea580c"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx="1050"
                    cy="460"
                    r="5"
                    fill="#f97316"
                    filter="url(#neonBlur)"
                  />
                  <circle
                    cx="1050"
                    cy="460"
                    r="8"
                    stroke="#f59e0b"
                    strokeWidth="1"
                    opacity="0.6"
                  >
                    <animate
                      attributeName="r"
                      values="4;12;4"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.9;0.1;0.9"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </g>
              )}
            </g>
          );
        })}

        {/* --- Substation & Transformer Pad (Base of the Building) --- */}
        <g id="substation-transformer">
          {/* Substation Enclosure Box */}
          <path
            d="M 760 690 L 850 735 L 850 675 L 760 630 Z"
            fill="url(#isoWallLeft)"
            stroke="#ea580c"
            strokeWidth="1.5"
          />
          <path
            d="M 850 735 L 920 700 L 920 640 L 850 675 Z"
            fill="url(#isoWallRight)"
            stroke="#ea580c"
            strokeWidth="1.5"
          />
          <path
            d="M 760 630 L 850 675 L 920 640 L 830 595 Z"
            fill="url(#isoRoof)"
            stroke="#ea580c"
            strokeWidth="1.5"
          />

          {/* Substation Warning Hazard Decal */}
          <polygon
            points="805,675 815,690 795,690"
            fill="#f59e0b"
            stroke="#000"
            strokeWidth="0.5"
          />

          {/* Main Substation Output Busway Port */}
          <ellipse
            cx="760"
            cy="680"
            rx="12"
            ry="7"
            fill="#0f172a"
            stroke="#f97316"
            strokeWidth="2"
          />

          {/* Glowing Energy Discharge Ring at Cable Origin */}
          <circle
            cx="760"
            cy="680"
            r="16"
            stroke="#ea580c"
            strokeWidth="1.5"
            fill="none"
            filter="url(#neonBlur)"
            opacity="0.8"
          />
        </g>
      </svg>
    </div>
  );
}
