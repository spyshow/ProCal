import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-first-run', '--disable-extensions', '--window-size=1400,1000'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });

  // 1) Login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.type('input[type="text"]', 'engineer');
  await page.type('input[type="password"]', 'password123');
  await page.evaluate(() => document.querySelector('form').requestSubmit());
  await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }).catch(() => {});
  await sleep(1500);
  console.log('URL after login:', page.url());

  // 2) Find a project that has buildings
  const projects = await page.evaluate(async () => {
    const r = await fetch('/api/projects', { cache: 'no-store' });
    return r.json();
  });
  const list = Array.isArray(projects) ? projects : (projects.projects || []);
  console.log('projects fetched:', list.length);
  const withBuildings = list.find((p) => p.buildings && p.buildings.length > 0);
  const projId = withBuildings ? withBuildings.id : list[0]?.id;
  console.log('project chosen:', projId, withBuildings ? `buildings=${withBuildings.buildings.length}` : '(no buildings meta)');

  // 3) Select it and go to reports
  await page.evaluate((id) => localStorage.setItem('selected_project_id', id), projId);
  await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle0', timeout: 60000 });
  await sleep(2000);

  // 3.5) Neutralize the print iframe so react-to-print doesn't tear it down
  await page.evaluate(() => {
    const mo = new MutationObserver(() => {
      const f = document.getElementById('printWindow');
      if (f && !f.dataset.patched) {
        f.dataset.patched = '1';
        f.addEventListener('load', () => {
          try { f.contentWindow.print = () => {}; } catch {}
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  });

  // 4) Click Export Full PDF Package (wait for it to render; i18n may localize the label)
  let clicked = false;
  for (let i = 0; i < 20; i++) {
    clicked = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const b = btns.find((x) => /PDF/i.test(x.textContent) || /print/i.test(x.className));
      if (b) { b.click(); return true; }
      return false;
    });
    if (clicked) break;
    await sleep(1000);
  }
  console.log('export button clicked:', clicked);
  if (!clicked) {
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 800));
    console.log('PAGE TEXT:', bodyText);
  }

  // 5) Locate react-to-print iframe (poll fast; it gets removed after printing)
  let frame = null;
  for (let i = 0; i < 60 && !frame; i++) {
    frame = page.frames().find((f) => f.name() === 'printWindow' || (f !== page.mainFrame() && f.url() === 'about:srcdoc'));
    if (!frame) await sleep(50);
  }
  console.log('iframe found:', !!frame, frame ? frame.url() : '');
  if (!frame) throw new Error('print iframe not found');

  // 6) Emulate print media, then measure + extract in ONE evaluate (iframe may vanish)
  await page.emulateMediaType('print');
  const m = await frame.evaluate(() => {
    const gs = (el, prop) => el ? getComputedStyle(el).getPropertyValue(prop) : null;
    const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), top: +b.top.toFixed(1) }; };
    const body = document.body;
    const root = document.querySelector('#print-all-tabs');
    const containers = [...document.querySelectorAll('.print-page-container')];
    const cover = document.querySelector('.cover-page');
    const headers = [...document.querySelectorAll('header')].map((h) => ({ cls: String(h.className).slice(0, 30), display: gs(h, 'display') }));
    const loadPage = containers[1];
    const loadTable = loadPage ? loadPage.querySelector('table') : null;
    return {
      bodyW: +body.getBoundingClientRect().width.toFixed(1),
      bodyStyleW: gs(body, 'width'),
      bodyMaxW: gs(body, 'max-width'),
      bodyMargin: gs(body, 'margin'),
      rootDisplay: gs(root, 'display'),
      rootRect: rect(root),
      containerCount: containers.length,
      containers: containers.map((c) => ({ cls: String(c.className).slice(0, 42), rect: rect(c), display: gs(c, 'display') })),
      coverRect: rect(cover),
      coverBreakInside: gs(cover, 'break-inside'),
      headers,
      loadTable: loadTable ? { w: +loadTable.getBoundingClientRect().width.toFixed(1), rows: loadPage.querySelectorAll('tbody tr').length } : null,
      docScrollH: document.documentElement.scrollHeight,
      bodyScrollH: body.scrollHeight,
      htmlOverflowX: gs(document.documentElement, 'overflow-x'),
    };
  });
  console.log('MEASUREMENTS (print media, iframe):');
  console.log(JSON.stringify(m, null, 2));

  // 7) Extract styles + body html for static repro (same evaluate, iframe may vanish)
  const extra = await frame.evaluate(() => {
    const styles = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n');
    const bodyHtml = document.body.innerHTML;
    return { styles, bodyHtml };
  });
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>debug-print</title><style>${extra.styles}</style></head><body>${extra.bodyHtml}</body></html>`;
  const { writeFileSync } = await import('node:fs');
  writeFileSync('public/debug-print.html', html, 'utf8');
  console.log('static repro written: public/debug-print.html');

  // 8) Generate the PDF from the static repro via CDP printToPDF (preferCSSPageSize)
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 1400, height: 1000 });
  await page2.goto(`${BASE}/debug-print.html`, { waitUntil: 'networkidle0', timeout: 60000 });
  await sleep(1500);
  const pdf = await page2.pdf({
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: false,
  });
  const { writeFileSync: wf } = await import('node:fs');
  wf('debug-print.pdf', pdf);
  console.log('PDF generated: debug-print.pdf bytes=', pdf.length);

  // 9) Re-open the PDF in Chrome and read per-page text + page pixel dims
  const page3 = await browser.newPage();
  await page3.goto('file:///D:/BackUp/programing_projects/ProCal/debug-print.pdf', { waitUntil: 'networkidle0', timeout: 60000 });
  await sleep(2500);
  const pdfInfo = await page3.evaluate(() => {
    const pages = [...document.querySelectorAll('.page')];
    const out = [];
    for (const p of pages) {
      const texts = [...p.querySelectorAll('.textLayer span')].map((s) => s.textContent).filter(Boolean);
      const joined = texts.join(' ').trim();
      out.push({
        w: p.style.width,
        h: p.style.height,
        textLen: joined.length,
        sample: joined.slice(0, 120),
        hasHeader: /REPORT|SCHEDULE|PROJECT|ELECTRICAL/i.test(joined),
      });
    }
    return { pageCount: pages.length, pages: out };
  });
  console.log('PDF ANALYSIS:');
  console.log(JSON.stringify(pdfInfo, null, 2));

  // Save measurements + pdf analysis to files for reading later
  const { writeFileSync: wf2 } = await import('node:fs');
  wf2('debug-measure.json', JSON.stringify({ measurements: m, pdfInfo }, null, 2));
  console.log('saved debug-measure.json');
} catch (err) {
  console.error('ERROR:', err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}