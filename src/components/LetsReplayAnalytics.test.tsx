// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LetsReplayAnalytics } from "./LetsReplayAnalytics";

describe("LetsReplayAnalytics Component", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("renders tracker script with default site ID when env var is not set", () => {
    delete process.env.NEXT_PUBLIC_LETSREPLAY_SITE_ID;
    const html = renderToStaticMarkup(<LetsReplayAnalytics />);

    expect(html).toContain('src="https://letsreplay.co/tracker.js"');
    expect(html).toContain('data-site-id="efe6746d9ec74f9e90f31b94bb6540c3"');
    expect(html).toContain("async");
  });

  it("renders tracker script with custom site ID when NEXT_PUBLIC_LETSREPLAY_SITE_ID is provided", () => {
    process.env.NEXT_PUBLIC_LETSREPLAY_SITE_ID = "custom-site-12345";
    const html = renderToStaticMarkup(<LetsReplayAnalytics />);

    expect(html).toContain('src="https://letsreplay.co/tracker.js"');
    expect(html).toContain('data-site-id="custom-site-12345"');
  });

  it("renders nothing when NEXT_PUBLIC_LETSREPLAY_SITE_ID is explicitly empty (e.g. in dev)", () => {
    process.env.NEXT_PUBLIC_LETSREPLAY_SITE_ID = "";
    const html = renderToStaticMarkup(<LetsReplayAnalytics />);

    expect(html).toBe("");
  });
});

describe("next.config.ts Content Security Policy", () => {
  it("includes letsreplay.co in CSP and excludes Microsoft Clarity", async () => {
    const nextConfig = (await import("../../next.config")).default;
    const headers = await nextConfig.headers!();
    const globalHeaderRule = headers.find((h) => h.source === "/:path*");
    expect(globalHeaderRule).toBeDefined();

    const csp = globalHeaderRule?.headers.find((h) => h.key === "Content-Security-Policy");
    expect(csp).toBeDefined();
    const cspValue = csp?.value || "";

    // Allows letsreplay
    expect(cspValue).toContain("https://letsreplay.co");
    expect(cspValue).toContain("https://*.letsreplay.co");

    // Removes clarity & bing
    expect(cspValue).not.toContain("clarity.ms");
    expect(cspValue).not.toContain("c.bing.com");
  });
});
