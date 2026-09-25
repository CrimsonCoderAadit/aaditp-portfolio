import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, MathUtils, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, type Group } from "three";
import { Piece, useAssembled } from "./roomAssets/RoomSurfaces";
import { BLACK_KING, buildBeanBag, buildChessLedge, buildChessMover, buildMediaCorner, MEDIA, MOVERS, SCHOLARS_MATE, square } from "./roomAssets/media";
import { paintGlow, paintHomeScreen } from "./roomAssets/framedArt";
import { playChess, roomReachable, setChessPly, useChessGame } from "./roomInteractions";
import { enterGameMode, prepareGameMode } from "../audio/gameMode";
import { useSceneTransition } from "./SceneTransition";
import { BEANBAG_AT, FRAMES, METRE, MEDIA_AT, ROOM } from "./roomLayout";

const REACH = ["room", "corner"] as const;
const CHESS_FRAME = FRAMES.find((frame) => frame.art === "chess")!;
/** The study's centre and size in the corner's metres. */
const STUDY = { y: CHESS_FRAME.y / METRE, size: CHESS_FRAME.size.map((side) => side / METRE) as [number, number] };
/** Scholar's Mate on a clock: a moment for the reset, then each move and a pause. */
const LEAD = .5, MOVE = .65, GAP = .3, PLY = MOVE + GAP;

const movers = MOVERS.map((_, i) => () => buildChessMover(i));

function settle(value: number, target: number, rate: number, step: number) {
  const next = MathUtils.damp(value, target, rate, step);
  return Math.abs(next - target) > .003 ? next : target;
}

/** The media corner and the chess study above it. The television idles on a
 * dim home screen and wakes when the visitor sits down to it; the study takes
 * a soft halo on hover, and in its close view the ledge set resets and plays
 * Scholar's Mate through, lighting each move's squares and the mated king. */
