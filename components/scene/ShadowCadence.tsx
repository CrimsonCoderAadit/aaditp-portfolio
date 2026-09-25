import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { InstancedMesh, Mesh, Object3D } from "three";

/** A shadow pass redraws every caster into the key light's 4096² map, which
 * costs several times a whole ordinary frame. Nothing that moves the camera
 * changes a shadow, so the map is redrawn only when a shadow-casting object has
 * actually moved, appeared or disappeared: its world matrix (or, for instanced
 * bricks, its instance data) differs from the last frame. While casters keep
 * moving the map follows them at most every other rendered frame, and always
 * once more when they come to rest. */
const EVERY = 2;

type Seen = { matrix: Float64Array; instances: number; frame: number };

export default function ShadowCadence() {
  const get = useThree((state) => state.get);
  const invalidate = useThree((state) => state.invalidate);
  const run = useRef({ frame: 0, drawn: -EVERY, pending: false, seen: new Map<Object3D, Seen>() });
  useEffect(() => {
    const { shadowMap } = get().gl;
    shadowMap.autoUpdate = false;
    shadowMap.needsUpdate = true;
    return () => { shadowMap.autoUpdate = true; };
  }, [get]);
  useFrame(({ gl, scene }) => {
    const r = run.current, frame = ++r.frame;
    scene.updateMatrixWorld();
    let changed = false, visited = 0;
    scene.traverseVisible((object) => {
      const mesh = object as Mesh;
      if (!mesh.isMesh || !mesh.castShadow) return;
      visited++;
      const instances = (mesh as unknown as InstancedMesh).isInstancedMesh ? (mesh as unknown as InstancedMesh).instanceMatrix.version * 65536 + (mesh as unknown as InstancedMesh).count : 0;
      const elements = mesh.matrixWorld.elements;
      let seen = r.seen.get(mesh);
      if (!seen) { seen = { matrix: new Float64Array(16), instances: -1, frame }; r.seen.set(mesh, seen); changed = true; }
      seen.frame = frame;
      if (seen.instances !== instances) { seen.instances = instances; changed = true; }
      const matrix = seen.matrix;
      for (let i = 0; i < 16; i++) if (matrix[i] !== elements[i]) { matrix.set(elements); changed = true; break; }
    });
    // A caster that has gone (hidden or unmounted) takes its shadow with it.
    if (visited !== r.seen.size) {
      for (const [object, seen] of r.seen) if (seen.frame !== frame) r.seen.delete(object);
      changed = true;
    }
    if (changed || r.pending) {
      if (frame - r.drawn >= EVERY) { gl.shadowMap.needsUpdate = true; r.drawn = frame; r.pending = false; }
      else { r.pending = true; invalidate(); }
    }
  }, -1);
  return null;
}
