// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/profile-startup.mjs URL [output.json]
// A fresh browser context per cold run; a warm reload in the same context.
import { writeFile } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true, timeout: 20000, args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
const rows = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    const probe = window.__probe = { longTasks: [], context: 0, firstDraw: 0, presented: 0, errors: [] };
    new PerformanceObserver((list) => probe.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: "longtask", buffered: true });
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const begin = performance.now(), gl = original.apply(this, args);
      if (gl && args[0].startsWith("webgl")) {
        probe.context += performance.now() - begin;
        let framebuffer = null;
        const bind = gl.bindFramebuffer;
        gl.bindFramebuffer = function (target, buffer) {
          if (target === gl.FRAMEBUFFER || target === gl.DRAW_FRAMEBUFFER) framebuffer = buffer;
          return bind.call(this, target, buffer);
        };
        for (const method of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
          const draw = gl[method];
          gl[method] = function (...values) {
            if (!framebuffer && !probe.firstDraw) {
              probe.firstDraw = performance.now();
              requestAnimationFrame(() => { probe.presented = performance.now(); });
            }
            return draw.apply(this, values);
          };
        }
      }
      return gl;
    };
    window.addEventListener("error", e => probe.errors.push(e.message));
  });
  const page = await context.newPage();
  for (const temperature of ["cold", "warm"]) {
    await page.goto(process.argv[2], { waitUntil: "load" });
    await page.waitForFunction(() => window.__probe.presented > 0, null, { timeout: 60000, polling: 100 });
    rows.push(await page.evaluate(temperature => ({
      temperature, ...window.__probe,
      ttfb: performance.getEntriesByType("navigation")[0].responseStart,
      marks: performance.getEntriesByType("mark").filter(e => e.name.startsWith("studio:")).map(e => ({ name: e.name, time: e.startTime })),
      resources: performance.getEntriesByType("resource").map(e => ({ name: e.name, bytes: e.transferSize, duration: e.duration })),
    }), temperature));
  }
  if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify(rows, null, 2));
  console.log(JSON.stringify(rows.map(({ resources, ...row }) => ({ ...row, transferred: resources.reduce((sum, r) => sum + r.bytes, 0) })), null, 2));
} finally { await browser.close(); }
