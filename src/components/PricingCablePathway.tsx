'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';

export function PricingCablePathway() {
  const [pathStr, setPathStr] = useState<string>('');
  const [svgDimensions, setSvgDimensions] = useState({ width: 1400, height: 4000 });
  const [scrollProgress, setScrollProgress] = useState(0);
  const animFrameRef = useRef<number | null>(null);

  const updateCoordinates = useCallback(() => {
    if (typeof window === 'undefined') return;

    const originEl = document.getElementById('panel-cable-outlet');
    const targetEl = document.getElementById('pricing-cable-inlet');

    const rootEl = document.documentElement;
    const bodyEl = document.body;
    const fullWidth = Math.max(rootEl.clientWidth, window.innerWidth || 1200);
    const fullHeight = Math.max(rootEl.scrollHeight, bodyEl.scrollHeight, 3800);

    setSvgDimensions((prev) => (prev.width === fullWidth && prev.height === fullHeight ? prev : { width: fullWidth, height: fullHeight }));

    if (!originEl || !targetEl) return;

    const originRect = originEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const scrollY = window.pageYOffset || rootEl.scrollTop || 0;
    const scrollX = window.pageXOffset || rootEl.scrollLeft || 0;

    // 1. Origin: Starts directly at the panel-cable-outlet
    const x1 = originRect.left + originRect.width / 2 + scrollX;
    const y1 = originRect.top + originRect.height + scrollY - 2;

    // 2. Target: Lands straight into pricing-cable-inlet top center
    const x2 = targetRect.left + targetRect.width / 2 + scrollX;
    const y2 = targetRect.top + scrollY + 2;

    const dy = y2 - y1;
    const dx = x2 - x1;

    // Cable emerges vertically downward from left-side flank outlet, clears the panel corner, sweeps across, and enters pricing inlet:
    const cp1x = x1;
    const cp1y = y1 + dy * 0.35;

    const cp2x = Math.max(25, x1 - 15);
    const cp2y = y1 + dy * 0.55;

    const midX = x1 + dx * 0.42;
    const midY = y1 + dy * 0.65;

    // Continuous slope at mid: (dx*0.25, dy*0.06)
    const cp3x = midX + dx * 0.25;
    const cp3y = midY + dy * 0.06;

    const cp4x = x2;
    const cp4y = y2 - dy * 0.18;

    const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${midX} ${midY} C ${cp3x} ${cp3y}, ${cp4x} ${cp4y}, ${x2} ${y2}`;

    setPathStr(d);

    // Scroll calculation: progress advances from 0% at panel outlet to 100% when reaching the pricing section
    const scrollTop = window.scrollY || rootEl.scrollTop || 0;
    const startScroll = Math.max(0, y1 - window.innerHeight * 0.7);
    const endScroll = Math.max(startScroll + 100, y2 - window.innerHeight * 0.5);
    const progress = Math.min(1, Math.max(0, (scrollTop - startScroll) / (endScroll - startScroll)));
    setScrollProgress((prev) => (Math.abs(prev - progress) > 0.005 ? progress : prev));
  }, []);

  useEffect(() => {
    // Initial calculations across DOM layout phases
    const t1 = setTimeout(updateCoordinates, 50);
    const t2 = setTimeout(updateCoordinates, 200);
    const t3 = setTimeout(updateCoordinates, 600);
    const t4 = setTimeout(updateCoordinates, 1200);

    const handleScrollOrResize = () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(updateCoordinates);
    };

    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    window.addEventListener('scroll', handleScrollOrResize, { passive: true });

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && document.body) {
      ro = new ResizeObserver(() => {
        handleScrollOrResize();
      });
      ro.observe(document.body);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [updateCoordinates]);

  if (!pathStr) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden select-none">
      <svg
        className="w-full h-full"
        style={{ minHeight: `${svgDimensions.height}px` }}
        viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* NYY-F Heavy PVC Outer Jacket Gradient for Pricing Feeder */}
          <linearGradient id="nyyPricingSheath" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#080d1a" />
            <stop offset="25%" stopColor="#1e293b" />
            <stop offset="50%" stopColor="#334155" />
            <stop offset="75%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#080d1a" />
          </linearGradient>

          {/* 3D Cylindrical Highlight */}
          <linearGradient id="nyyPricingSheen" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="40%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Glowing Neon Power Pulse Filter */}
          <filter id="nyyPricingNeonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur1" />
            <feGaussianBlur stdDeviation="2" result="blur2" />
            <feMerge>
              <feMergeNode in="blur1" />
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Pure Soft Gaussian Diffusion for Cable Ambient / Drop Shadow */}
          <filter id="nyyPricingSoftShadowFilter" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" />
          </filter>
        </defs>

        {/* 1. Ambient Drop Shadow */}
        <path
          d={pathStr}
          transform="translate(2, 4)"
          style={{
            stroke: 'var(--cable-shadow-color)',
            opacity: 'var(--cable-shadow-opacity)',
          }}
          strokeWidth="18"
          strokeLinecap="round"
          fill="none"
          filter="url(#nyyPricingSoftShadowFilter)"
        />

        {/* 2. Primary NYY-F Matte PVC Cable Body */}
        <path
          id="nyy-pricing-spine"
          d={pathStr}
          stroke="url(#nyyPricingSheath)"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        />

        {/* 3. 3D Cylindrical Surface Sheen */}
        <path
          d={pathStr}
          stroke="url(#nyyPricingSheen)"
          strokeWidth="3.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />

        {/* 4. Embossed Standard Markings along the NYY Sheath */}
        <g opacity="0.65">
          <text fontSize="6" fill="#94a3b8" fontFamily="monospace" fontWeight="bold" letterSpacing="1.5">
            <textPath href="#nyy-pricing-spine" startOffset="12%">
              PROCAL KABELWERK NYY-J 4x35 mm² 0.6/1kV IEC 60502-1 • TARIFF &amp; LICENSING FEEDER
            </textPath>
          </text>
          <text fontSize="6" fill="#94a3b8" fontFamily="monospace" fontWeight="bold" letterSpacing="1.5">
            <textPath href="#nyy-pricing-spine" startOffset="60%">
              PROCAL KABELWERK NYY-J 4x35 mm² 0.6/1kV IEC 60502-1 • TARIFF &amp; LICENSING FEEDER
            </textPath>
          </text>
        </g>

        {/* =========================================================================
            5. DYNAMIC SCROLL-RESPONSIVE POWER LINE (FLOWS DOWN TO PRICING GLAND)
        ========================================================================= */}
        {/* Outer Orange Electric Glow Core */}
        <path
          d={pathStr}
          stroke="#ea580c"
          strokeWidth="3.8"
          strokeLinecap="round"
          fill="none"
          filter="url(#nyyPricingNeonGlow)"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={Math.max(0, 100 * (1 - scrollProgress))}
          className="transition-all duration-75 ease-out"
        />

        {/* Inner High-Intensity Amber Filament */}
        <path
          d={pathStr}
          stroke="#fde047"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={Math.max(0, 100 * (1 - scrollProgress))}
          className="transition-all duration-75 ease-out"
        />

        {/* Continuous Ambient Phase Particles (🔴 L1, 🟡 L2, 🔵 L3) */}
        <circle r="2.6" fill="#ef4444" filter="url(#nyyPricingNeonGlow)">
          <animateMotion path={pathStr} dur="3.4s" repeatCount="indefinite" />
        </circle>
        <circle r="2.6" fill="#f59e0b" filter="url(#nyyPricingNeonGlow)">
          <animateMotion path={pathStr} dur="3.9s" repeatCount="indefinite" />
        </circle>
        <circle r="2.6" fill="#0ea5e9" filter="url(#nyyPricingNeonGlow)">
          <animateMotion path={pathStr} dur="3.6s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}
