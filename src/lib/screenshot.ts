/**
 * Screen capture and screenshot utility for ProCal.
 *
 * Provides in-app DOM screenshot capability without triggering browser screen-sharing
 * permissions prompts ("Choose what to share").
 * Automatically filters out floating QA review drawers, feedback modal overlays,
 * and tour cards, completely eliminating backdrop darkness or blur so the underlying
 * engineering page is captured with 100% clarity and sharpness, without having to hide
 * or close the modal on the user's screen.
 */

import html2canvas from "html2canvas";
import { toPng } from "html-to-image";

/**
 * Captures the underlying page content directly from the DOM using html2canvas
 * or html-to-image.
 * Excludes all modal overlays, backdrops, and floating action triggers.
 */
async function capturePageDom(): Promise<string | null> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const root = (document.getElementById("procal-app-root") || document.body) as HTMLElement;
  const mainEl = (document.getElementById("procal-main-content") || document.querySelector("main")) as HTMLElement | null;
  const savedScrollTop = mainEl ? mainEl.scrollTop : 0;
  const savedScrollLeft = mainEl ? mainEl.scrollLeft : 0;

  // 1. Primary Strategy: html2canvas
  try {
    const canvas = await html2canvas(root, {
      backgroundColor: "#020617", // Match ProCal slate-950 background
      logging: false,
      useCORS: true,
      scale: Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2),
      width: window.innerWidth,
      height: window.innerHeight,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      ignoreElements: (element) => {
        if (element.getAttribute("data-qa-ignore") === "true") return true;
        if (element.classList?.contains("qa-drawer-overlay")) return true;
        if (element.classList?.contains("qa-floating-trigger")) return true;
        if (element.classList?.contains("qa-feedback-overlay")) return true;
        if (element.classList?.contains("qa-feedback-trigger")) return true;
        if (element.classList?.contains("qa-tour-overlay")) return true;
        if (element.classList?.contains("qa-lightbox-modal")) return true;
        return false;
      },
      onclone: (clonedDoc) => {
        // Remove any ignored modal, drawer, or backdrop overlays completely from the cloned DOM
        const ignored = clonedDoc.querySelectorAll(
          '[data-qa-ignore="true"], .qa-drawer-overlay, .qa-floating-trigger, .qa-feedback-overlay, .qa-feedback-trigger, .qa-tour-overlay, .qa-lightbox-modal, [role="dialog"]'
        );
        ignored.forEach((el) => el.remove());

        // Preserve scroll position of the main content area in the cloned DOM
        const clonedMain = (clonedDoc.getElementById("procal-main-content") || clonedDoc.querySelector("main")) as HTMLElement | null;
        if (clonedMain && savedScrollTop > 0) {
          const firstChild = clonedMain.firstElementChild as HTMLElement | null;
          if (firstChild) {
            firstChild.style.marginTop = `-${savedScrollTop}px`;
          } else {
            clonedMain.scrollTop = savedScrollTop;
          }
        }
        if (clonedMain && savedScrollLeft > 0) {
          clonedMain.scrollLeft = savedScrollLeft;
        }
      },
    });

    const dataUrl = canvas.toDataURL("image/png", 0.92);
    if (dataUrl && dataUrl.length > 50) {
      return dataUrl;
    }
  } catch (canvasErr) {
    console.warn("html2canvas DOM capture failed, attempting html-to-image fallback:", canvasErr);
  }

  // 2. Secondary Strategy: html-to-image
  try {
    const dataUrl = await toPng(root, {
      pixelRatio: Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2),
      skipFonts: true,
      cacheBust: true,
      filter: (node) => {
        if (node instanceof HTMLElement) {
          if (node.getAttribute("data-qa-ignore") === "true") return false;
          if (node.classList?.contains("qa-drawer-overlay")) return false;
          if (node.classList?.contains("qa-floating-trigger")) return false;
          if (node.classList?.contains("qa-feedback-overlay")) return false;
          if (node.classList?.contains("qa-feedback-trigger")) return false;
          if (node.classList?.contains("qa-tour-overlay")) return false;
          if (node.classList?.contains("qa-lightbox-modal")) return false;
          if (node.getAttribute("role") === "dialog") return false;
        }
        return true;
      },
    });

    if (dataUrl && dataUrl.length > 50) {
      return dataUrl;
    }
  } catch (imageErr) {
    console.warn("html-to-image capture fallback also failed:", imageErr);
  }

  return null;
}

/**
 * Fallback screen capture via browser navigator.mediaDevices.getDisplayMedia.
 * Only invoked if in-app DOM capture cannot be performed.
 */
async function captureScreenViaDisplayMedia(): Promise<string | null> {
  if (typeof window === "undefined" || typeof navigator === "undefined" || typeof navigator.mediaDevices?.getDisplayMedia !== "function") {
    throw new Error("Screen capture is not supported in this browser environment.");
  }

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "browser",
      } as MediaTrackConstraints,
      audio: false,
    });

    const track = stream.getVideoTracks()[0];
    if (!track) {
      stream.getTracks().forEach((t) => t.stop());
      return null;
    }

    const video = document.createElement("video");
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => {
        video.play().then(resolve).catch(reject);
      };
      video.onerror = () => reject(new Error("Failed to load video stream"));
      setTimeout(resolve, 1500);
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const width = video.videoWidth || window.innerWidth;
    const height = video.videoHeight || window.innerHeight;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      stream.getTracks().forEach((t) => t.stop());
      return null;
    }

    ctx.drawImage(video, 0, 0, width, height);

    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;

    return canvas.toDataURL("image/png", 0.92);
  } catch (err) {
    if (err instanceof DOMException && err.name === "NotAllowedError") {
      return null;
    }
    throw err;
  }
}

/**
 * Main screen capture function.
 * Attempts in-app clean DOM capture first (instant, no prompts, no modal in shot, no blur).
 * Falls back to display media if DOM capture fails.
 */
export async function captureScreen(): Promise<string | null> {
  if (typeof window === "undefined") {
    throw new Error("Screen capture is not supported in this browser environment.");
  }

  // 1. Direct clean in-app DOM capture without browser share popup or modal
  const domCapture = await capturePageDom();
  if (domCapture) {
    return domCapture;
  }

  // 2. Fallback to browser display media if DOM capture was unsuccessful
  if (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function") {
    return captureScreenViaDisplayMedia();
  }

  throw new Error("Unable to capture page screenshot. Please upload or paste an image.");
}

/**
 * Converts a base64 Data URL to a browser File object.
 */
export function dataUrlToFile(dataUrl: string, filename = `screenshot-${Date.now()}.png`): File {
  const arr = dataUrl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Uploads a screenshot file or data URL to ProCal's /api/upload endpoint.
 * Returns the durable asset serving URL (/api/assets/... or /uploads/...).
 */
export async function uploadScreenshot(fileOrDataUrl: File | string): Promise<string> {
  const file = typeof fileOrDataUrl === "string" ? dataUrlToFile(fileOrDataUrl) : fileOrDataUrl;

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to upload screenshot");
  }

  const data = await res.json();
  return data.url;
}

/**
 * Extracts an image File from a standard browser paste event.
 */
export function extractImageFromClipboard(event: React.ClipboardEvent | ClipboardEvent): File | null {
  const items = event.clipboardData?.items;
  if (!items) return null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.indexOf("image") !== -1) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}
