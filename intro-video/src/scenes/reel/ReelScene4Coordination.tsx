import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ReelContainer } from "../../components/ReelContainer";
import { TCCScanline } from "../../components/TCCScanline";

export const ReelScene4Coordination: React.FC = () => {
  const frame = useCurrentFrame();

  const zoomScale = interpolate(frame, [0, 110], [1.0, 1.06], {
    extrapolateRight: "clamp",
  });
  const panX = interpolate(frame, [0, 110], [0, -30], {
    extrapolateRight: "clamp",
  });
  const panY = interpolate(frame, [0, 110], [0, -15], {
    extrapolateRight: "clamp",
  });

  return (
    <ReelContainer
      imageSrc="assets/v2/TCC.png"
      category="📉 PROTECTION STUDIO"
      headline={
        <>
          Automated TCC <span style={{ color: "#38bdf8" }}>Selectivity</span>
        </>
      }
      subtitle="Protection Coordination & Breaker Discrimination"
      featureTitle="Time-Current Characteristic (TCC) Analysis"
      featureDescription="Overlay upstream and downstream trip curves to guarantee total discrimination under both overload and peak short-circuit conditions."
      highlights={[
        "Full Selectivity (50 kA)",
        "240ms Discrimination Margin",
        "Masterpact & ComPacT Curves",
        "Instant Fault Thresholds",
      ]}
      sceneIndex={4}
      totalScenes={5}
      zoomScale={zoomScale}
      panX={panX}
      panY={panY}
    >
      <TCCScanline />
    </ReelContainer>
  );
};
