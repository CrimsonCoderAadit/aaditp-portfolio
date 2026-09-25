import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await page.goto(process.argv[2] + "/?profile=1");
  await page.waitForFunction(() => performance.getEntriesByName("studio:mural-left-ready").length && performance.getEntriesByName("studio:mural-right-ready").length, null, { timeout: 60000, polling: 100 });
  const snapshot = async label => {
    const row = await page.evaluate(label => ({ label, ...window.__studio.gl.info.memory, programs: window.__studio.gl.info.programs.length, environment: window.__studio.scene.environment.uuid, heap: performance.memory.usedJSHeapSize }), label);
    rows.push(row); console.log(JSON.stringify(row));
  };
  await snapshot("initial");
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const name of ["Workstation", "Display", "Personal", "Room", "City"]) {
      await page.getByRole("button", { name: name + " view", exact: true }).click();
      await page.waitForFunction(() => !document.querySelector(".viewpoint-nav").dataset.moving, null, { polling: 100 });
    }
    for (const name of ["Projects", "Experience", "Research", "Skills"]) {
      await page.getByRole("button", { name: "Open " + name, exact: true }).focus(); await page.keyboard.press("Enter");
      await page.waitForFunction(name => document.querySelector("main").dataset.mode === name, name.toLowerCase(), { polling: 100 });
      await page.getByRole("button", { name: "← Workbench", exact: true }).click();
      await page.waitForFunction(() => document.querySelector("main").dataset.mode === "workbench", null, { polling: 100 });
    }
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("HeapProfiler.collectGarbage"); await cdp.detach();
    await snapshot("cycle-" + cycle);
  }
  await writeFile(process.argv[3] || ".playwright-mcp/engineering/memory.json", JSON.stringify(rows, null, 2));
  assert.ok(rows.at(-1).textures <= rows[1].textures + 2, "GPU textures grow after the first complete navigation cycle");
  assert.ok(rows.at(-1).geometries <= rows[1].geometries + 2, "GPU geometry grows after the first complete navigation cycle");
} finally { await browser.close(); }
