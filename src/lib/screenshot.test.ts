/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  dataUrlToFile,
  uploadScreenshot,
  extractImageFromClipboard,
  captureScreen,
} from "./screenshot";

const mockHtml2Canvas = vi.fn();
vi.mock("html2canvas", () => ({
  default: (...args: any[]) => mockHtml2Canvas(...args),
}));

describe("screenshot utility", () => {
  const samplePngDataUrl =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  beforeEach(() => {
    vi.restoreAllMocks();
    mockHtml2Canvas.mockReset();
  });

  describe("dataUrlToFile", () => {
    it("converts a PNG data URL to a File object with correct properties", () => {
      const file = dataUrlToFile(samplePngDataUrl, "test.png");
      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe("test.png");
      expect(file.type).toBe("image/png");
      expect(file.size).toBeGreaterThan(0);
    });

    it("generates default filename when none is provided", () => {
      const file = dataUrlToFile(samplePngDataUrl);
      expect(file.name).toMatch(/^screenshot-\d+\.png$/);
    });
  });

  describe("uploadScreenshot", () => {
    it("uploads file to /api/upload and returns URL", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ url: "/api/assets/logo:mock123" }),
      });
      global.fetch = mockFetch;

      const url = await uploadScreenshot(samplePngDataUrl);
      expect(url).toBe("/api/assets/logo:mock123");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/upload",
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        })
      );
    });

    it("throws an error if upload endpoint returns non-OK", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Storage quota exceeded" }),
      });
      global.fetch = mockFetch;

      await expect(uploadScreenshot(samplePngDataUrl)).rejects.toThrow(
        "Storage quota exceeded"
      );
    });
  });

  describe("extractImageFromClipboard", () => {
    it("returns null if no items in clipboardData", () => {
      const fakeEvent = {
        clipboardData: { items: [] },
      } as unknown as ClipboardEvent;
      expect(extractImageFromClipboard(fakeEvent)).toBeNull();
    });

    it("extracts image file if an image item exists in clipboard", () => {
      const dummyFile = new File(["dummy"], "pasted.png", { type: "image/png" });
      const fakeEvent = {
        clipboardData: {
          items: [
            {
              type: "text/plain",
              getAsFile: () => null,
            },
            {
              type: "image/png",
              getAsFile: () => dummyFile,
            },
          ],
        },
      } as unknown as ClipboardEvent;

      const extracted = extractImageFromClipboard(fakeEvent);
      expect(extracted).toBe(dummyFile);
    });
  });

  describe("captureScreen", () => {
    it("captures DOM using html2canvas without browser permission prompt", async () => {
      const fakeCanvas = {
        toDataURL: vi.fn().mockReturnValue(samplePngDataUrl),
      };
      mockHtml2Canvas.mockResolvedValue(fakeCanvas);

      // Setup minimal DOM
      document.body.innerHTML = `
        <div id="procal-app-root">
          <main id="procal-main-content">
            <div>Schedule Table</div>
          </main>
          <div data-qa-ignore="true" class="qa-drawer-overlay">
            <div>QA Modal Content</div>
          </div>
        </div>
      `;

      const result = await captureScreen();
      expect(result).toBe(samplePngDataUrl);
      expect(mockHtml2Canvas).toHaveBeenCalled();

      // Verify ignoreElements filters out data-qa-ignore elements
      const options = mockHtml2Canvas.mock.calls[0][1];
      expect(options).toBeDefined();

      const ignoredEl = document.querySelector('[data-qa-ignore="true"]') as HTMLElement;
      expect(options?.ignoreElements?.(ignoredEl)).toBe(true);

      const tableEl = document.querySelector('main') as HTMLElement;
      expect(options?.ignoreElements?.(tableEl)).toBe(false);
    });
  });
});
