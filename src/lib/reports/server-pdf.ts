import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Resolves the appropriate Chromium executable path across environments:
 * - Local Windows dev: checks Chrome / Edge standard locations
 * - Local macOS dev: checks Chrome / Edge applications
 * - Production Linux / Vercel Serverless:
 *   1. Reuses existing /tmp/chromium if already inflated
 *   2. Checks local bin if present
 *   3. Downloads official Sparticuz brotli release pack into /tmp (bypasses 50MB Lambda zip limits)
 */
export async function getChromiumExecutablePath(): Promise<string> {
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe') : '',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Microsoft\\Edge\\Application\\msedge.exe') : '',
    ].filter(Boolean);
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } else if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }

  // Linux (Vercel Serverless / AWS Lambda / Docker)
  // Disable graphics mode (WebGL/SwiftShader) to save startup time and /tmp disk space
  chromium.setGraphicsMode = false;

  // 1. Fast path: check if the chromium binary is already inflated in /tmp
  const tmpChromium = path.join(os.tmpdir(), 'chromium');
  if (fs.existsSync(tmpChromium)) {
    return tmpChromium;
  }

  // 2. Check if a local node_modules/@sparticuz/chromium/bin directory exists (e.g. Docker container)
  const potentialBinDirs = [
    path.join('/var/task', 'node_modules', '@sparticuz', 'chromium', 'bin'),
    path.join(/*turbopackIgnore: true*/ process.cwd(), 'node_modules', '@sparticuz', 'chromium', 'bin'),
    path.join(/*turbopackIgnore: true*/ process.cwd(), '.next', 'server', 'node_modules', '@sparticuz', 'chromium', 'bin'),
  ];
  for (const binDir of potentialBinDirs) {
    if (fs.existsSync(binDir)) {
      try {
        const localPath = await chromium.executablePath(binDir);
        if (localPath && fs.existsSync(localPath)) return localPath;
      } catch (err) {
        console.warn('Local chromium bin evaluation failed, falling back to pack URL:', err);
      }
    }
  }

  // 3. Fallback for serverless environments (Vercel / Lambda) where large binaries (>50MB) cannot be bundled:
  // Dynamically download and inflate the official Sparticuz brotli release pack into /tmp.
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const packUrl = process.env.CHROMIUM_PACK_URL || `https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.${arch}.tar`;

  return await chromium.executablePath(packUrl);
}

/**
 * Generates an executive engineering package PDF in memory using Headless Chromium.
 * Guarantees native TrueType CIDFont embedding with complete /ToUnicode CMaps,
 * eliminating missing text, (cid:XX) extraction failures, and printer driver buffer limits.
 */
export async function generateServerPdf(html: string): Promise<Buffer> {
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

    // Set HTML content directly in memory (zero external network dependency)
    await page.setContent(html, {
      waitUntil: 'load',
      timeout: 45000,
    });

    // Ensure all web and system fonts are completely parsed and painted
    await page.evaluate(() => document.fonts.ready);

    // Landscape A4 submittal format with professional engineering margins
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
