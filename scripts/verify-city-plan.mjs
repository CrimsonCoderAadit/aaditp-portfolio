// Run: node --experimental-strip-types --test scripts/verify-city-plan.mjs
import assert from "node:assert/strict";
import { register } from "node:module";
import { test } from "node:test";

// The scene modules use bundler-style extensionless imports; teach the ESM loader
// to try .ts/.tsx before the scene graph is pulled in below.
register("data:text/javascript," + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    try { return await next(specifier, context); } catch (error) {
      if (specifier.startsWith(".")) {
        for (const ext of [".ts", ".tsx"]) { try { return await next(specifier + ext, context); } catch {} }
      }
      throw error;
    }
  }
`), import.meta.url);

const { BLOCKS, CITY, DISTRICTS, EDGE_MARGIN, FOOTPRINTS, PROMENADE, STREETS, TABLE_HALF, edge } = await import("../components/scene/cityMasterplan.ts");
const { createCityInfrastructureKit } = await import("../components/scene/cityInfrastructureGeometry.ts");

const names = Object.keys(DISTRICTS);

/** Plan-view bounds of a district once its masterplan turn is applied. */
function footprint(name) {
  const f = FOOTPRINTS[name], { at: [ox, oz], turn } = DISTRICTS[name];
  const t = turn * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  const cx = (f.x[0] + f.x[1]) / 2, cz = (f.z[0] + f.z[1]) / 2;
  const hx = (f.x[1] - f.x[0]) / 2, hz = (f.z[1] - f.z[0]) / 2;
  const x = ox + cx * c + cz * s, z = oz - cx * s + cz * c;
  const ex = hx * Math.abs(c) + hz * Math.abs(s), ez = hx * Math.abs(s) + hz * Math.abs(c);
  return { x0: x - ex, x1: x + ex, z0: z - ez, z1: z + ez };
}
const overlaps = (a, b, slack = 0) =>
  Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > slack && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > slack;
const corridor = (s) => s.axis === "x"
  ? { x0: s.from, x1: s.to, z0: s.centre - edge(s), z1: s.centre + edge(s) }
  : { x0: s.centre - edge(s), x1: s.centre + edge(s), z0: s.from, z1: s.to };
const margin = (b) => Math.min(b.x0 + TABLE_HALF.x, TABLE_HALF.x - b.x1, b.z0 + TABLE_HALF.z, TABLE_HALF.z - b.z1);

test("every district stands clear of the table edge", () => {
  for (const name of names) assert.ok(margin(footprint(name)) >= EDGE_MARGIN, name);
});

test("district footprints never intersect", () => {
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    assert.ok(!overlaps(footprint(names[i]), footprint(names[j])), `${names[i]} / ${names[j]}`);
  }
});

test("no street corridor is laid through a building, and none reaches the edge", () => {
  for (const street of STREETS) {
    const box = corridor(street);
    for (const name of names) assert.ok(!overlaps(box, footprint(name)), `${street.axis}=${street.centre} / ${name}`);
    assert.ok(margin(box) >= .14, `${street.axis}=${street.centre} runs off the table`);
  }
});

test("ground furniture stands beside the districts, not on them", () => {
  const kit = createCityInfrastructureKit();
  const plots = names.map((name) => ({ name, box: footprint(name), lift: DISTRICTS[name].lift }));
  for (const batch of kit.batches) {
    if (batch.stud) continue;
    for (const part of batch.parts) {
      const [w, h, d] = part.size, [x, y, z] = part.position;
      const box = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 };
      for (const { name, box: plot, lift } of plots) {
        // Flat paving and platforms may run under a district; nothing that stands does.
        if (y + h / 2 <= lift + .031) continue;
        assert.ok(!overlaps(box, plot, .02), `${batch.finish} part at ${x.toFixed(2)},${z.toFixed(2)} sits on ${name}`);
      }
    }
  }
});

test("the built ground keeps a visible margin on the tabletop", () => {
  const kit = createCityInfrastructureKit();
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const batch of kit.batches) for (const part of batch.parts) {
    const [w, , d] = batch.stud ? [.06, 0, .06] : part.size;
    x0 = Math.min(x0, part.position[0] - w / 2); x1 = Math.max(x1, part.position[0] + w / 2);
    z0 = Math.min(z0, part.position[2] - d / 2); z1 = Math.max(z1, part.position[2] + d / 2);
  }
  assert.ok(margin({ x0, x1, z0, z1 }) >= .14);
});

const inside = (b, x, z) => x >= b.x0 - 1e-6 && x <= b.x1 + 1e-6 && z >= b.z0 - 1e-6 && z <= b.z1 + 1e-6;
const rectBox = (r) => ({ x0: r.x[0], x1: r.x[1], z0: r.z[0], z1: r.z[1] });

test("blocks, corridors and the promenade tile the whole city without a gap", () => {
  const cover = [...BLOCKS.map((b) => rectBox(b.area)), ...STREETS.map(corridor), rectBox(PROMENADE)];
  for (let x = CITY.x[0] + .01; x < CITY.x[1]; x += .05) for (let z = CITY.z[0] + .01; z < CITY.z[1]; z += .05) {
    assert.ok(cover.some((b) => inside(b, x, z)), `bare tabletop at ${x.toFixed(2)},${z.toFixed(2)}`);
  }
});

test("no block overlaps a street corridor", () => {
  for (const block of BLOCKS) for (const street of STREETS) assert.ok(!overlaps(rectBox(block.area), corridor(street), .001), `${block.name} / ${street.name}`);
});

test("the city covers 75–85% of the tabletop", () => {
  const share = (CITY.x[1] - CITY.x[0]) * (CITY.z[1] - CITY.z[0]) / (4 * TABLE_HALF.x * TABLE_HALF.z);
  assert.ok(share >= .75 && share <= .85, share.toFixed(3));
});

test("the boulevard is materially wider than every other street", () => {
  const [boulevard, ...rest] = STREETS;
  for (const street of rest) assert.ok(boulevard.road >= street.road * 1.8, street.name);
});
