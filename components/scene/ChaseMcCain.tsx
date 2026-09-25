import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Html, useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { BoxGeometry, CylinderGeometry, Euler, MathUtils, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry, type Group } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { TABLETOP_Y } from "./districtLayout";
import { CAMPUS_SERVICE } from "./cityMasterplan";
import { useSceneTransition } from "./SceneTransition";
import { firePulse, usePulse } from "./roomInteractions";
import { discover } from "../room/discovery";

/** A small scene on the Projects campus service road, for anyone looking
 * closely: an undercover detective in police blue, his patrol car pulled up
 * beside him, and a works crew member pointing out the incident, one traffic
 * cone knocked flat. Built from plain bricks at the city's minifigure scale.
 * Hovering catches the glint of his badge; a click from the room brings the
 * camera in close, where he checks his scanner, a signal flashes by the cone
 * and he turns and points to it; clicking him there sets the car's lights
 * going while he radios it in. Table units, in the city's own frame. */

type V3 = [number, number, number];
type Finish = "uniform" | "trousers" | "badge" | "skin" | "hair" | "black" | "white" | "stripe" | "glass" | "rubber" | "hivis" | "grey" | "cone";

const ROAD = .030, WALK = .048;
const X = CAMPUS_SERVICE.centre;
const CAR: { at: V3; facing: number } = { at: [X - .005, ROAD, -1.56], facing: 0 };
const CHASE: { at: V3; facing: number } = { at: [X + .135, WALK, -1.49], facing: -Math.PI / 2 - .25 };
const WORKER: { at: V3; facing: number } = { at: [X + .14, WALK, -1.36], facing: -Math.PI / 2 - .6 };
const CONE: V3 = [X - .03, ROAD, -1.33];
const FLASH_SECONDS = 2.2;
/** The close-up's scene: scanner, signal, the turn and point, back to idle. */
const CASE_SECONDS = 3.2;
/** Where his head turns about, just above the torso. */
const NECK: V3 = [CHASE.at[0], CHASE.at[1] + .087, CHASE.at[2]];
/** The signal, on the road beside the knocked cone. */
const SIGNAL: V3 = [CONE[0] - .01, CONE[1] + .004, CONE[2] - .05];

const COLOURS: Record<Finish, string> = {
  uniform: "#2d4f9e", trousers: "#1f2a44", badge: "#d9b44a", skin: "#e3b53c", hair: "#5a3a22", black: "#1d1f22",
  white: "#e8e8e2", stripe: "#2d4f9e", glass: "#1a2230", rubber: "#161718", hivis: "#d77a2a", grey: "#7d8284", cone: "#e8742a",
};

