import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { DoubleSide, MathUtils, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, type Group, type Texture } from "three";
import { claim, settleWall } from "./roomAssets/murals";
import { CURTAIN_ART } from "./roomAssets/muralFiles";
import { flipRoomToggle, roomReachable, useRoomToggle } from "./roomInteractions";
import { useSceneTransition } from "./SceneTransition";
import { GLASS_WALL, ROOM } from "./roomLayout";

const LEFT = GLASS_WALL.centre - GLASS_WALL.width / 2, RIGHT = GLASS_WALL.centre + GLASS_WALL.width / 2;
const TOP = ROOM.ceiling - .23, BOTTOM = ROOM.floor + .04, HEIGHT = TOP - BOTTOM;
const Z = ROOM.back + .25;
/** Each panel hangs from a point on the wall just past the glass. Gathered, it
 * is a narrow stack; drawn, it reaches a little past the middle to overlap its
 * partner. */
const HANG = .25, GATHERED = .95, DRAWN = GLASS_WALL.width / 2 + HANG + .04;
const FOLDS = 11, FOLD_DEPTH = .045;
const SECONDS = 1.8;
/** The print's own fabric tone, shown until the print arrives. */
const FABRIC = "#b9bccb";
const VIEWS = ["city", "room", "personal", "display", "workstation"] as const;

/** One panel, one unit wide, hanging from x = 0 toward +x (left panel) or -x
 * (right panel), folded along its width. Each panel carries its half of the
 * print, so the two meet as one picture when drawn. */
function panel(side: 1 | -1) {
  const geometry = new PlaneGeometry(1, HEIGHT, FOLDS * 10, 6);
  const position = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
  for (let i = 0; i < position.count; i++) {
    const t = position.getX(i) + .5;
    position.setXYZ(i, side * t, position.getY(i) - HEIGHT / 2, Math.sin(t * FOLDS * Math.PI * 2) * FOLD_DEPTH);
    uv.setX(i, side > 0 ? t * .5 : 1 - t * .5);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Floor-length curtains on the glass wall's track. Open by default; a click
 * draws them together, where their two halves make one Clone Wars scene, and
 * another opens them onto the city again. They move only while drawing. */
export default function GlassCurtains() {
  const { mode, touring, roomFocus, viewpoint, viewpointMoving } = useSceneTransition();
  const reachable = roomReachable({ mode, touring, roomFocus, viewpoint, viewpointMoving }, [...VIEWS]);
  const closed = useRoomToggle("curtains");
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && reachable);

  const [art, setArt] = useState<Texture | null>(null);
  useEffect(() => {
    let alive = true, loaded: Texture | null = null;
    void claim(CURTAIN_ART).then((texture) => {
      if (!alive) { texture?.dispose(); return; }
      if (texture) {
        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
        gl.initTexture(texture);
        loaded = texture;
        setArt(texture);
        invalidate();
      }
      settleWall("curtains");
    });
    return () => { alive = false; loaded?.dispose(); };
  }, [gl, invalidate]);

  const kit = useMemo(() => ({ left: panel(1), right: panel(-1) }), []);
  useEffect(() => () => { kit.left.dispose(); kit.right.dispose(); }, [kit]);
  // Plain fabric in the print's own tone until the print has loaded.
  const material = useMemo(() => new MeshStandardMaterial({ map: art, color: art ? "#e2e2e8" : FABRIC, roughness: .92, side: DoubleSide, emissive: "#ffffff", emissiveIntensity: 0 }), [art]);
  useEffect(() => () => material.dispose(), [material]);
  const cloth = useRef<MeshStandardMaterial | null>(null);
  useLayoutEffect(() => { cloth.current = material; }, [material]);
  useEffect(() => { invalidate(); }, [closed, hovered, reachable, invalidate]);

  const panels = useRef<(Group | null)[]>([]);
  const run = useRef({ drawn: 0, glow: 0 });
  useFrame((_, delta) => {
    const r = run.current, target = closed ? 1 : 0, step = Math.min(delta, .05);
    r.drawn = target > r.drawn ? Math.min(1, r.drawn + step / SECONDS) : Math.max(0, r.drawn - step / SECONDS);
    const glowTarget = hovered && reachable ? 1 : 0;
    r.glow = MathUtils.damp(r.glow, glowTarget, 10, step);
    const eased = r.drawn * r.drawn * (3 - 2 * r.drawn);
    const width = MathUtils.lerp(GATHERED, DRAWN, eased);
    // Gathered cloth folds deeper; drawn, the folds relax.
    const depth = MathUtils.lerp(1.5, .75, eased);
    panels.current.forEach((group) => group?.scale.set(width, 1, depth));
    if (cloth.current) cloth.current.emissiveIntensity = r.glow * .05;
    if (r.drawn !== target || Math.abs(r.glow - glowTarget) > .003) invalidate();
  });

  const hover = {
    onPointerOver: (event: { stopPropagation(): void }) => { if (!reachable) return; event.stopPropagation(); setHovered(true); },
    onPointerOut: () => setHovered(false),
    onClick: (event: { stopPropagation(): void }) => { if (!reachable) return; event.stopPropagation(); flipRoomToggle("curtains"); },
  };
  return (
    <group name="glass curtains">
      <group ref={(group) => { panels.current[0] = group; }} position={[LEFT - HANG, TOP, Z]}>
        <mesh geometry={kit.left} material={material} castShadow receiveShadow raycast={() => {}} />
      </group>
      <group ref={(group) => { panels.current[1] = group; }} position={[RIGHT + HANG, TOP, Z]}>
        <mesh geometry={kit.right} material={material} castShadow receiveShadow raycast={() => {}} />
      </group>
      {closed ? (
        <mesh name="curtains hit" position={[GLASS_WALL.centre, BOTTOM + HEIGHT / 2, Z + .06]} {...hover}>
          <boxGeometry args={[GLASS_WALL.width + HANG * 2, HEIGHT, .12]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      ) : [LEFT - HANG + GATHERED / 2, RIGHT + HANG - GATHERED / 2].map((x) => (
        <mesh key={x} name="curtain hit" position={[x, BOTTOM + HEIGHT / 2, Z + .06]} {...hover}>
          <boxGeometry args={[GATHERED, HEIGHT, .2]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      ))}
    </group>
  );
}
