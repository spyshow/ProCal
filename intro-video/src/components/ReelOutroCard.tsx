import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

export const ReelOutroCard: React.FC = () => {
  const frame = useCurrentFrame();

  // Entrance animations
  const logoScale = interpolate(frame, [0, 25], [0.5, 1], {
    extrapolateRight: "clamp",
    easing: Easing.spring({ damping: 12 }),
  });

  const logoOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const textOpacity = interpolate(frame, [10, 26], [0, 1], {
    extrapolateRight: "clamp",
  });

  const textTranslateY = interpolate(frame, [10, 26], [25, 0], {
    extrapolateRight: "clamp",
    easing: Easing.spring({ damping: 14 }),
  });

  const cardsOpacity = interpolate(frame, [20, 36], [0, 1], {
    extrapolateRight: "clamp",
  });

  const cardsTranslateY = interpolate(frame, [20, 36], [30, 0], {
    extrapolateRight: "clamp",
    easing: Easing.spring({ damping: 14 }),
  });

  const ctaScale = interpolate(frame, [30, 48], [0.85, 1], {
    extrapolateRight: "clamp",
    easing: Easing.spring({ damping: 12 }),
  });

  const ctaPulse = interpolate(
    Math.sin(frame * 0.12),
    [-1, 1],
    [0.97, 1.03]
  );

  // Energy wave ring expansion
  const ring1Scale = interpolate(frame % 45, [0, 45], [1, 2.4]);
  const ring1Opacity = interpolate(frame % 45, [0, 25, 45], [0.8, 0.4, 0]);

  const ring2Scale = interpolate((frame + 22) % 45, [0, 45], [1, 2.4]);
  const ring2Opacity = interpolate((frame + 22) % 45, [0, 25, 45], [0.8, 0.4, 0]);

  const features = [
    { icon: "⚡", title: "3-Phase Vector Load Balancing", subtitle: "Zero Neutral Overload" },
    { icon: "🏢", title: "Vertical Risers & Hierarchy", subtitle: "Dynamic Voltage Drop" },
    { icon: "📉", title: "Protection Coordination (TCC)", subtitle: "Breaker Selectivity Studio" },
    { icon: "📑", title: "Submittal-Ready Reports", subtitle: "1-Click PDF Compliance" },
  ];

  return (
    <div
      style={{
        position: "relative",
        width: "1080px",
        height: "1920px",
        backgroundColor: "#030712",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "160px 60px 140px",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Background Ambient Radial Lighting */}
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "50%",
          width: "800px",
          height: "800px",
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(circle, rgba(245, 158, 11, 0.18) 0%, rgba(56, 189, 248, 0.12) 40%, transparent 75%)",
          filter: "blur(80px)",
          pointerEvents: "none",
        }}
      />

      {/* Blueprint Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          pointerEvents: "none",
        }}
      />

      {/* TOP: Brand Emblem & Core Tagline */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
          zIndex: 10,
        }}
      >
        {/* Animated Lightning Emblem with Pulse Rings */}
        <div
          style={{
            position: "relative",
            width: "150px",
            height: "150px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
          }}
        >
          {/* Energy rings */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "2px solid #f59e0b",
              transform: `scale(${ring1Scale})`,
              opacity: ring1Opacity,
              boxShadow: "0 0 20px #f59e0b",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "2px solid #38bdf8",
              transform: `scale(${ring2Scale})`,
              opacity: ring2Opacity,
              boxShadow: "0 0 20px #38bdf8",
            }}
          />

          {/* Core Emblem Shield */}
          <div
            style={{
              width: "130px",
              height: "130px",
              borderRadius: "32px",
              background:
                "linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)",
              border: "2px solid rgba(245, 158, 11, 0.8)",
              boxShadow:
                "0 20px 50px rgba(0, 0, 0, 0.9), 0 0 40px rgba(245, 158, 11, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="74"
              height="74"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
                fill="url(#goldGradient)"
                stroke="#ffffff"
                strokeWidth="0.8"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient
                  id="goldGradient"
                  x1="3"
                  y1="2"
                  x2="21"
                  y2="22"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#fbbf24" />
                  <stop offset="0.6" stopColor="#f59e0b" />
                  <stop offset="1" stopColor="#d97706" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Title & Tagline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
            opacity: textOpacity,
            transform: `translateY(${textTranslateY}px)`,
          }}
        >
          <span
            style={{
              fontSize: "82px",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              color: "#ffffff",
              lineHeight: 1,
              textShadow: "0 10px 30px rgba(0, 0, 0, 0.9)",
            }}
          >
            ProCal
          </span>

          {/* Gold Accent Divider */}
          <div
            style={{
              width: "120px",
              height: "4px",
              borderRadius: "2px",
              background:
                "linear-gradient(90deg, transparent, #f59e0b, #38bdf8, transparent)",
              boxShadow: "0 0 12px rgba(245, 158, 11, 0.8)",
            }}
          />

          <span
            style={{
              fontSize: "36px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: "#e2e8f0",
              textAlign: "center",
            }}
          >
            Low-Voltage Design, Solved.
          </span>
        </div>
      </div>

      {/* MIDDLE: Feature Matrix Cards */}
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          zIndex: 10,
          opacity: cardsOpacity,
          transform: `translateY(${cardsTranslateY}px)`,
        }}
      >
        {features.map((feat, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
              padding: "18px 24px",
              borderRadius: "18px",
              background:
                "linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.7) 100%)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div
              style={{
                width: "50px",
                height: "50px",
                borderRadius: "12px",
                backgroundColor: "rgba(15, 23, 42, 0.8)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                flexShrink: 0,
              }}
            >
              {feat.icon}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span
                style={{
                  color: "#ffffff",
                  fontSize: "22px",
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                }}
              >
                {feat.title}
              </span>
              <span
                style={{
                  color: "#94a3b8",
                  fontSize: "15px",
                  fontWeight: 500,
                }}
              >
                {feat.subtitle}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* BOTTOM: Standards & Call To Action Button */}
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
          zIndex: 10,
        }}
      >
        {/* Compliance Standards Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 20px",
            borderRadius: "9999px",
            backgroundColor: "rgba(15, 23, 42, 0.8)",
            border: "1px solid rgba(34, 197, 94, 0.4)",
            boxShadow: "0 0 16px rgba(34, 197, 94, 0.2)",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#22c55e",
              boxShadow: "0 0 8px #22c55e",
            }}
          />
          <span
            style={{
              color: "#86efac",
              fontSize: "14px",
              fontWeight: 800,
              letterSpacing: "0.08em",
            }}
          >
            IEC 60364-5-52 • BS 7671 • NFPA 70
          </span>
        </div>

        {/* Pulsing CTA Button */}
        <div
          style={{
            width: "100%",
            transform: `scale(${ctaScale * ctaPulse})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            style={{
              width: "100%",
              padding: "22px 0",
              borderRadius: "18px",
              background:
                "linear-gradient(135deg, #f59e0b 0%, #ea580c 50%, #d97706 100%)",
              boxShadow:
                "0 20px 45px rgba(234, 88, 12, 0.5), 0 0 35px rgba(245, 158, 11, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                color: "#ffffff",
                fontSize: "24px",
                fontWeight: 900,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              START DESIGNING FREE
            </span>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>

          <span
            style={{
              color: "#64748b",
              fontSize: "15px",
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            procal.io • Link in Bio
          </span>
        </div>
      </div>
    </div>
  );
};
