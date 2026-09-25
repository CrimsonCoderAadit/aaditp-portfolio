import { Box3, BoxGeometry, BufferGeometry, Float32BufferAttribute, Material, MeshDepthMaterial, RGBADepthPacking, Sphere, Vector3 } from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export const EDGE_RADIUS = .003;

// One topology for every box dimension. The instance/model matrix supplies size;
// neither geometry buckets nor extra draw calls are needed for different lengths.
const declarations = /* glsl */ `
attribute vec4 moldedProfile;
vec3 moldedSize() {
  mat4 partMatrix = modelMatrix;
  #ifdef USE_INSTANCING
    partMatrix = modelMatrix * instanceMatrix;
  #endif
  return max(vec3(length(partMatrix[0].xyz), length(partMatrix[1].xyz), length(partMatrix[2].xyz)), vec3(0.00001));
}
`;
const positionCorrection = /* glsl */ `
if (moldedProfile.w > 0.5) {
  vec3 partSize = moldedSize();
  float radius = min(${EDGE_RADIUS.toFixed(3)}, min(partSize.x, min(partSize.y, partSize.z)) * 0.12);
  transformed = sign(position) * (vec3(0.5) - radius / partSize) + moldedProfile.xyz * radius / partSize;
}
`;

/** Geometry-only shader hook: preserves the finish's existing surface shader. */
export function withMoldedEdges<T extends Material>(material: T): T {
  if (material.userData.moldedEdges) return material;
  material.userData.moldedEdges = true;
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();
  // Three's binding-state fallback disables this path for studs and other forms.
  Object.assign(material, { defaultAttributeValues: { moldedProfile: [0, 0, 0, 0] } });
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${declarations}`)
      .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nif (moldedProfile.w > 0.5) objectNormal *= moldedSize();")
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${positionCorrection}`);
  };
  material.customProgramCacheKey = () => `${previousKey}|physical-edges-v1`;
  return material;
}

/** `segments` trades fillet smoothness for triangles; 2 for the city, 1 where
 * bricks are small on screen and numerous. */
export function createMoldedBoxGeometry(segments = 2) {
  const geometry = new RoundedBoxGeometry(1, 1, 1, segments, .035);
  const normal = geometry.getAttribute("normal");
  const profile = new Float32Array(normal.count * 4);
  for (let i = 0; i < normal.count; i++) {
    profile.set([normal.getX(i), normal.getY(i), normal.getZ(i), 1], i * 4);
  }
  geometry.setAttribute("moldedProfile", new Float32BufferAttribute(profile, 4));
  // GPU-corrected corners can extend beyond the unit template's old fillet.
  // Conservative CPU bounds keep frustum culling valid for every aspect ratio.
  geometry.boundingBox = new Box3(new Vector3(-.5, -.5, -.5), new Vector3(.5, .5, .5));
  geometry.boundingSphere = new Sphere(new Vector3(), Math.sqrt(.75));
  const depth = withMoldedEdges(new MeshDepthMaterial({ depthPacking: RGBADepthPacking }));
  geometry.userData.moldedDepth = depth;
  geometry.addEventListener("dispose", () => depth.dispose());
  registerDetail(geometry, boxBuffers);
  return geometry;
}

/** Detail levels. From the room's own viewpoints a brick is a few pixels
 * wide and its 3 mm fillet is well under one, so a plain box of the same size
 * draws the same picture for a twenty-fifth of the triangles. Lower quality
 * tiers switch every molded box to that until a district is entered, then back.
 * The swap replaces buffers in place: meshes and instances keep their geometry. */
type Buffers = { index: BufferGeometry["index"]; attributes: BufferGeometry["attributes"] };
const molded = new Map<BufferGeometry, { full: Buffers; low: Buffers | null; makeLow: () => Buffers }>();
const brickDetail = { full: true };
const capture = (geometry: BufferGeometry): Buffers => ({ index: geometry.index, attributes: { ...geometry.attributes } });

/** Puts another shared geometry under the same switch, with its own simplified
 * form (built on first use). */
export function registerDetail(geometry: BufferGeometry, makeLow: () => BufferGeometry | Buffers) {
  molded.set(geometry, { full: capture(geometry), low: null, makeLow: () => { const low = makeLow(); return "isBufferGeometry" in low ? capture(low) : low; } });
  geometry.addEventListener("dispose", () => molded.delete(geometry));
  if (!brickDetail.full) applyDetail(geometry, false);
}

function boxBuffers(): Buffers {
  const box = new BoxGeometry(1, 1, 1);
  // A zero profile leaves the vertex hook off: exactly the unit box.
  box.setAttribute("moldedProfile", new Float32BufferAttribute(new Float32Array(box.getAttribute("position").count * 4), 4));
  return capture(box);
}

function applyDetail(geometry: BufferGeometry, full: boolean) {
  const entry = molded.get(geometry);
  if (!entry) return;
  const next = full ? entry.full : (entry.low ??= entry.makeLow());
  if (geometry.attributes.position === next.attributes.position) return;
  geometry.setIndex(next.index);
  for (const name of Object.keys(geometry.attributes)) if (!(name in next.attributes)) geometry.deleteAttribute(name);
  for (const [name, attribute] of Object.entries(next.attributes)) geometry.setAttribute(name, attribute);
  geometry.clearGroups();
}

/** Full molded bricks, or plain boxes. */
export function setBrickDetail(full: boolean) {
  if (brickDetail.full === full) return;
  brickDetail.full = full;
  molded.forEach((_, geometry) => applyDetail(geometry, full));
}
