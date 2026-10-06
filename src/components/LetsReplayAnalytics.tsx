import React from "react";

export function LetsReplayAnalytics() {
  const siteId =
    process.env.NEXT_PUBLIC_LETSREPLAY_SITE_ID !== undefined
      ? process.env.NEXT_PUBLIC_LETSREPLAY_SITE_ID
      : "efe6746d9ec74f9e90f31b94bb6540c3";

  if (!siteId) return null;

  return (
    <script
      async
      src="https://letsreplay.co/tracker.js"
      data-site-id={siteId}
    />
  );
}
