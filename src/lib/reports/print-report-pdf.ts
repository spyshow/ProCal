import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { wrapReportMarkup } from './render-report-html';
import { inlineImagesInHtml } from './inline-images';
import { getChromiumExecutablePath } from './server-pdf';

/**
 * Renders the engineering package by driving a real browser at the print route.
 *
 * Why not `renderToStaticMarkup` on the server: the report schedules are client
 * components (they own the "Show Your Work" trace popover and the equipment
 * fetch), so Next's RSC transform hands the server a client-reference proxy
 * instead of a component and rendering throws. Commit 0b483e0 worked around this
 * for the UI by having the browser POST its own DOM. An MCP client has no
 * browser, so we supply one.
 *
 * The DOM is lifted out of the rendered page and then re-wrapped with
 * `wrapReportMarkup`, which is the exact path the working browser-POST export
 * uses. That is deliberate: it keeps the compiled stylesheet and print rules
 * byte-identical between the two paths, rather than trusting the live app page's
 * own stylesheet to produce the same submittal.
 *
 * One browser, one page: load, extract, re-set content, print.
 */
export async function generateReportPdfFromPrintRoute(printUrl: string, title: string): Promise<Buffer> {
  const executablePath = await getChromiumExecutablePath();
  const isServerlessLinux = process.platform === 'linux';

  const browser = await puppeteer.launch({
    executablePath,
    headless: isServerlessLinux ? 'shell' : true,
    args: isServerlessLinux
      ? await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' })
      : [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--font-render-hinting=none',
        ],
    defaultViewport: {
      width: 1400,
      height: 900,
      deviceScaleFactor: 2,
    },
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 2 });

    await page.goto(printUrl, { waitUntil: 'networkidle2', timeout: 45000 });

    // The print page sets this once hydrated, so we never lift a partial DOM.
    await page.waitForFunction(
      () => (window as unknown as { __PRINT_READY__?: boolean }).__PRINT_READY__ === true,
      { timeout: 30000 }
    );

    const dom = await page.evaluate(() => {
      const el = document.getElementById('print-all-tabs');
      return el ? el.outerHTML : '';
    });

    if (!dom || dom.length < 200) {
      throw new Error(
        `Print route produced no report DOM (${dom.length} bytes). The print ticket may have been rejected.`
      );
    }

    await page.evaluate(() => document.fonts.ready);

    // Same wrapping the browser-POST path uses, so both exports match.
    const inlined = await inlineImagesInHtml(dom);
    const fullHtml = wrapReportMarkup(inlined, title);

    await page.setContent(fullHtml, { waitUntil: 'load', timeout: 45000 });
    await page.evaluate(() => document.fonts.ready);

    const pdfUint8 = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '15mm',
        right: '12mm',
        bottom: '15mm',
        left: '12mm',
      },
    });

    return Buffer.from(pdfUint8);
  } finally {
    await browser.close();
  }
}
