import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from "three";
import { MURAL_TERMINAL } from "./roomAssets/frontMural";
import { roomReachable } from "./roomInteractions";
import { useSceneTransition } from "./SceneTransition";
import { ROOM } from "./roomLayout";

const noRaycast = () => {};
const DEPLOY_SECONDS = 1.8;
const LINES = { idle: "> build passed", deploying: "> deploying…", deployed: "> deployed ✓" } as const;
type Line = keyof typeof LINES;

function drawScreen(canvas: HTMLCanvasElement, line: Line, cursor: boolean) {
  const c = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  c.fillStyle = "#070b16"; c.fillRect(0, 0, w, h);
  c.strokeStyle = "#2b3470"; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
  c.fillStyle = "#39406e"; c.fillRect(14, 14, 10, 10); c.fillRect(30, 14, 10, 10); c.fillRect(46, 14, 10, 10);
  c.font = "600 54px ui-monospace, SFMono-Regular, Menlo, monospace";
  c.textBaseline = "middle";
  c.fillStyle = line === "deployed" ? "#8fe8ff" : "#7dffb0";
  const text = LINES[line];
  c.fillText(text, 28, h * .58);
  if (cursor) { c.fillRect(34 + c.measureText(text).width, h * .58 - 24, 26, 48); }
}

/** The terminal sign in the front wall's city: a small lit screen reading
 * "build passed". Clicked from the room view, it deploys: a beat of
 * "deploying…", then "deployed ✓", then back to rest. */
export default function MuralTerminal() {
  const { mode, touring, roomFocus, viewpoint, viewpointMoving } = useSceneTransition();
  const reachable = roomReachable({ mode, touring, roomFocus, viewpoint, viewpointMoving }, ["room"]);
  const invalidate = useThree((state) => state.invalidate);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && reachable);

  const screen = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 200;
    drawScreen(canvas, "idle", true);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    const material = new MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: "#ffffff", emissiveIntensity: .55, roughness: .4 });
    return { canvas, texture, material, plane: new PlaneGeometry(1, 1) };
  }, []);
  useEffect(() => () => { screen.texture.dispose(); screen.material.dispose(); screen.plane.dispose(); }, [screen]);
  const target = useRef<{ canvas: HTMLCanvasElement; texture: CanvasTexture } | null>(null);
  useLayoutEffect(() => { target.current = { canvas: screen.canvas, texture: screen.texture }; }, [screen]);

  const run = useRef({ start: -1, shown: "idle" as Line, cursor: true, pending: false });
  useEffect(() => { invalidate(); }, [hovered, reachable, invalidate]);
  useFrame((state) => {
    const r = run.current, t = target.current;
    if (!t) return;
    const now = state.clock.elapsedTime;
    if (r.pending) { r.pending = false; r.start = now; }
    let line: Line = "idle";
    if (r.start >= 0) {
      const k = (now - r.start) / DEPLOY_SECONDS;
      if (k >= 1) r.start = -1;
      else line = k < .3 ? "deploying" : "deployed";
    }
    const cursor = line !== "deployed" && Math.floor(now * 2) % 2 === 0;
    if (line !== r.shown || (r.start >= 0 && cursor !== r.cursor)) {
      r.shown = line; r.cursor = cursor;
      drawScreen(t.canvas, line, cursor);
      t.texture.needsUpdate = true;
    }
    if (r.start >= 0) invalidate();
  });

  const [w, h] = MURAL_TERMINAL.size;
  return (
    <group name="mural terminal" position={[MURAL_TERMINAL.x, MURAL_TERMINAL.y, ROOM.front - .006]} rotation={[0, Math.PI, 0]}>
      <mesh geometry={screen.plane} material={screen.material} scale={[w, h, 1]} raycast={noRaycast} />
      <mesh
        name="mural terminal hit"
        position={[0, 0, .04]}
        onPointerOver={(event) => { if (!reachable) return; event.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
        onClick={(event) => { if (!reachable) return; event.stopPropagation(); run.current.pending = true; invalidate(); }}
      >
        <boxGeometry args={[w * 1.3, h * 1.8, .08]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  );
}
