// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node --experimental-strip-types scripts/verify-studio.mjs URL
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { register } from "node:module";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
// Scene modules use bundler-style extensionless imports.
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    try { return await next(specifier, context); } catch (error) {
      if (specifier.startsWith(".")) for (const ext of [".ts", ".tsx"]) { try { return await next(specifier + ext, context); } catch {} }
      throw error;
    }
  }
`), import.meta.url);
const { muralUV } = await import("../components/scene/roomAssets/murals.ts");
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"] });
const out = ".playwright-mcp/engineering";
await mkdir(out, { recursive: true });
const result = { views: [], interactions: [], console: [], optionalFailures: false };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on("pageerror", e => result.console.push(e.message));
  page.on("console", e => { if (e.type() === "error") result.console.push(e.text()); });
  const url = process.argv[2] + "/?profile=1";
  await page.goto(url);
  await page.waitForFunction(() => window.__studio && performance.getEntriesByName("studio:ready").length, null, { timeout: 60000, polling: 100 });
  await page.waitForFunction(() => performance.getEntriesByName("studio:mural-right-ready").length && performance.getEntriesByName("studio:mural-left-ready").length && performance.getEntriesByName("studio:mural-front-ready").length, null, { polling: 100 });
  await page.evaluate(() => {
    window.__renderTimes = [];
    window.__motionFrames = [];
    let previous = performance.now();
    const frame = now => {
      if (document.querySelector(".viewpoint-nav")?.dataset.moving || /^(entering|leaving)-/.test(document.querySelector("main").dataset.mode)) window.__motionFrames.push(now - previous);
      previous = now;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    const gl = window.__studio.gl, render = gl.render;
    gl.render = function (...args) { const start = performance.now(); const result = render.apply(this, args); window.__renderTimes.push(performance.now() - start); return result; };
  });
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    for (const name of ["City", "Workstation", "Display", "Personal", "Room"]) {
      await page.getByRole("button", { name: name + " view", exact: true }).click();
      await page.waitForFunction(() => !document.querySelector(".viewpoint-nav").dataset.moving, null, { timeout: 20000, polling: 100 });
      await page.screenshot({ path: `${out}/${width}-${name.toLowerCase()}.png` });
      result.views.push({ width, name, ...await page.evaluate(() => ({ camera: window.__studio.camera.position.toArray(), dpr: window.__studio.get().viewport.dpr, render: { ...window.__studio.gl.info.render } })) });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "City view", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector(".viewpoint-nav").dataset.moving, null, { polling: 100 });
  for (const name of ["Projects", "Experience", "Research", "Skills"]) {
    // Actual keyboard focus/Enter, followed by a real Back button click.
    await page.getByRole("button", { name: "Open " + name, exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(name => document.querySelector("main").dataset.mode === name, name.toLowerCase(), { polling: 100 });
    await page.screenshot({ path: `${out}/focus-${name.toLowerCase()}.png` });
    await page.getByRole("button", { name: "← Workbench", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("main").dataset.mode === "workbench", null, { polling: 100 });
    result.interactions.push(name + " focus / Back");
    const hit = await page.evaluate(name => {
      const { scene, camera, gl, raycaster } = window.__studio;
      const district = scene.getObjectByName(name + " district");
      const proxy = district.children.find(o => o.__r3f?.handlers?.onClick);
      const proxies = [];
      scene.traverse(o => { if (o.__r3f?.handlers?.onClick) proxies.push(o); });
      proxy.geometry.computeBoundingBox();
      const box = proxy.geometry.boundingBox;
      let point;
      // A building's centre may project behind a nearer district. Find an
      // exposed part of its actual hit volume, just as a visitor would.
      for (const y of [.9, .7, .5]) for (const x of [.5, .25, .75]) for (const z of [.5, .25, .75]) {
        const candidate = proxy.position.clone().set(box.min.x + x * (box.max.x - box.min.x), box.min.y + y * (box.max.y - box.min.y), box.min.z + z * (box.max.z - box.min.z)).applyMatrix4(proxy.matrixWorld).project(camera);
        raycaster.setFromCamera(candidate, camera);
        if (!point && raycaster.intersectObjects(proxies, false)[0]?.object === proxy) point = candidate;
      }
      if (!point) throw new Error("No exposed pointer target for " + name);
      const rect = gl.domElement.getBoundingClientRect();
      return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
    }, name);
    await page.mouse.move(hit.x, hit.y);
    await page.waitForFunction(() => document.body.style.cursor === "pointer", null, { polling: 100 });
    await page.mouse.click(hit.x, hit.y);
    await page.waitForFunction(name => document.querySelector("main").dataset.mode === name, name.toLowerCase(), { polling: 100 });
    await page.getByRole("button", { name: "← Workbench", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("main").dataset.mode === "workbench", null, { polling: 100 });
    result.interactions.push(name + " pointer hover / click / Back");
  }
  // Background drag must orbit, not accidentally activate a district.
  const before = await page.evaluate(() => window.__studio.camera.position.toArray());
  await page.mouse.move(700, 810);
  await page.mouse.down(); await page.mouse.move(900, 740, { steps: 12 }); await page.mouse.up();
  await page.waitForFunction(before => window.__studio.camera.position.distanceTo({ x: before[0], y: before[1], z: before[2] }) > .05, before, { polling: 100 });
  assert.equal(await page.locator("main").getAttribute("data-mode"), "workbench");
  result.interactions.push("pointer drag orbits without accidental focus");
  await page.mouse.wheel(0, -250);
  result.interactions.push("wheel dolly");
  result.metrics = await page.evaluate(() => {
    const { gl, scene } = window.__studio;
    const materials = new Set(), textures = new Set();
    scene.traverse(o => { for (const m of o.material ? [].concat(o.material) : []) { materials.add(m); for (const value of Object.values(m)) if (value?.isTexture) textures.add(value); } });
    const times = window.__renderTimes.sort((a, b) => a - b);
    const frames = window.__motionFrames.sort((a, b) => a - b);
    return { motionFrameMs: { samples: frames.length, median: frames[Math.floor(frames.length * .5)], p95: frames[Math.floor(frames.length * .95)] }, renderMs: { samples: times.length, median: times[Math.floor(times.length * .5)], p95: times[Math.floor(times.length * .95)] }, materials: materials.size, programs: gl.info.programs.length, gpu: { ...gl.info.memory }, dpr: gl.getPixelRatio(), textures: [...textures].map(t => ({ width: t.image?.width, height: t.image?.height, min: t.minFilter, mag: t.magFilter, anisotropy: t.anisotropy })), heap: performance.memory?.usedJSHeapSize };
  });
  assert.deepEqual(result.console, []);
  const samples = await page.evaluate(() => {
    const shell = window.__studio.scene.getObjectByName("room-shell");
    const out = [];
    for (const mesh of shell.children) {
      const uv = mesh.geometry?.getAttribute("uv1");
      // Wall planes stand upright; the ceiling carries its own sky coordinates.
      if (!uv || mesh.rotation.x !== 0 || mesh.name === "door leaf") continue;
      const positions = mesh.geometry.getAttribute("position");
      const wall = mesh.rotation.y === 0 ? "back" : Math.abs(mesh.rotation.y - Math.PI) < 1e-6 ? "front" : mesh.rotation.y > 0 ? "left" : "right";
      for (let i = 0; i < uv.count; i++) {
        const p = mesh.position.clone().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
        out.push({ wall, p: p.toArray(), uv: [uv.getX(i), uv.getY(i)] });
      }
    }
    return out;
  });
  let maxError = 0;
  for (const { wall, p, uv } of samples) {
    const [u, v] = muralUV(wall, ...p);
    maxError = Math.max(maxError, Math.abs(uv[0] - u), Math.abs(uv[1] - v));
  }
  result.uv = { checked: samples.length, maxError };
  assert.ok(result.uv.checked >= 32 && result.uv.maxError < .00001);
  await writeFile(`${out}/verification.json`, JSON.stringify(result, null, 2));
  // Deliberately fail the hero wall and leave another pending. The third wall
  // must finish independently and the scene must remain interactive.
  let pending;
  await page.route("**/murals/back-wall-*", route => route.abort());
  await page.route("**/murals/left-wall-*", route => { pending = route; });
  await page.reload();
  await page.waitForFunction(() => performance.getEntriesByName("studio:ready").length && performance.getEntriesByName("studio:mural-right-ready").length, null, { timeout: 60000, polling: 100 });
  assert.equal(await page.locator(".studio-loading").count(), 0);
  await page.getByRole("button", { name: "Workstation view", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector(".viewpoint-nav").dataset.moving, null, { polling: 100 });
  await pending?.abort();
  result.optionalFailures = true;
  await page.unrouteAll({ behavior: "ignoreErrors" });
  // Worker startup failures produce a retry action immediately.
  await page.addInitScript(() => { window.Worker = class { constructor() { throw new Error("Injected worker failure"); } }; });
  await page.reload();
  await page.getByRole("button", { name: "Try again", exact: true }).waitFor();
  result.workerRecovery = true;
  result.injectedErrors = result.console.splice(0);
  await writeFile(`${out}/verification.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, metrics: { ...result.metrics, textures: result.metrics.textures.length } }, null, 2));
} finally { await browser.close(); }
