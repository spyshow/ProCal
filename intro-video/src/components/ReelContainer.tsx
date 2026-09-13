import React from "react";
import { Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";

interface ReelContainerProps {
  imageSrc: string;
  category: string;
  headline: React.ReactNode;
  subtitle: string;
  featureTitle: string;
  featureDescription: string;
  highlights: string[];
  sceneIndex: number;
  totalScenes?: number;
  zoomScale?: number;
  panX?: number;
  panY?: number;
  children?: React.ReactNode;
}

export const ReelContainer: React.FC<ReelContainerProps> = ({
  imageSrc,
  category,
  headline,
  subtitle,
  featureTitle,
  featureDescription,
  highlights,
  sceneIndex,
  totalScenes = 5,
  zoomScale = 1,
  panX = 0,
  panY = 0,
  children,
}) => {
  const frame = useCurrentFrame();

  // Ambient lighting breathing pulse
  const pulse = interpolate(Math.sin(frame * 0.08), [-1, 1], [0.85, 1.15]);

  // Entrance spring animations for headline and cards
  const topOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });
  const topTranslateY = interpolate(frame, [0, 15], [-30, 0], {
    extrapolateRight: "clamp",
    easing: Easing.spring({ damping: 14 }),
  });

  const bottomOpacity = interpolate(frame, [8, 22], [0, 1], {
    extrapolateRight: "clamp",
  });
  const bottomTranslateY = interpolate(frame, [8, 22], [40, 0], {
    extrapolateRight: "clamp",
    easing: Easing.spring({ damping: 14 }),
  });

  const windowScale = interpolate(frame, [0, 18], [0.93, 1], {
    extrapolateRight: "clamp",
    easing: Easing.spring({ damping: 16 }),
  });

  // Animated subtle 3D tilt
  const tiltX = interpolate(Math.sin(frame * 0.04), [-1, 1], [1.5, -1.5]);
  const tiltY = interpolate(Math.cos(frame * 0.04), [-1, 1], [-1.8, 1.8]);

  // Window viewport dimensions
  const viewportWidth = 980;
  const viewportHeight = 680;
  const headerHeight = 44;
  const contentHeight = viewportHeight - headerHeight;

  // Base scale to fit 1680x880 content into 980x636
  const baseScale = viewportWidth / 1680; // ~0.5833

  // Progress line width
  const progressPercent = (sceneIndex / totalScenes) * 100;

  return (
    <div
      style={{
        position: "relative",
        width: "1080px",
        height: "1920px",
        backgroundColor: "#030712",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* 1. Fullscreen Blurred Screenshot Backdrop for Rich Atmosphere */}
      <div
        style={{
          position: "absolute",
          inset: "-40px",
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 1,
        }}
      >
        <Img
          src={staticFile(imageSrc)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(60px) brightness(0.22) saturate(1.7)",
            transform: `scale(${1.15 * pulse})`,
          }}
        />
        {/* Dark radial vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 50% 50%, rgba(3, 7, 18, 0.4) 0%, rgba(3, 7, 18, 0.95) 100%)",
          }}
        />
      </div>

      {/* 2. Ambient Studio Lighting Glows */}
      <div
        style={{
          position: "absolute",
          top: "300px",
          left: "50%",
          width: "900px",
          height: "900px",
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(circle, rgba(14, 165, 233, 0.18) 0%, rgba(2, 132, 199, 0.05) 50%, transparent 75%)",
          filter: "blur(70px)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "200px",
          left: "50%",
          width: "800px",
          height: "800px",
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 70%)",
          filter: "blur(80px)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {/* 3. Subtle Technical Blueprint Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(to right, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(255, 255, 255, 0.025) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          pointerEvents: "none",
          zIndex: 3,
        }}
      />

      {/* 4. Top Safe Area Header Hook (Y: 130px - 390px) */}
      <div
        style={{
          position: "absolute",
          top: "130px",
          left: "50px",
          right: "50px",
          zIndex: 20,
          opacity: topOpacity,
          transform: `translateY(${topTranslateY}px)`,
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {/* Category Pill + Scene Counter Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 16px",
              borderRadius: "9999px",
              backgroundColor: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              boxShadow: "0 0 16px rgba(56, 189, 248, 0.2)",
              backdropFilter: "blur(12px)",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#38bdf8",
                boxShadow: "0 0 8px #38bdf8",
              }}
            />
            <span
              style={{
                color: "#38bdf8",
                fontSize: "13px",
                fontWeight: 800,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {category}
            </span>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 14px",
              borderRadius: "9999px",
              backgroundColor: "rgba(30, 41, 59, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(10px)",
            }}
          >
            <span
              style={{
                color: "#94a3b8",
                fontSize: "13px",
                fontWeight: 700,
                fontFamily: "monospace",
              }}
            >
              0{sceneIndex} / 0{totalScenes}
            </span>
          </div>
        </div>

        {/* Large Punchy Headline (Mobile Eye-Catcher) */}
        <h1
          style={{
            fontSize: "58px",
            lineHeight: 1.12,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            color: "#ffffff",
            margin: 0,
            textShadow: "0 4px 20px rgba(0, 0, 0, 0.8)",
          }}
        >
          {headline}
        </h1>

        {/* Subtitle / Standard Indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span
            style={{
              color: "#cbd5e1",
              fontSize: "22px",
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            {subtitle}
          </span>
        </div>
      </div>

      {/* 5. Center Stage: Floating Glass Desktop Window Viewport (Y: 420px - 1100px) */}
      <div
        style={{
          position: "absolute",
          top: "420px",
          left: "50px",
          width: `${viewportWidth}px`,
          height: `${viewportHeight}px`,
          zIndex: 10,
          perspective: 1200,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "20px",
            backgroundColor: "#0b0f19",
            border: "1.5px solid rgba(56, 189, 248, 0.35)",
            boxShadow:
              "0 30px 80px -15px rgba(0, 0, 0, 0.95), 0 0 50px rgba(14, 165, 233, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.2)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            transform: `scale(${windowScale}) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
            transformStyle: "preserve-3d",
            transition: "none",
          }}
        >
          {/* Mac-style Window Top Bar */}
          <div
            style={{
              height: `${headerHeight}px`,
              backgroundColor: "rgba(15, 23, 42, 0.95)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 18px",
              flexShrink: 0,
            }}
          >
            {/* Window control dots */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "11px",
                  height: "11px",
                  borderRadius: "50%",
                  backgroundColor: "#ef4444",
                  opacity: 0.85,
                }}
              />
              <div
                style={{
                  width: "11px",
                  height: "11px",
                  borderRadius: "50%",
                  backgroundColor: "#f59e0b",
                  opacity: 0.85,
                }}
              />
              <div
                style={{
                  width: "11px",
                  height: "11px",
                  borderRadius: "50%",
                  backgroundColor: "#10b981",
                  opacity: 0.85,
                }}
              />
            </div>

            {/* Central Window Title */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="#38bdf8"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" />
              </svg>
              <span
                style={{
                  color: "#94a3b8",
                  fontSize: "12px",
                  fontWeight: 600,
                  fontFamily: "monospace",
                  letterSpacing: "0.04em",
                }}
              >
                ProCal Studio • IEC 60364-5-52
              </span>
            </div>

            {/* Telemetry Status */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "#22c55e",
                  boxShadow: "0 0 6px #22c55e",
                }}
              />
              <span
                style={{
                  color: "#86efac",
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                }}
              >
                ACTIVE
              </span>
            </div>
          </div>

          {/* Screenshot & Overlays Content Container */}
          <div
            style={{
              position: "relative",
              width: "100%",
              height: `${contentHeight}px`,
              overflow: "hidden",
              backgroundColor: "#020617",
            }}
          >
            {/* Inner 1680x880 canvas scaled to fit and support macro camera pan/zoom */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "1680px",
                height: "880px",
                transformOrigin: "top left",
                transform: `scale(${baseScale * zoomScale}) translate(${panX}px, ${panY}px)`,
              }}
            >
              <Img
                src={staticFile(imageSrc)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "top left",
                  display: "block",
                }}
              />

              {/* Children overlays (CursorClick, PulseEnergy, TCCScanline) */}
              {children}
            </div>

            {/* Subtle Glass Sheen across viewport */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, transparent 40%, rgba(255, 255, 255, 0.02) 100%)",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
      </div>

      {/* 6. Bottom Stage: High-Contrast Technical Feature Card (Y: 1140px - 1680px) */}
      <div
        style={{
          position: "absolute",
          top: "1140px",
          left: "50px",
          right: "50px",
          zIndex: 20,
          opacity: bottomOpacity,
          transform: `translateY(${bottomTranslateY}px)`,
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        <div
          style={{
            background:
              "linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(30, 41, 59, 0.8) 100%)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "22px",
            padding: "26px 30px",
            boxShadow:
              "0 20px 50px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.1)",
            backdropFilter: "blur(20px)",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {/* Card Header & Micro Progress Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                color: "#38bdf8",
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              ENGINEERING SPECIFICATION
            </span>

            {/* Scene progress indicator track */}
            <div
              style={{
                width: "100px",
                height: "4px",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                borderRadius: "2px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: "100%",
                  background:
                    "linear-gradient(90deg, #38bdf8 0%, #f59e0b 100%)",
                  borderRadius: "2px",
                }}
              />
            </div>
          </div>

          {/* Feature Title */}
          <h2
            style={{
              color: "#ffffff",
              fontSize: "28px",
              fontWeight: 800,
              lineHeight: 1.2,
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            {featureTitle}
          </h2>

          {/* Feature Description */}
          <p
            style={{
              color: "#94a3b8",
              fontSize: "18px",
              lineHeight: 1.45,
              margin: 0,
              fontWeight: 400,
            }}
          >
            {featureDescription}
          </p>

          {/* Highlight Capsules Grid */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginTop: "4px",
            }}
          >
            {highlights.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                  borderRadius: "10px",
                  backgroundColor: "rgba(15, 23, 42, 0.75)",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span
                  style={{
                    color: "#e2e8f0",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                >
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Floating Brand Watermark Tag at Bottom */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            marginTop: "6px",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="#f59e0b"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" />
          </svg>
          <span
            style={{
              color: "#64748b",
              fontSize: "14px",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            PROCAL • LOW-VOLTAGE DESIGN, SOLVED.
          </span>
        </div>
      </div>
    </div>
  );
};
