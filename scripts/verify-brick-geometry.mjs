// Run: node --experimental-strip-types --test scripts/verify-brick-geometry.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { Mesh, MeshStandardMaterial, Raycaster, Vector3 } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createMoldedBoxGeometry, EDGE_RADIUS, withMoldedEdges } from "../components/scene/brickGeometry/moldedEdges.ts";
import { createPartLibrary, halfModuleOffset } from "../components/scene/brickGeometry/parts.ts";
import { builtWindow } from "../components/scene/brickGeometry/builtWindow.ts";

test("one box topology reproduces physical, dimension-aware rounded boxes", () => {
  const box = createMoldedBoxGeometry();
  const p = box.getAttribute("position"), profile = box.getAttribute("moldedProfile");
  for (const size of [[2.44, .038, .88], [.292, .092, .14], [.025, .52, .025], [.47, .0096, .035]]) {
    const radius = Math.min(EDGE_RADIUS, Math.min(...size) * .12);
    const expected = new RoundedBoxGeometry(...size, 2, radius);
    const target = expected.getAttribute("position");
    assert.equal(target.count, p.count);
    for (let i = 0; i < p.count; i++) for (let axis = 0; axis < 3; axis++) {
      const actual = Math.sign(p.getComponent(i, axis)) * (size[axis] / 2 - radius) + profile.getComponent(i, axis) * radius;
      assert.ok(Math.abs(actual - target.getComponent(i, axis)) < 1e-6);
    }
    expected.dispose();
  }
  box.dispose();
});

test("edge hook preserves material response, composes existing shader and matches depth", () => {
  const material = new MeshStandardMaterial({ roughness: .4 });
  material.onBeforeCompile = (s) => { s.vertexShader += "\n// original-surface-hook"; };
  withMoldedEdges(material);
  const compile = (m) => {
    const shader = { vertexShader: "#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>", fragmentShader: "", uniforms: {} };
    m.onBeforeCompile(shader, null);
    return shader.vertexShader;
  };
  const visible = compile(material);
  assert.ok(visible.includes("original-surface-hook"));
  assert.ok(visible.includes("objectNormal *= moldedSize()"));
  assert.equal(material.roughness, .4);
  const geometry = createMoldedBoxGeometry();
  const depth = compile(geometry.userData.moldedDepth);
  assert.ok(depth.includes("transformed = sign(position)"));
  const key = material.customProgramCacheKey();
  withMoldedEdges(material);
  assert.equal(key, material.customProgramCacheKey());
  geometry.dispose(); material.dispose();
});

test("five reusable forms are finite, dimension-correct and cached", () => {
  const library = createPartLibrary();
  const sizes = { slope: [.30, .09, .30], offsetPlate: [.30, .055, .15], edgePanel: [.30, .15, .045], steppedArch: [.45, .30, .15], technicalBeam: [.30, .09, .15] };
  for (const [form, size] of Object.entries(sizes)) {
    const geometry = library.get(form, size);
    assert.equal(geometry, library.get(form, [...size]));
    const bounds = geometry.boundingBox.getSize(new Vector3()).toArray();
    bounds.forEach((v, i) => assert.ok(Math.abs(v - size[i]) < 1e-6, `${form}: axis ${i}`));
    for (const name of ["position", "normal"]) {
      assert.ok(Array.from(geometry.getAttribute(name).array).every(Number.isFinite));
    }
    assert.ok(geometry.getAttribute("position").count < 1600, `${form}: lightweight topology`);
  }
  assert.deepEqual(halfModuleOffset([0, 0, 0], 1, -1), [.075, 0, -.075]);
  library.dispose();
});

test("technical beam and arch contain actual openings", () => {
  const library = createPartLibrary();
  const material = new MeshStandardMaterial();
  const ray = new Raycaster();
  const hits = (geometry, x, y) => {
    ray.set(new Vector3(x, y, 1), new Vector3(0, 0, -1));
    return ray.intersectObject(new Mesh(geometry, material)).length;
  };
  const beam = library.get("technicalBeam", [.30, .09, .15]);
  assert.equal(hits(beam, -.075, 0), 0);
  assert.equal(hits(beam, .075, 0), 0);
  assert.ok(hits(beam, 0, .04) > 0);
  const arch = library.get("steppedArch", [.45, .30, .15]);
  assert.equal(hits(arch, 0, -.075), 0);
  assert.ok(hits(arch, 0, .12) > 0);
  library.dispose(); material.dispose();
});

test("built window has an inset solid pane and an unchanged outer envelope", () => {
  const bay = builtWindow([0, 0, 0], [.60, .18, .06], [0, 0, 0], true);
  assert.equal(bay.frame.length, 5);
  assert.ok(bay.glass.size[2] > 0);
  assert.ok(bay.glass.position[2] + bay.glass.size[2] / 2 < .03 - .02);
  for (const part of [...bay.frame, bay.glass]) for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(part.position[i]) + part.size[i] / 2 <= [.30, .09, .03][i] + 1e-8);
  }
  const side = builtWindow([1, 2, 3], [.60, .18, .06], [0, Math.PI / 2, 0]);
  assert.ok(side.glass.position[0] < 1);
  assert.equal(side.glass.position[2], 3);
});
