import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";

export const CursorClick: React.FC = () => {
  const frame = useCurrentFrame();

  // Target coordinates for [L2] button on Apt C circuit row (calibrated to v2/loads.png)
  const targetX = 941;
  const targetY = 807;

  // Cursor movement path: enters from bottom-right and moves to the circuit row L2 phase selector
  const cursorX = interpolate(frame, [10, 50], [1200, targetX], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 1, 0.5, 1),
  });

  const cursorY = interpolate(frame, [10, 50], [820, targetY], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 1, 0.5, 1),
  });

  // Cursor click down at frame 52-58
  const cursorScale = interpolate(
    frame,
    [50, 54, 58, 64],
    [1, 0.8, 0.8, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  // Click ripple effect expanding from the click point
  const rippleScale = interpolate(frame, [53, 80], [0, 2.4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.1, 1, 0.3, 1),
  });

  const rippleOpacity = interpolate(frame, [53, 58, 80], [0, 0.95, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Animated PASS Badge appears and pulses after click
  const badgeOpacity = interpolate(frame, [58, 72], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const badgeScale = interpolate(frame, [58, 75], [0.75, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.spring({ damping: 14 }),
  });

  return (
    <>
      {/* Click Ripple at L2 target */}
      <div
        style={{
          position: "absolute",
          left: targetX,
          top: targetY,
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          border: "2px solid #22c55e",
          backgroundColor: "rgba(34, 197, 94, 0.3)",
          transform: `translate(-50%, -50%) scale(${rippleScale})`,
          opacity: rippleOpacity,
          pointerEvents: "none",
          boxShadow: "0 0 25px #22c55e",
        }}
      />

      {/* Floating Animated Digital Cursor */}
      <div
        style={{
          position: "absolute",
          left: `${cursorX}px`,
          top: `${cursorY}px`,
          transform: `scale(${cursorScale})`,
          zIndex: 60,
          pointerEvents: "none",
          filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.9))",
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5.5 3.5L18.5 10.5L12 12.5L9.5 19L5.5 3.5Z"
            fill="#ffffff"
            stroke="#022c22"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Live Calculated Status: Green PASS Badge */}
      <div
        style={{
          position: "absolute",
          top: "140px",
          right: "80px",
          zIndex: 55,
          opacity: badgeOpacity,
          transform: `scale(${badgeScale})`,
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "linear-gradient(135deg, #052e16 0%, #14532d 100%)",
          border: "2px solid #22c55e",
          boxShadow:
            "0 15px 40px rgba(0, 0, 0, 0.8), 0 0 35px rgba(34, 197, 94, 0.5)",
          borderRadius: "14px",
          padding: "12px 22px",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            backgroundColor: "#22c55e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 16px #22c55e",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#052e16"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              color: "#86efac",
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            CALCULATION ENGINE CONFIRMED
          </span>
          <span
            style={{
              color: "#ffffff",
              fontSize: "17px",
              fontWeight: 800,
              fontFamily: "system-ui, sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            PHASE BALANCE: PASS (0.0% Imbalance)
          </span>
        </div>
      </div>
    </>
  );
};
