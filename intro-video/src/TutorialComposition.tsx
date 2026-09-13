import React from "react";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Chapter1Overview } from "./scenes/tutorial/Chapter1Overview";
import { Chapter2Apartment } from "./scenes/tutorial/Chapter2Apartment";
import { Chapter3LibraryAndPanels } from "./scenes/tutorial/Chapter3LibraryAndPanels";
import { Chapter4RecalculateAndBalance } from "./scenes/tutorial/Chapter4RecalculateAndBalance";
import { Chapter5SurfacesVerification } from "./scenes/tutorial/Chapter5SurfacesVerification";
import { TutorialCaptions } from "./components/tutorial/TutorialCaptions";

export const ProCalTutorialVideo: React.FC = () => {
  const transitionDuration = 15;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundColor: "#070b14",
      }}
    >
      <TransitionSeries>
        {/* Chapter 1: Load Classification & Selection */}
        <TransitionSeries.Sequence durationInFrames={250}>
          <Chapter1Overview />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Chapter 2: Apartment Workflow & Auto-Sizing */}
        <TransitionSeries.Sequence durationInFrames={315}>
          <Chapter2Apartment />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Chapter 3: Load Library & Manual Panels */}
        <TransitionSeries.Sequence durationInFrames={285}>
          <Chapter3LibraryAndPanels />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Chapter 4: Recalculate & Phase Balancing */}
        <TransitionSeries.Sequence durationInFrames={315}>
          <Chapter4RecalculateAndBalance />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: transitionDuration })}
        />

        {/* Chapter 5: Quad-Surface Verification & Outro */}
        <TransitionSeries.Sequence durationInFrames={335}>
          <Chapter5SurfacesVerification />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* Global Animated Captions Powered by @remotion/captions */}
      <TutorialCaptions />
    </div>
  );
};