function build() {
  const parts = new Map<Finish, BufferGeometry[]>();
  const headParts = new Map<Finish, BufferGeometry[]>();
  let into = parts;
  const box = new BoxGeometry(1, 1, 1), cylinder = new CylinderGeometry(1, 1, 1, 14);
  const matrix = new Matrix4(), rotation = new Quaternion(), euler = new Euler(0, 0, 0, "YXZ");
  const put = (finish: Finish, [ox, oy, oz]: V3, facing: number, [x, y, z]: V3, size: V3, tilt = 0, roll = 0, round = false) => {
    const c = Math.cos(facing), s = Math.sin(facing);
    euler.set(tilt, facing, roll);
    rotation.setFromEuler(euler);
    matrix.compose(new Vector3(ox + x * c + z * s, oy + y, oz - x * s + z * c), rotation, new Vector3(...size));
    const geometry = (round ? cylinder : box).clone().applyMatrix4(matrix);
    if (!into.has(finish)) into.set(finish, []);
    into.get(finish)!.push(geometry);
  };

  // A minifigure: legs, hips, torso, arms, hands, head. The right arm is
  // built on its own so it can lift the radio.
  const figure = (at: V3, facing: number, torso: Finish, legs: Finish, left: number, ownHead = false) => {
    const p = (finish: Finish, offset: V3, size: V3, tilt = 0, round = false) => put(finish, at, facing, offset, size, tilt, 0, round);
    const hip = .046;
    for (const x of [-.009, .009]) p(legs, [x, .022, 0], [.016, .044, .019]);
    p(legs, [0, hip, 0], [.036, .008, .021]);
    p(torso, [0, hip + .021, 0], [.034, .034, .02]);
    p(torso, [-.0225, hip + .02, left ? .01 : 0], [.009, .028, .011], left);
    p("skin", [-.0225, left ? hip + .026 : hip + .002, left ? .026 : .002], [.008, .008, .008]);
    if (ownHead) into = headParts;
    p("skin", [0, hip + .049, 0], [.0105, .02, .0105], 0, true);
    into = parts;
  };
  figure(CHASE.at, CHASE.facing, "uniform", "trousers", 0, true);
  const c = (finish: Finish, offset: V3, size: V3, tilt = 0, round = false) => put(finish, CHASE.at, CHASE.facing, offset, size, tilt, 0, round);
  c("black", [0, .0535, 0], [.036, .006, .0215]);
  c("badge", [-.008, .077, .0105], [.007, .008, .002]);
  c("white", [.008, .08, .0104], [.012, .003, .001]);
  // His hair: short at the sides, swept up at the front. The head turns on its own.
  into = headParts;
  c("hair", [0, .106, -.001], [.023, .007, .023]);
  c("hair", [0, .111, .006], [.018, .007, .01], -.5);
  c("black", [-.004, .098, .0106], [.003, .002, .001]);
  c("black", [.004, .098, .0106], [.003, .002, .001]);
  into = parts;

  figure(WORKER.at, WORKER.facing, "hivis", "grey", -1.45);
  const w = (finish: Finish, offset: V3, size: V3, tilt = 0, round = false) => put(finish, WORKER.at, WORKER.facing, offset, size, tilt, 0, round);
  w("hivis", [.0225, .066, 0], [.009, .028, .011]);
  w("skin", [.0225, .048, .002], [.008, .008, .008]);
  w("hivis", [0, .108, 0], [.0135, .009, .0135], 0, true);
  w("white", [0, .072, .0105], [.03, .003, .001]);

  // The patrol car.
  const k = (finish: Finish, offset: V3, size: V3, roll = 0, round = false) => put(finish, CAR.at, CAR.facing, offset, size, 0, roll, round);
  for (const x of [-.034, .034]) for (const z of [-.045, .045]) k("rubber", [x, .011, z], [.011, .008, .011], Math.PI / 2, true);
  k("white", [0, .024, 0], [.07, .02, .15]);
  k("stripe", [0, .026, 0], [.0705, .008, .152]);
  k("black", [0, .014, .077], [.066, .01, .004]);
  k("black", [0, .014, -.077], [.066, .01, .004]);
  k("white", [0, .045, -.012], [.062, .022, .07]);
  k("glass", [0, .046, .024], [.058, .018, .002]);
  k("glass", [0, .046, -.048], [.058, .016, .002]);
  for (const x of [-.0315, .0315]) k("glass", [x, .046, -.012], [.001, .014, .06]);
  k("black", [0, .058, -.012], [.046, .004, .012]);
  k("white", [0, .026, .076], [.05, .008, .002]);

  // The incident: one cone, knocked flat.
  const [cx, cy, cz] = CONE;
  put("cone", [cx, cy + .007, cz], .7, [0, 0, 0], [.009, .03, .009], 0, Math.PI / 2, true);
  put("white", [cx, cy + .007, cz], .7, [0, .004, 0], [.0095, .006, .0095], 0, Math.PI / 2, true);
  put("black", [cx - .014 * Math.cos(.7), cy + .002, cz + .014 * Math.sin(.7)], .7, [0, 0, 0], [.02, .004, .02]);

  box.dispose(); cylinder.dispose();
  const merge = (from: Map<Finish, BufferGeometry[]>) => [...from].map(([finish, list]) => {
    const merged = mergeGeometries(list)!;
    list.forEach((geometry) => geometry.dispose());
    return { finish, geometry: merged };
  });
  return { body: merge(parts), head: merge(headParts) };
}

