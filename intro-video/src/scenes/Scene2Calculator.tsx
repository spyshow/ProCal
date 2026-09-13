import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { AmbientBackground } from "../components/AmbientBackground";
import { CursorClick } from "../components/CursorClick";
import { MonitorFrame } from "../components/MonitorFrame";
import { SceneHUD } from "../components/SceneHUD";

export const Scene2Calculator: React.FC = () => {
  const frame = useCurrentFrame();

  // Smooth isometric camera drift across technical balancing tables
  const scale = interpolate(frame, [0, 135], [1.06, 1.18], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
  });

  const translateX = interpolate(frame, [0, 135], [40, -50], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
  });

  const translateY = interpolate(frame, [0, 135], [10, -20], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
  });

  const rotateX = interpolate(frame, [0, 135], [6, 2], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
  });

  const rotateY = interpolate(frame, [0, 135], [-7, -2], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.8, 0.3, 1),
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
        imageSrc="assets/v2/loads.png"
        cameraStyle={{
          transform: `scale(${scale}) translate(${translateX}px, ${translateY}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        }}
      >
        <CursorClick />
      </MonitorFrame>

      <SceneHUD
        badge="02 // CALCULATION ENGINE"
        title="Live Phase Balancing & Neutral Engine"
        subtitle="Dynamic L1, L2, L3 load distribution with real-time vector balancing and IEC demand diversity."
        accentColor="#22c55e"
      />
    </div>
  );
};
