import { REPORT_COMPILED_CSS } from './report-css';

/**
 * Wraps already-rendered report markup in a standalone print document.
 *
 * The report schedules themselves are client components — `TraceableCell` owns the
 * "Show Your Work" trace popover — so they cannot be rendered to a string on the
 * server: Next's RSC transform hands a server module a client-reference proxy and
 * `renderToStaticMarkup` throws. The schedules are therefore rendered in a real
 * browser (see `print-report-pdf.ts`), and this function only supplies the
 * stylesheet and print rules around the resulting DOM.
 *
 * Both export paths share this wrapper, so the browser-POST export and the
 * headless-Chromium export produce the same document.
 */
export function wrapReportMarkup(markup: string, title = 'Engineering Package'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeXml(title)}</title>
  <style>
    /* Standalone compiled Tailwind stylesheet */
    ${REPORT_COMPILED_CSS}

    /* Print & Typography Standards */
    @page {
      size: A4 landscape;
      margin: 10mm 10mm 10mm 10mm;
    }
    @page :first {
      margin: 8mm 10mm 8mm 10mm;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      box-sizing: border-box !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background-color: #ffffff !important;
      color: #0f172a !important;
      font-family: Arial, Helvetica, "Nimbus Sans L", sans-serif !important;
      -webkit-font-smoothing: antialiased;
    }
    .font-mono, code, pre, kbd, samp {
      font-family: Consolas, "Courier New", Courier, monospace !important;
    }
    #print-all-tabs {
      display: block !important;
      width: 100% !important;
    }
    .print-page-container {
      page-break-before: always;
      break-before: page;
      box-sizing: border-box;
      width: 100%;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }

    /* Universal High-Contrast Technical Document Zebra Striping */
    table tbody tr:nth-child(even):not([class*="bg-amber"]):not([class*="bg-sky"]):not([class*="bg-yellow"]) {
      background-color: #f1f5f9 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    table tbody tr:nth-child(even):not([class*="bg-amber"]):not([class*="bg-sky"]):not([class*="bg-yellow"]) td {
      background-color: #f1f5f9 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    table tbody tr:nth-child(odd):not([class*="bg-amber"]):not([class*="bg-sky"]):not([class*="bg-yellow"]) {
      background-color: #ffffff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    table tbody tr:nth-child(odd):not([class*="bg-amber"]):not([class*="bg-sky"]):not([class*="bg-yellow"]) td {
      background-color: #ffffff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    table tbody tr.bg-slate-100 td,
    table tbody tr[class*="bg-slate-100"] td {
      background-color: #f1f5f9 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    table tbody tr[class*="bg-amber"] td {
      background-color: #fef3c7 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    table tbody tr[class*="bg-sky"] td {
      background-color: #f0f9ff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    button:not(td *):not(th *),
    [role="button"]:not(td *):not(th *),
    input[type="button"] {
      display: none !important;
    }
    td [role="button"], th [role="button"], .group\\/cell, .traceable-cell {
      display: inline-block !important;
      position: static !important;
      cursor: default !important;
      user-select: text !important;
      background: transparent !important;
      box-shadow: none !important;
    }
    .group\\/cell::after, td [role="button"]::after, th [role="button"]::after, [class*="after:content-['fx']"]::after {
      display: none !important;
      content: none !important;
    }
    .report-header img,
    .cover-page img {
      max-height: 44px !important;
      max-width: 150px !important;
      width: auto !important;
      height: auto !important;
      object-fit: contain !important;
    }
  </style>
</head>
<body>
  <div class="report-root w-full bg-white text-slate-900">
    ${markup}
  </div>
</body>
</html>`;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