export default function ChaseMcCain() {
  const { mode, touring, viewpointMoving, viewpoint, roomFocus, focusRoom } = useSceneTransition();
  const reachable = !touring && !viewpointMoving && (mode === "workbench" || mode === "projects");
  const close = mode === "workbench" && roomFocus === "chase" && viewpoint === "chase" && !viewpointMoving;
  const invalidate = useThree((state) => state.invalidate);
  const [hovered, setHovered] = useState(false);
  const calls = usePulse("chase");
  const [caseOpen, setCaseOpen] = useState(false);
  useCursor(hovered && reachable);

  const kit = useMemo(() => {
    const materials = Object.fromEntries(Object.entries(COLOURS).map(([finish, color]) => [finish, new MeshStandardMaterial({ color, roughness: finish === "glass" ? .2 : .45 })])) as Record<Finish, MeshStandardMaterial>;
    const lamp = (color: string) => new MeshStandardMaterial({ color: "#20242c", emissive: color, emissiveIntensity: .15, roughness: .3 });
    materials.badge.emissive.set("#ffd98a");
    materials.badge.emissiveIntensity = 0;
    const { body, head } = build();
    return {
      parts: body, head, materials, red: lamp("#ff3040"), blue: lamp("#3a7bff"),
      screen: new MeshStandardMaterial({ color: "#0c1a20", emissive: "#6fe3ff", emissiveIntensity: 0, roughness: .3 }),
      signal: new MeshStandardMaterial({ color: "#3a0a0a", emissive: "#ff2a1a", emissiveIntensity: 0, transparent: true, opacity: 0, roughness: .4 }),
      box: new BoxGeometry(1, 1, 1), ring: new CylinderGeometry(1, 1, 1, 24, 1, true),
      dispose() {
        [...this.parts, ...this.head].forEach(({ geometry }) => geometry.dispose());
        [...Object.values(this.materials), this.red, this.blue, this.screen, this.signal].forEach((material) => material.dispose());
        this.box.dispose(); this.ring.dispose();
      },
    };
  }, []);
  useEffect(() => () => kit.dispose(), [kit]);
  const lamps = useRef<{ red: MeshStandardMaterial; blue: MeshStandardMaterial; badge: MeshStandardMaterial; screen: MeshStandardMaterial; signal: MeshStandardMaterial } | null>(null);
  useLayoutEffect(() => { lamps.current = { red: kit.red, blue: kit.blue, badge: kit.materials.badge, screen: kit.screen, signal: kit.signal }; }, [kit]);

  const arm = useRef<Group>(null);
  const head = useRef<Group>(null);
  const signal = useRef<Group>(null);
  const run = useRef({ start: -1, seen: 0, scene: -1, glint: 0 });
  useEffect(() => { if (calls) { discover("chase"); invalidate(); } }, [calls, invalidate]);
  useEffect(() => { invalidate(); }, [hovered, invalidate]);
  // The close-up's scene plays each time the camera arrives.
  useEffect(() => { if (close) { run.current.scene = -2; invalidate(); } }, [close, invalidate]);

  useFrame((state, delta) => {
    const r = run.current, now = state.clock.elapsedTime, l = lamps.current;
    if (!l) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calls !== r.seen) { r.seen = calls; r.start = now; }
    if (r.scene === -2) r.scene = now;
    let busy = false;
    // Hover: a glint off the badge.
    const glint = hovered && reachable ? 1 : 0;
    r.glint = MathUtils.damp(r.glint, glint, 10, delta);
    l.badge.emissiveIntensity = r.glint * .9;
    if (Math.abs(r.glint - glint) > .004) busy = true;

    let raise = 0, look = 0, turn = 0, scan = 0, flash = 0;
    if (r.scene >= 0) {
      const t = (now - r.scene) / CASE_SECONDS;
      if (t >= 1) { r.scene = -1; setCaseOpen(false); }
      else {
        busy = true;
        const back = 1 - MathUtils.smoothstep(t, .8, 1);
        look = reduced ? 0 : MathUtils.smoothstep(t, .02, .2) * (1 - MathUtils.smoothstep(t, .34, .46));
        scan = MathUtils.smoothstep(t, .04, .14) * (1 - MathUtils.smoothstep(t, .4, .5));
        flash = MathUtils.smoothstep(t, .3, .36) * back;
        turn = reduced ? 0 : MathUtils.smoothstep(t, .4, .56) * back;
        raise = reduced ? 0 : MathUtils.smoothstep(t, .06, .18) * (1 - MathUtils.smoothstep(t, .36, .46)) * .6 + MathUtils.smoothstep(t, .46, .6) * back;
        if (t > .34 && !caseOpen && t < .8) setCaseOpen(true);
        if (t >= .8 && caseOpen) setCaseOpen(false);
      }
    }
    // A second click: the car's lights while he radios it in.
    let lights = 0;
    if (r.start >= 0) {
      const t = (now - r.start) / FLASH_SECONDS;
      if (t >= 1) r.start = -1;
      else { busy = true; lights = 1; raise = Math.max(raise, Math.min(1, Math.sin(Math.min(1, t * 1.1) * Math.PI) * 1.6)); }
    }
    // The scene closes with a short burst of the car's lights.
    if (r.scene >= 0) { const t = (now - r.scene) / CASE_SECONDS; if (t > .6 && t < .82) lights = 1; }
    const phase = Math.floor(now * 6) % 2;
    l.red.emissiveIntensity = lights ? (reduced || phase ? 2.2 : .3) : .15;
    l.blue.emissiveIntensity = lights ? (reduced || !phase ? 2.2 : .3) : .15;
    // Hover: the scanner flickers awake along with the badge's glint.
    l.screen.emissiveIntensity = Math.max(scan * 1.8, r.glint * (.5 + .35 * Math.sin(now * 23) ** 2));
    if (r.glint > .01) busy = true;
    const pulse = .55 + .45 * Math.sin(now * 9) ** 2;
    l.signal.emissiveIntensity = flash * 2.6 * pulse;
    l.signal.opacity = flash;
    if (signal.current) { signal.current.visible = flash > .01; signal.current.scale.setScalar(1 + (reduced ? 0 : .35 * ((now * 1.4) % 1)) * flash); }
    if (arm.current) arm.current.rotation.x = -2.3 * raise;
    if (head.current) head.current.rotation.set(look * .38, turn * .75, 0);
    if (busy) invalidate();
  });

  const cos = Math.cos(CHASE.facing), sin = Math.sin(CHASE.facing);
  const shoulder: V3 = [CHASE.at[0] + .0225 * cos, CHASE.at[1] + .078, CHASE.at[2] - .0225 * sin];
  const [lx, ly, lz] = CAR.at;
  return (
    <group name="undercover detective" position={[0, TABLETOP_Y, 0]}>
      {kit.parts.map(({ finish, geometry }) => <mesh key={finish} geometry={geometry} material={kit.materials[finish]} castShadow receiveShadow raycast={() => {}} />)}
      {/* The head turns about the neck in his own frame. */}
      <group position={NECK} rotation={[0, CHASE.facing, 0]}>
        <group ref={head} rotation-order="YXZ">
          <group rotation={[0, -CHASE.facing, 0]}>
            <group position={[-NECK[0], -NECK[1], -NECK[2]]}>
              {kit.head.map(({ finish, geometry }) => <mesh key={finish} geometry={geometry} material={kit.materials[finish]} castShadow raycast={() => {}} />)}
            </group>
          </group>
        </group>
      </group>
      <group ref={signal} position={SIGNAL} visible={false}>
        <mesh geometry={kit.box} material={kit.signal} position={[0, .012, 0]} scale={[.008, .024, .008]} raycast={() => {}} />
        <mesh geometry={kit.ring} material={kit.signal} position={[0, .001, 0]} scale={[.022, .002, .022]} raycast={() => {}} />
      </group>
      {caseOpen && (
        <Html position={[SIGNAL[0], SIGNAL[1] + .07, SIGNAL[2]]} center style={{ pointerEvents: "none" }}>
          <span className="city-tag">CASE OPEN</span>
        </Html>
      )}
      {/* The radio arm turns about its own shoulder, after the figure's facing. */}
      <group ref={arm} position={shoulder} rotation={[0, CHASE.facing, 0]} rotation-order="YXZ">
        <mesh geometry={kit.box} material={kit.materials.uniform} position={[0, -.012, 0]} scale={[.009, .028, .011]} raycast={() => {}} />
        <mesh geometry={kit.box} material={kit.materials.skin} position={[0, -.03, 0]} scale={[.008, .008, .008]} raycast={() => {}} />
        <mesh geometry={kit.box} material={kit.materials.black} position={[0, -.036, .004]} scale={[.006, .014, .004]} raycast={() => {}} />
        <mesh geometry={kit.box} material={kit.screen} position={[0, -.036, .0063]} scale={[.0045, .008, .0006]} raycast={() => {}} />
      </group>
      <mesh geometry={kit.box} material={kit.red} position={[lx - .012, ly + .063, lz - .012]} scale={[.018, .006, .01]} raycast={() => {}} />
      <mesh geometry={kit.box} material={kit.blue} position={[lx + .012, ly + .063, lz - .012]} scale={[.018, .006, .01]} raycast={() => {}} />
      <mesh
        name="detective hit"
        position={[X + .07, ROAD + .06, -1.47]}
        onPointerOver={(event) => { if (!reachable) return; event.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
        onClick={(event) => {
          if (!reachable) return;
          event.stopPropagation();
          if (mode === "workbench" && roomFocus !== "chase") focusRoom("chase");
          else firePulse("chase");
        }}
      >
        <boxGeometry args={[.24, .12, .3]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {hovered && reachable && !close && (
        <Html position={[CHASE.at[0], CHASE.at[1] + .16, CHASE.at[2]]} center style={{ pointerEvents: "none" }}>
          <span className="city-tag">CHASE</span>
        </Html>
      )}
    </group>
  );
}
