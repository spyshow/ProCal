import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ReelContainer } from "../../components/ReelContainer";

export const ReelScene1Workspace: React.FC = () => {
  const frame = useCurrentFrame();

  // Subtle camera push-in on the dashboard
  const zoomScale = interpolate(frame, [0, 110], [1.0, 1.12], {
    extrapolateRight: "clamp",
  });
  const panX = interpolate(frame, [0, 110], [0, -40], {
    extrapolateRight: "clamp",
  });
  const panY = interpolate(frame, [0, 110], [0, -25], {
    extrapolateRight: "clamp",
  });

  return (
    <ReelContainer
      imageSrc="assets/v2/dashboard.png"
      category="⚡ ENGINEERING WORKSPACE"
      headline={
        <>
          The Future of <span style={{ color: "#38bdf8" }}>Low-Voltage Design</span>
        </>
      }
      subtitle="Cloud-Native Electrical Engineering Suite"
      featureTitle="Unified Building Hierarchy & Feeder Modeling"
      featureDescription="Model multi-story distribution networks, substation feeds, and dynamic cable routes in a blazing-fast dark UI."
      highlights={[
        "Multi-Floor Hierarchy",
        "Substation Feeds",
        "Dynamic Cable Sizing",
        "IEC 60364 Compliance",
      ]}
      sceneIndex={1}
      totalScenes={5}
      zoomScale={zoomScale}
      panX={panX}
      panY={panY}
    />
  );
};
