import { describe, it, expect } from 'vitest';
import { wrapReportMarkup } from './render-report-html';

/**
 * The report schedules are client components, so the document is assembled in a
 * real browser and only the *wrapper* is applied on the server. These tests cover
 * that wrapper, which is the only part of the report path that runs server-side.
 */
describe('wrapReportMarkup', () => {
  it('wraps arbitrary markup into a self-contained A4 landscape document', () => {
    const output = wrapReportMarkup('<div id="print-all-tabs"><h2>Test Schedule</h2></div>', 'Custom Title');

    expect(output).toContain('<!DOCTYPE html>');
    expect(output).toContain('<html lang="en">');
    expect(output).toContain('<title>Custom Title</title>');
    expect(output).toContain('size: A4 landscape');
    expect(output).toContain('Test Schedule');
    expect(output).toContain('#print-all-tabs');
  });

  it('embeds the compiled stylesheet and the print-only typography rules', () => {
    const output = wrapReportMarkup('<div>x</div>');

    // Standalone CSS: the document is detached from the app, so it cannot rely
    // on a stylesheet href.
    expect(output).toContain('@page');
    expect(output).toContain('Consolas, "Courier New", Courier, monospace');
    expect(output).toContain('-webkit-print-color-adjust: exact !important');
    expect(output).toContain('print-color-adjust: exact !important');
  });

  it('includes the zebra striping rules the schedules rely on', () => {
    const output = wrapReportMarkup('<div>x</div>');

    expect(output).toContain('table tbody tr:nth-child(even)');
    expect(output).toContain('#f1f5f9');
  });

  it('neutralises interactive affordances that make no sense on paper', () => {
    const output = wrapReportMarkup('<div>x</div>');

    // Trace popovers and annex toggles are client-only; they must not print.
    expect(output).toContain('button:not(td *):not(th *)');
    expect(output).toContain('.report-header img');
  });

  it('escapes the title so a project name cannot break the document', () => {
    const output = wrapReportMarkup('<div>x</div>', 'Tower <script>alert(1)</script> & Co');

    expect(output).toContain('&lt;script&gt;');
    expect(output).not.toContain('<script>alert(1)</script>');
  });
});
