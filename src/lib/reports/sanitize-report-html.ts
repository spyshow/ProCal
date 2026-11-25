/**
 * Sanitizes client-supplied report HTML before server-side Chromium rendering.
 * Strips executable <script> elements and inline DOM event handlers.
 */
export function sanitizeClientReportHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}
