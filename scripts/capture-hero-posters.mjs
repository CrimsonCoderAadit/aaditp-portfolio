// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/capture-hero-posters.mjs [URL]
// Re-renders the hero posters (components/scene/heroPoster) from a running
// production build. Run it after any change the City hero can see. Each poster
// is drawn from the hero camera with a 68° lens, wider than any screen it
// serves (see the .hero-poster rules in app/globals.css), with the page's
// HTML hidden. Needs cwebp.
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const url = process.argv[2] || "http://localhost:3000";
// Hero camera and target from viewpoints.ts; the target drops for upright screens as in viewpointPose.
const tilt = (aspect) => 1.45 - .95 * Math.min(1, Math.max(0, (1.2 - aspect) / .54));
const POSTERS = [
  { name: "landscape", width: 2560, height: 1412, aspect: 1.6 },
  { name: "square", width: 1440, height: 1200, aspect: 1.05 },
  { name: "tablet", width: 1440, height: 1200, aspect: .75 },
  { name: "phone", width: 1000, height: 1515, aspect: .66 },
];
const scratch = mkdtempSync(join(tmpdir(), "hero-posters-"));
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const { name, width, height, aspect } of POSTERS) {
    const page = await (await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })).newPage();
    await page.goto(`${url}/?roomPlan=0.55,4.92,10.104,0,${tilt(aspect).toFixed(4)},2.804,68`);
    await page.waitForFunction(() => ["back", "left", "right", "front"].every((wall) => performance.getEntriesByName(`studio:mural-${wall}-ready`).length), null, { timeout: 60000 });
    await page.addStyleTag({ content: "main > :not(.scene) { visibility: hidden !important; } .scene div:not(:has(canvas)) { visibility: hidden !important; }" });
    await page.waitForTimeout(2500);
    const png = join(scratch, `${name}.png`);
    await page.locator(".scene canvas").screenshot({ path: png });
    execFileSync("cwebp", ["-quiet", "-q", "80", "-m", "6", "-sharp_yuv", png, "-o", `components/scene/heroPoster/${name}.webp`]);
    console.log(name, "written");
    await page.close();
  }
} finally { await browser.close(); }
