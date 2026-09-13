import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  Sequence,
  staticFile,
  useCurrentFrame,
  useDelayRender,
  useVideoConfig,
} from "remotion";
import { createTikTokStyleCaptions } from "@remotion/captions";
import type { Caption, TikTokPage } from "@remotion/captions";

const HIGHLIGHT_COLOR = "#38bdf8"; // Electric cyan
const CODE_HIGHLIGHT_COLOR = "#4ade80"; // Emerald for code/endpoints

const CaptionPage: React.FC<{ page: TikTokPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Current time relative to start of sequence
  const currentTimeMs = (frame / fps) * 1000;
  const absoluteTimeMs = page.startMs + currentTimeMs;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 48,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: "rgba(11, 15, 25, 0.90)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          borderRadius: 20,
          padding: "14px 34px",
          boxShadow:
            "0 20px 40px -10px rgba(0,0,0,0.85), 0 0 25px rgba(56,189,248,0.18)",
          fontSize: 27,
          fontFamily:
            "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          fontWeight: 700,
          whiteSpace: "pre",
          letterSpacing: "-0.01em",
          color: "#f8fafc",
          textAlign: "center",
          maxWidth: 1400,
        }}
      >
        {page.tokens.map((token, tokenIndex) => {
          const isActive =
            token.fromMs <= absoluteTimeMs && token.toMs > absoluteTimeMs;

          const isTech =
            token.text.includes("/") ||
            token.text.includes("POST") ||
            token.text.includes("sizeCable") ||
            token.text.includes("IEC") ||
            token.text.includes("60364") ||
            token.text.includes("ProCal");

          return (
            <span
              key={`${token.fromMs}-${tokenIndex}`}
              style={{
                display: "inline-block",
                color: isActive
                  ? isTech
                    ? CODE_HIGHLIGHT_COLOR
                    : HIGHLIGHT_COLOR
                  : "#f1f5f9",
                transform: isActive ? "scale(1.06)" : "scale(1)",
                textShadow: isActive
                  ? isTech
                    ? "0 0 18px rgba(74, 222, 128, 0.95), 0 0 32px rgba(74, 222, 128, 0.45)"
                    : "0 0 18px rgba(56, 189, 248, 0.95), 0 0 32px rgba(56, 189, 248, 0.45)"
                  : "0 2px 4px rgba(0,0,0,0.8)",
              }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export const TutorialCaptions: React.FC = () => {
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender());
  const { fps } = useVideoConfig();

  const fetchCaptions = useCallback(async () => {
    try {
      const response = await fetch(staticFile("captions-tutorial.json"));
      const data = await response.json();
      setCaptions(data);
      continueRender(handle);
    } catch (e) {
      cancelRender(e);
    }
  }, [continueRender, cancelRender, handle]);

  useEffect(() => {
    fetchCaptions();
  }, [fetchCaptions]);

  const SWITCH_CAPTIONS_EVERY_MS = 1400;

  const { pages } = useMemo(() => {
    if (!captions) return { pages: [] };
    return createTikTokStyleCaptions({
      captions,
      combineTokensWithinMilliseconds: SWITCH_CAPTIONS_EVERY_MS,
    });
  }, [captions]);

  if (!captions) {
    return null;
  }

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100 }}>
      {pages.map((page, index) => {
        const nextPage = pages[index + 1] ?? null;
        const startFrame = Math.round((page.startMs / 1000) * fps);
        const endFrame = Math.round(
          Math.min(
            nextPage ? (nextPage.startMs / 1000) * fps : Infinity,
            startFrame + (SWITCH_CAPTIONS_EVERY_MS / 1000) * fps,
          ),
        );
        const durationInFrames = endFrame - startFrame;

        if (durationInFrames <= 0) {
          return null;
        }

        return (
          <Sequence
            key={index}
            from={startFrame}
            durationInFrames={durationInFrames}
          >
            <CaptionPage page={page} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
