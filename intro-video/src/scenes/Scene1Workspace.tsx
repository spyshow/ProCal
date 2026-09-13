import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { AmbientBackground } from "../components/AmbientBackground";
import { MonitorFrame } from "../components/MonitorFrame";
import { SceneHUD } from "../components/SceneHUD";

export const Scene1Workspace: React.FC = () => {
  const frame = useCurrentFrame();

  // Cinematic macro camera push-in and premium smooth pan
  const scale = interpolate(frame, [0, 135], [1.03, 1.16], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
  });

  const translateX = interpolate(frame, [0, 135], [35, -45], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
  });

  const translateY = interpolate(frame, [0, 135], [-15, 25], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
  });

  const rotateY = interpolate(frame, [0, 135], [-3.5, 1.5], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
  });

  const rotateX = interpolate(frame, [0, 135], [2, -1], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
  });

  // Animated focus callout around project cards
  const focusOpacity = interpolate(frame, [25, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <AmbientBackground />

      <MonitorFrame
        imageSrc="assets/v2/dashboard.png"
        cameraStyle={{
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        }}
      >
        {/* Subtle highlight focus framing over Recent Projects */}
        <div
          style={{
            position: "absolute",
            left: "240px",
            top: "580px",
            width: "1380px",
            height: "220px",
            borderRadius: "14px",
            border: "1.5px solid rgba(249, 115, 22, 0.6)",
            boxShadow:
              "0 0 25px rgba(249, 115, 22, 0.2), inset 0 0 20px rgba(249, 115, 22, 0.05)",
            opacity: focusOpacity,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-12px",
              left: "20px",
              background: "#ea580c",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: 800,
              padding: "2px 8px",
              borderRadius: "4px",
              letterSpacing: "0.08em",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            ACTIVE MULTI-BUILDING COMPLEX
          </div>
        </div>
      </MonitorFrame>

      <SceneHUD
        badge="01 // WORKSPACE"
        title="The Modern Electrical Workspace"
        subtitle="Unified project hierarchy, building load summaries, and automated distribution design."
        accentColor="#f97316"
      />
    </div>
  );
};
