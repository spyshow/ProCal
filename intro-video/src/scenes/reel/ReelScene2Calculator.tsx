import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ReelContainer } from "../../components/ReelContainer";
import { CursorClick } from "../../components/CursorClick";

export const ReelScene2Calculator: React.FC = () => {
  const frame = useCurrentFrame();

  const zoomScale = interpolate(frame, [0, 110], [1.0, 1.06], {
    extrapolateRight: "clamp",
  });
  const panX = interpolate(frame, [0, 110], [0, -20], {
    extrapolateRight: "clamp",
  });
  const panY = interpolate(frame, [0, 110], [0, -15], {
    extrapolateRight: "clamp",
  });

  return (
    <ReelContainer
      imageSrc="assets/v2/loads.png"
      category="⚖️ CALCULATION ENGINE"
      headline={
        <>
          Auto-Balance Loads <span style={{ color: "#22c55e" }}>in 1 Click</span>
        </>
      }
      subtitle="Vector Load Balancing & Neutral Minimization"
      featureTitle="Intelligent 3-Phase Vector Load Balancing"
      featureDescription="Prevent neutral conductor burnout. Dynamic algorithms balance per-phase currents across L1, L2, and L3 automatically."
      highlights={[
        "0.0% Phase Imbalance",
        "Neutral Fire Prevention",
        "Live Vector Readout",
        "Instant Recalculation",
      ]}
      sceneIndex={2}
      totalScenes={5}
      zoomScale={zoomScale}
      panX={panX}
      panY={panY}
    >
      <CursorClick />
    </ReelContainer>
  );
};
