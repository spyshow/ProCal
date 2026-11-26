import { describe, it, expect, afterAll } from "vitest";
import { generateServerPdf, closeWarmBrowser } from "./server-pdf";

describe("generateServerPdf - Trial PDF Locking", () => {
  afterAll(async () => {
    await closeWarmBrowser();
  });

  it("locks trial PDF with AES-256 permissions encryption (/Encrypt /Filter /Standard)", async () => {
    const html = `<!DOCTYPE html><html><body><h1>Trial Evaluation Report</h1></body></html>`;
    const buffer = await generateServerPdf(html, { isTrial: true });

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);

    const pdfString = buffer.toString("binary");
    expect(pdfString).toContain("/Encrypt");
    expect(pdfString).toContain("/Filter");
    expect(pdfString).toContain("/Standard");
    expect(pdfString).toContain("/P ");
  }, 30000);

  it("does not encrypt non-trial PDF", async () => {
    const html = `<!DOCTYPE html><html><body><h1>Paid Report</h1></body></html>`;
    const buffer = await generateServerPdf(html, { isTrial: false });

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);

    const pdfString = buffer.toString("binary");
    expect(pdfString).not.toContain("/Encrypt");
  }, 30000);

  it("renders concurrent PDF exports cleanly via warm Chromium browser pool", async () => {
    const [buf1, buf2] = await Promise.all([
      generateServerPdf("<!DOCTYPE html><html><body><h1>Concurrent 1</h1></body></html>", { isTrial: false }),
      generateServerPdf("<!DOCTYPE html><html><body><h1>Concurrent 2</h1></body></html>", { isTrial: false }),
    ]);

    expect(buf1.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(buf2.subarray(0, 4).toString("ascii")).toBe("%PDF");
  }, 30000);
});