export default function RoomMedia() {
  const { mode, touring, roomFocus, viewpoint, viewpointMoving, focusRoom } = useSceneTransition();
  const reachable = roomReachable({ mode, touring, roomFocus, viewpoint, viewpointMoving }, [...REACH]);
  const atChess = roomFocus === "chess" && viewpoint === "chess" && !viewpointMoving;
  const awake = roomFocus === "media";
  const { run: chessRun } = useChessGame();
  const invalidate = useThree((state) => state.invalidate);
  const [hover, setHover] = useState<"media" | "chess" | "board" | null>(null);
  useCursor(hover !== null && (hover === "board" ? atChess : reachable));

  const corner = useAssembled(buildMediaCorner);
  const beanBag = useAssembled(buildBeanBag);
  const ledge = useAssembled(buildChessLedge);
  const pieces = [useAssembled(movers[0]), useAssembled(movers[1]), useAssembled(movers[2]), useAssembled(movers[3]), useAssembled(movers[4]), useAssembled(movers[5]), useAssembled(movers[6])];

  const kit = useMemo(() => {
    const plane = new PlaneGeometry(1, 1);
    const screenMap = paintHomeScreen();
    const screen = new MeshStandardMaterial({ color: "#000000", emissive: "#ffffff", emissiveMap: screenMap, emissiveIntensity: .12, roughness: .15 });
    const glowMap = paintGlow();
    const glow = (color: string) => new MeshBasicMaterial({ color, alphaMap: glowMap, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
    const bias = glow("#7a66ff"), halo = glow("#9d8cff");
    const power = new MeshBasicMaterial({ color: "#f2f5ff", transparent: true, opacity: .35 });
    const mark = (color: string) => new MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });
    const from = mark("#e8c46a"), to = mark("#e8c46a"), mate = mark("#e0412f");
    return {
      plane, screen, bias, halo, power, from, to, mate,
      dispose() { [plane, screenMap, screen, glowMap, bias, halo, power, from, to, mate].forEach((resource) => resource.dispose()); },
    };
  }, []);
  useEffect(() => () => kit.dispose(), [kit]);
  const live = useRef<typeof kit>(null);
  useLayoutEffect(() => { live.current = kit; }, [kit]);
  useEffect(() => { invalidate(); }, [awake, hover, reachable, atChess, chessRun, invalidate]);
  // Arriving at the study sets the board and plays the line.
  useEffect(() => { if (atChess && !touring) playChess(); }, [atChess, touring]);

  const moverGroups = useRef<(Group | null)[]>([]);
  const marks = useRef<{ from: Group | null; to: Group | null }>({ from: null, to: null });
  const motion = useRef({ wake: 0, media: 0, chess: 0, seen: chessRun, start: -1 });
  useFrame((_, delta) => {
    const m = motion.current, materials = live.current, now = performance.now() / 1000;
    if (!materials) return;
    const step = Math.min(delta, .05);
    const targets = { wake: awake ? 1 : 0, media: hover === "media" && reachable ? 1 : 0, chess: hover === "chess" && reachable ? 1 : 0 };
    m.wake = settle(m.wake, targets.wake, 3, step);
    m.media = settle(m.media, targets.media, 8, step);
    m.chess = settle(m.chess, targets.chess, 8, step);
    let moving = m.wake !== targets.wake || m.media !== targets.media || m.chess !== targets.chess;
    materials.screen.emissiveIntensity = MathUtils.lerp(.12, 1, m.wake);
    materials.bias.opacity = .07 + .28 * m.wake + .2 * m.media;
    materials.halo.opacity = .38 * m.chess;
    materials.power.opacity = .35 + .65 * m.wake;
    // The line runs on its own clock; pieces are posed from it, move by move.
    if (chessRun !== m.seen) { m.seen = chessRun; m.start = now; }
    const t = m.start < 0 ? -1 : now - m.start - LEAD;
    if (m.start >= 0 && t < SCHOLARS_MATE.length * PLY + .6) moving = true;
    const at = MOVERS.map((mover) => [...mover.from] as [number, number]);
    const pose = MOVERS.map((mover) => square(mover.from[0], mover.from[1]));
    const taken = MOVERS.map(() => 0);
    let ply = 0, active = -1;
    SCHOLARS_MATE.forEach((move, j) => {
      const begin = j * PLY;
      if (t < begin) return;
      ply = j + 1;
      if (t < begin + PLY) active = j;
      const k = Math.min(1, (t - begin) / MOVE), eased = k * k * (3 - 2 * k);
      const [fx, fy, fz] = square(...at[move.piece]), [tx, , tz] = square(move.to[0], move.to[1]);
      const lift = MOVERS[move.piece].kind === "knight" ? .03 : .006;
      pose[move.piece] = [MathUtils.lerp(fx, tx, eased), fy + Math.sin(Math.PI * eased) * lift, MathUtils.lerp(fz, tz, eased)];
      if (k >= 1) at[move.piece] = [move.to[0], move.to[1]];
      if (move.takes !== undefined) taken[move.takes] = MathUtils.smoothstep(k, .6, 1);
    });
    MOVERS.forEach((_, i) => {
      const group = moverGroups.current[i];
      if (!group) return;
      group.position.set(...pose[i]);
      group.scale.setScalar(1 - taken[i]);
      group.visible = taken[i] < 1;
    });
    if (m.start >= 0) setChessPly(ply);
    const move = active >= 0 ? SCHOLARS_MATE[active] : null;
    const fade = move ? Math.sin(Math.PI * Math.min(1, (t - active * PLY) / PLY)) : 0;
    materials.from.opacity = materials.to.opacity = .5 * fade;
    if (move && marks.current.from && marks.current.to) {
      const piece = MOVERS[move.piece], previous = SCHOLARS_MATE.slice(0, active).filter((earlier) => earlier.piece === move.piece).pop();
      const origin = previous ? previous.to : piece.from;
      marks.current.from.position.set(...square(origin[0], origin[1]));
      marks.current.to.position.set(...square(move.to[0], move.to[1]));
    }
    const mated = t >= (SCHOLARS_MATE.length - 1) * PLY + MOVE;
    materials.mate.opacity = mated ? .6 : 0;
    if (moving) invalidate();
  });

  const [sx, sy, sz] = MEDIA.screen.centre;
  const [sw, sh] = MEDIA.screen.size;
  const hoverable = (target: "media" | "chess") => ({
    onPointerOver: (event: { stopPropagation(): void }) => { if (!reachable) return; event.stopPropagation(); setHover(target); if (target === "media") prepareGameMode(); },
    onPointerOut: () => setHover((current) => (current === target ? null : current)),
    onClick: (event: { stopPropagation(): void }) => {
      if (!reachable) return;
      event.stopPropagation(); setHover(null);
      // The console is Game Mode: its music starts inside this click.
      if (target === "media") enterGameMode();
      focusRoom(target);
    },
  });

  return (
    <>
      <group name="media corner" position={[MEDIA_AT.at[0], ROOM.floor, MEDIA_AT.at[2]]} rotation={[0, MEDIA_AT.turn, 0]} scale={METRE}>
        <Piece parts={corner} />
        <Piece parts={ledge} />
        {(["from", "to"] as const).map((which) => (
          <group key={which} ref={(group) => { marks.current[which] = group; }}>
            <mesh geometry={kit.plane} material={kit[which]} position={[0, .0015, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[.026, .026, 1]} renderOrder={1} />
          </group>
        ))}
        <mesh geometry={kit.plane} material={kit.mate} position={[square(...BLACK_KING)[0], square(...BLACK_KING)[1] + .0015, square(...BLACK_KING)[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={[.026, .026, 1]} renderOrder={1} />
        {pieces.map((parts, i) => (
          <group key={i} ref={(group) => { moverGroups.current[i] = group; }} position={square(MOVERS[i].from[0], MOVERS[i].from[1])}>
            <Piece parts={parts} />
          </group>
        ))}
        <mesh geometry={kit.plane} material={kit.bias} position={[sx, sy, .016]} scale={[sw * 1.9, sh * 2.1, 1]} renderOrder={1} />
        <mesh geometry={kit.plane} material={kit.screen} position={[sx, sy, sz]} scale={[sw, sh, 1]} />
        <mesh geometry={kit.plane} material={kit.power} position={MEDIA.power} scale={[.014, .004, 1]} />
        <mesh geometry={kit.plane} material={kit.halo} position={[0, STUDY.y, .006]} scale={[STUDY.size[0] * 1.9, STUDY.size[1] * 1.6, 1]} renderOrder={1} />

        <mesh name="media hit" position={[0, .68, .2]} {...hoverable("media")}>
          <boxGeometry args={[1.0, 1.36, .42]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        <mesh name="chess hit" position={[0, 1.85, .11]} {...hoverable("chess")}>
          <boxGeometry args={[.62, .88, .22]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        {atChess && (
          <mesh
            name="chess board hit"
            position={[0, square(0, 0)[1] + .02, square(0, 3.5)[2]]}
            onPointerOver={(event) => { event.stopPropagation(); setHover("board"); }}
            onPointerOut={() => setHover(null)}
            onClick={(event) => { event.stopPropagation(); playChess(); }}
          >
            <boxGeometry args={[.24, .06, .24]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        )}
      </group>
      <Piece name="bean bag" parts={beanBag} at={[BEANBAG_AT.at[0], ROOM.floor, BEANBAG_AT.at[2]]} turn={BEANBAG_AT.turn} scale={METRE} />
    </>
  );
}
