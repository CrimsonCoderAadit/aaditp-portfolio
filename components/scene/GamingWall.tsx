import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, type CanvasTexture } from "three";
import { CHASE_CANVAS, drawChase, drawKong, drawKongBacking, drawMarquee, KONG_GRID, MARQUEE, pixelTexture, posterTexture } from "./roomAssets/gamingWall";
import { firePulse, roomReachable, usePulse } from "./roomInteractions";
import { useSceneTransition } from "./SceneTransition";
import { GAMING_WALL, ROOM } from "./roomLayout";
import { discover } from "../room/discovery";

const noRaycast = () => {};
const PLAY_SECONDS = 1.7;
const SHEEN_SECONDS = 1.3;

function canvas(w: number, h: number) {
  const element = document.createElement("canvas");
  element.width = w; element.height = h;
  return element;
}

/** Wall art beside the media corner, hung on the left wall's front stretch: the
 * ape as a large pixel mural cut out along his silhouette on a shallow backing,
 * the detective's poster higher up, and a score marquee. Hovering the ape runs a
 * sheen across his pixels; a click pumps his fists while a barrel rolls along
 * the girder. The rest is scenery and takes no pointer. */
export default function GamingWall() {
  const { mode, touring, roomFocus, viewpoint, viewpointMoving } = useSceneTransition();
  const reachable = roomReachable({ mode, touring, roomFocus, viewpoint, viewpointMoving }, ["room", "corner", "kong"]);
  const arrived = roomFocus === "kong" && viewpoint === "kong" && !viewpointMoving;
  const invalidate = useThree((state) => state.invalidate);
  const anisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const [hovered, setHovered] = useState(false);
  useCursor(hovered && reachable);

  const art = useMemo(() => {
    const kongCanvas = canvas(KONG_GRID.w, KONG_GRID.h);
    drawKong(kongCanvas.getContext("2d")!);
    const backingCanvas = canvas(KONG_GRID.w, KONG_GRID.h);
    drawKongBacking(backingCanvas.getContext("2d")!, 1, "#ffffff");
    const chaseCanvas = canvas(CHASE_CANVAS.w, CHASE_CANVAS.h);
    drawChase(chaseCanvas.getContext("2d")!);
    const marqueeCanvas = canvas(MARQUEE.w, MARQUEE.h);
    drawMarquee(marqueeCanvas.getContext("2d")!);
    const kong = pixelTexture(kongCanvas), backing = pixelTexture(backingCanvas), chase = posterTexture(chaseCanvas, anisotropy), marquee = pixelTexture(marqueeCanvas);
    // Printed art lit by the room, lifted a little so it reads against the night mural.
    const printed = (map: CanvasTexture, lift: number) => new MeshStandardMaterial({ map, emissiveMap: map, emissive: "#ffffff", emissiveIntensity: lift, alphaTest: .5, roughness: .62 });
    const materials = {
      kong: printed(kong, .32),
      backing: new MeshStandardMaterial({ color: "#10131c", alphaMap: backing, alphaTest: .5, roughness: .45, metalness: .1 }),
      shadow: new MeshBasicMaterial({ color: "#000000", alphaMap: backing, transparent: true, opacity: .45, depthWrite: false }),
      chase: printed(chase, .3),
      chaseShadow: new MeshBasicMaterial({ color: "#000000", alphaMap: chase, transparent: true, opacity: .4, depthWrite: false }),
      marquee: printed(marquee, .75),
      frame: new MeshStandardMaterial({ color: "#15171c", roughness: .4, metalness: .3 }),
    };
    return { kongCanvas, textures: { kong, backing, chase, marquee }, materials, plane: new PlaneGeometry(1, 1) };
  }, [anisotropy]);
  useEffect(() => () => {
    Object.values(art.textures).forEach((texture) => texture.dispose());
    Object.values(art.materials).forEach((material) => material.dispose());
    art.plane.dispose();
  }, [art]);
  const mural = useRef<{ canvas: HTMLCanvasElement; texture: CanvasTexture } | null>(null);
  useLayoutEffect(() => { mural.current = { canvas: art.kongCanvas, texture: art.textures.kong }; }, [art]);

  const plays = usePulse("kong");
  useEffect(() => { if (arrived) firePulse("kong"); }, [arrived]);
  useEffect(() => { if (plays) discover("kong"); }, [plays]);
  useEffect(() => { invalidate(); }, [plays, hovered, reachable, invalidate]);

  const run = useRef({ start: -1, seen: 0, drawn: false });
  useFrame((state) => {
    const r = run.current, target = mural.current;
    if (!target) return;
    const now = state.clock.elapsedTime;
    if (plays !== r.seen) { r.seen = plays; r.start = now; }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let pose: { pump?: number; barrel?: number; sheen?: number } | null = null;
    if (r.start >= 0) {
      const t = (now - r.start) / PLAY_SECONDS;
      if (t >= 1) r.start = -1;
      else pose = reduced ? { pump: .5 } : { pump: Math.abs(Math.sin(t * Math.PI * 2)), barrel: t };
    }
    const shimmer = hovered && reachable && !reduced;
    if (shimmer) pose = { ...pose, sheen: (now % SHEEN_SECONDS) / SHEEN_SECONDS };
    if (pose || r.drawn) {
      drawKong(target.canvas.getContext("2d")!, pose ?? {});
      target.texture.needsUpdate = true;
      r.drawn = pose !== null;
      invalidate();
    }
  });

  const { kong, chase, marquee } = GAMING_WALL;
  const kongSize: [number, number] = [KONG_GRID.w * kong.pixel, KONG_GRID.h * kong.pixel];
  const wall = (along: number, y: number): [number, number, number] => [ROOM.left + .004, y, along];
  return (
    <group name="gaming wall">
      <group position={wall(kong.along, kong.bottom + kongSize[1] / 2)} rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={art.plane} material={art.materials.shadow} position={[.035, -.05, .002]} scale={[kongSize[0], kongSize[1], 1]} raycast={noRaycast} />
        <mesh geometry={art.plane} material={art.materials.backing} position={[0, 0, .014]} scale={[kongSize[0], kongSize[1], 1]} receiveShadow raycast={noRaycast} />
        <mesh geometry={art.plane} material={art.materials.kong} position={[0, 0, .03]} scale={[kongSize[0], kongSize[1], 1]} receiveShadow raycast={noRaycast} />
        <mesh
          name="gaming wall hit"
          position={[0, 0, .08]}
          onPointerOver={(event) => { if (!reachable) return; event.stopPropagation(); setHovered(true); }}
          onPointerOut={() => setHovered(false)}
          onClick={(event) => { if (!reachable) return; event.stopPropagation(); firePulse("kong"); }}
        >
          <boxGeometry args={[kongSize[0] * .82, kongSize[1] * .9, .12]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>
      <group position={wall(chase.along, chase.y)} rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={art.plane} material={art.materials.chaseShadow} position={[.03, -.045, .003]} scale={[chase.size[0], chase.size[1], 1]} raycast={noRaycast} />
        <mesh geometry={art.plane} material={art.materials.chase} position={[0, 0, .022]} scale={[chase.size[0], chase.size[1], 1]} receiveShadow raycast={noRaycast} />
      </group>
      <group position={wall(marquee.along, marquee.y)} rotation={[0, Math.PI / 2, 0]}>
        <mesh material={art.materials.frame} position={[0, 0, .016]} castShadow receiveShadow raycast={noRaycast}>
          <boxGeometry args={[marquee.size[0] + .05, marquee.size[1] + .05, .032]} />
        </mesh>
        <mesh geometry={art.plane} material={art.materials.marquee} position={[0, 0, .0325]} scale={[marquee.size[0], marquee.size[1], 1]} raycast={noRaycast} />
      </group>
    </group>
  );
}
