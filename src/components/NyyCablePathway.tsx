'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';

export function NyyCablePathway() {
  const [pathStr, setPathStr] = useState<string>('');
  const [svgDimensions, setSvgDimensions] = useState({ width: 1400, height: 3000 });
  const [scrollProgress, setScrollProgress] = useState(0);
  const animFrameRef = useRef<number | null>(null);

  const updateCoordinates = useCallback(() => {
    if (typeof window === 'undefined') return;

    const originEl = document.getElementById('building-cable-origin');
    const targetEl = document.getElementById('pg48-cable-inlet');

    const rootEl = document.documentElement;
    const bodyEl = document.body;
    const fullWidth = Math.max(rootEl.clientWidth, window.innerWidth || 1200);
    const fullHeight = Math.max(rootEl.scrollHeight, bodyEl.scrollHeight, 2800);

    setSvgDimensions((prev) => (prev.width === fullWidth && prev.height === fullHeight ? prev : { width: fullWidth, height: fullHeight }));

    if (!originEl || !targetEl) return;

    const originRect = originEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const scrollY = window.pageYOffset || rootEl.scrollTop || 0;
    const scrollX = window.pageXOffset || rootEl.scrollLeft || 0;

    // 1. Origin: Starts high up behind the building tower
    const x1 = originRect.left + originRect.width / 2 + scrollX;
    const y1 = originRect.top + originRect.height / 2 + scrollY;

    // 2. Target: Lands straight into PG-48 gland top center
    const x2 = targetRect.left + targetRect.width / 2 + scrollX;
    const y2 = targetRect.top + scrollY + 4;

    const dy = y2 - y1;

    // Smooth industrial power route:
    const cp1x = Math.min(fullWidth - 35, x1 + Math.max(60, (fullWidth - x1) * 0.75));
    const cp1y = y1 + dy * 0.25;

    const cp2x = Math.min(fullWidth - 25, x1 + Math.max(80, (fullWidth - x1) * 0.88));
    const cp2y = y1 + dy * 0.48;

    const cp3x = Math.max(35, x2 - Math.min(380, fullWidth * 0.4));
    const cp3y = y1 + dy * 0.74;

    const cp4x = x2 - 50;
    const cp4y = y2 - 130;

    const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${fullWidth * 0.46} ${y1 + dy * 0.58} C ${cp3x} ${cp3y}, ${cp4x} ${cp4y}, ${x2} ${y2}`;

    setPathStr(d);

    // Scroll calculation
    const scrollTop = window.scrollY || rootEl.scrollTop || 0;
    const panelTop = targetRect.top + scrollTop;
    const startScroll = Math.max(0, y1 - 200);
    const endScroll = Math.max(startScroll + 100, panelTop - window.innerHeight * 0.6);
    const progress = Math.min(1, Math.max(0, (scrollTop - startScroll) / (endScroll - startScroll)));
    setScrollProgress((prev) => (Math.abs(prev - progress) > 0.005 ? progress : prev));
  }, []);

  useEffect(() => {
    // Initial calculation after DOM ready
    const initTimer = setTimeout(() => {
      updateCoordinates();
    }, 100);

    const handleScrollOrResize = () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(updateCoordinates);
    };

    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    window.addEventListener('scroll', handleScrollOrResize, { passive: true });

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [updateCoordinates]);

  if (!pathStr) return null;

  return (
    /* Background layer behind content at z-0 */
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none">
      <svg
        className="w-full h-full"
        style={{ minHeight: `${svgDimensions.height}px` }}
        viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* NYY-F Heavy PVC Outer Jacket Gradient */}
          <linearGradient id="nyySheathGradV3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#080d1a" />
            <stop offset="25%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#334155" />
            <stop offset="75%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#080d1a" />
          </linearGradient>

          {/* 3D Cylindrical Highlight */}
          <linearGradient id="nyySheenGradV3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="40%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Glowing Neon Power Pulse Filter */}
          <filter id="nyyNeonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur1" />
            <feGaussianBlur stdDeviation="2" result="blur2" />
            <feMerge>
              <feMergeNode in="blur1" />
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. Ambient Drop Shadow (Full length from high behind building to PG-48) */}
        <path
          d={pathStr}
          stroke="#000000"
          strokeWidth="16"
          strokeLinecap="round"
          fill="none"
          opacity="0.75"
          filter="url(#nyyNeonGlow)"
        />

        {/* 2. Primary NYY-F Matte PVC Cable Body (Full length from high behind building to PG-48) */}
        <path
          id="nyy-main-spine-v3"
          d={pathStr}
          stroke="url(#nyySheathGradV3)"
          strokeWidth="11"
          strokeLinecap="round"
          fill="none"
        />

        {/* 3. 3D Cylindrical Surface Sheen (Full length) */}
        <path
          d={pathStr}
          stroke="url(#nyySheenGradV3)"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />

        {/* 4. Embossed Standard Markings along the NYY Sheath */}
        <g opacity="0.65">
          <text fontSize="6" fill="#94a3b8" fontFamily="monospace" fontWeight="bold" letterSpacing="1.5">
            <textPath href="#nyy-main-spine-v3" startOffset="10%">
              PROCAL KABELWERK NYY-J 4x240 mm² 0.6/1kV IEC 60502-1 VDE CE
            </textPath>
          </text>
          <text fontSize="6" fill="#94a3b8" fontFamily="monospace" fontWeight="bold" letterSpacing="1.5">
            <textPath href="#nyy-main-spine-v3" startOffset="55%">
              PROCAL KABELWERK NYY-J 4x240 mm² 0.6/1kV IEC 60502-1 VDE CE
            </textPath>
          </text>
        </g>

        {/* =========================================================================
            5. DYNAMIC SCROLL-RESPONSIVE POWER LINE (FLOWS AS USER SCROLLS DOWN)
        ========================================================================= */}
        {/* Outer Orange Electric Glow Core */}
        <path
          d={pathStr}
          stroke="#ea580c"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          filter="url(#nyyNeonGlow)"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={Math.max(0, 100 * (1 - scrollProgress))}
          className="transition-all duration-75 ease-out"
        />

        {/* Inner High-Intensity Amber Filament */}
        <path
          d={pathStr}
          stroke="#fde047"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={Math.max(0, 100 * (1 - scrollProgress))}
          className="transition-all duration-75 ease-out"
        />

        {/* Continuous Ambient Phase Particles (🔴 L1, 🟡 L2, 🔵 L3) */}
        <circle r="2.8" fill="#ef4444" filter="url(#nyyNeonGlow)">
          <animateMotion path={pathStr} dur="3.6s" repeatCount="indefinite" />
        </circle>
        <circle r="2.8" fill="#f59e0b" filter="url(#nyyNeonGlow)">
          <animateMotion path={pathStr} dur="4.0s" repeatCount="indefinite" />
        </circle>
        <circle r="2.8" fill="#0ea5e9" filter="url(#nyyNeonGlow)">
          <animateMotion path={pathStr} dur="3.8s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}
