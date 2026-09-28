import puppeteer, { type Browser } from 'puppeteer-core';
import { getChromiumExecutablePath } from '@/lib/reports/server-pdf';

/**
 * Single shared Chromium instance for server-side rendering (Task 4 Step 5).
 *
 * Why: `generateServerPdf` launches a fresh browser per call. That costs 3-8
 * seconds and a few hundred MB each time, which is fine for an occasional user
 * clicking "Export PDF" but not for an MCP agent that can fire several exports
 * in a row. A module-level singleton amortises the launch.
 *
 * The pool is deliberately process-local. On serverless (Vercel / Lambda) each
 * cold start gets a fresh module instance and a fresh browser, which is the
 * correct behaviour anyway — the browser is torn down when the instance recycles.
 */

let browserPromise: Promise<Browser> | null = null;
/** Serialises work so two PDF renders never fight over page state. */
let queue: Promise<unknown> = Promise.resolve();

async function launch(): Promise<Browser> {
  const executablePath = await getChromiumExecutablePath();
  const isLinux = process.platform === 'linux';
  return puppeteer.launch({
    executablePath,
    headless: isLinux ? 'shell' : true,
    args: isLinux
      ? await puppeteer.defaultArgs({ args: ['--no-sandbox', '--disable-gpu'], headless: 'shell' })
      : [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--font-render-hinting=none',
        ],
    defaultViewport: { width: 1400, height: 900, deviceScaleFactor: 2 },
  });
}

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launch().catch((err) => {
      // Don't cache a failed launch — let the next call retry.
      browserPromise = null;
      throw err;
    });
  }
  const browser = await browserPromise;
  if (!browser.connected || browser.process() === null) {
    browserPromise = null;
    return getBrowser();
  }
  return browser;
}

/**
 * Run `fn` with exclusive access to the shared browser. Calls are serialised in
 * FIFO order; a failure in one task must not break the queue for the next, so
 * the rejection is isolated.
 */
export async function withBrowser<T>(fn: (browser: Browser) => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const browser = await getBrowser();
    return fn(browser);
  };
  const result = queue.then(run, run);
  // Keep the chain alive but never propagate a rejection into the next caller.
  queue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

/** Close the pooled browser. Used by tests and by graceful shutdown. */
export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const pending = browserPromise;
  browserPromise = null;
  try {
    const browser = await pending;
    await browser.close();
  } catch {
    // Already gone.
  }
}
