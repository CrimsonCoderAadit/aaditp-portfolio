import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Html, useCursor } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, CanvasTexture, CapsuleGeometry, Color, MathUtils, MeshBasicMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3, type Group, type Mesh } from "three";
import { Piece, useAssembled } from "./roomAssets/RoomSurfaces";
import { BLADE_LENGTH, buildHilt, buildSaberTable, SABERS, TABLE } from "./roomAssets/sabers";
import { bladeGlow } from "./saberGlow";
import { resetSabers, roomReachable, selectSaber, toggleSaber, useSabers } from "./roomInteractions";
import { useSceneTransition } from "./SceneTransition";
import { METRE, ROOM, SABER_TABLE_AT } from "./roomLayout";

const noRaycast = () => {};
/** Blades run out and back in over about this long; a picked-out hilt lifts this far (metres). */
const RATE = 9, LIFT = .012;
const UP = new Vector3(0, 1, 0);
const VIEWS = ["room", "corner"] as const;

/** A name plate's engraving, drawn once. */
function plateTexture(label: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 64;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#2a2116"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "600 30px ui-monospace, Menlo, monospace";
  g.fillText(label.toUpperCase().split("").join(" "), 128, 34);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** A soft round falloff for the blades' spill on the felt. */
function spillTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d")!;
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)"); gradient.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gradient; g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(canvas);
}

/** The saber collection on its display table. From the room, the whole stand
 * is one click into the collection's close view; there, each hilt picks out
 * on hover (or a first tap), lifting a touch with its plate brightening and
 * its holder warming in the blade's colour, and a click lights or douses its
 * blade. Blades glow and spill onto the felt without any real light, so the
 * collection costs nothing while it rests, and leaving puts every blade out. */
export default function SaberDisplay() {
  const { mode, touring, roomFocus, viewpoint, viewpointMoving, focusRoom } = useSceneTransition();
  const fromRoom = roomReachable({ mode, touring, roomFocus, viewpoint, viewpointMoving }, [...VIEWS]);
  const inside = mode === "workbench" && !touring && roomFocus === "sabers" && viewpoint === "sabers" && !viewpointMoving;
  const invalidate = useThree((state) => state.invalidate);
  const [standHover, setStandHover] = useState(false);
  const { selected, lit } = useSabers();
  const [hovered, setHovered] = useState(false);
  const pointerKind = useRef("mouse");
  useCursor((standHover && fromRoom) || (hovered && inside));
  const table = useAssembled(buildSaberTable);
  const hilts = [useAssembled(() => buildHilt("vader")), useAssembled(() => buildHilt("kenobi")), useAssembled(() => buildHilt("dooku")), useAssembled(() => buildHilt("skywalker")), useAssembled(() => buildHilt("maul"))];

  // Leaving the collection puts every blade out and clears the pick.
  useEffect(() => { if (roomFocus !== "sabers") resetSabers(); }, [roomFocus]);

  const kit = useMemo(() => {
    const spill = spillTexture();
    const blades = SABERS.map((saber) => ({
      id: saber.id,
      emitters: saber.emitters.map(({ at, toward }) => {
        const start = new Vector3(...at), dir = new Vector3(...toward).normalize();
        const end = start.clone().addScaledVector(dir, BLADE_LENGTH);
        const glow = bladeGlow(start.clone(), end.clone(), .045, saber.colour[0], saber.colour[1]);
        return { start, dir, glow, turn: new Quaternion().setFromUnitVectors(UP, dir) };
      }),
      core: new MeshBasicMaterial({ color: new Color(...saber.colour[1]), toneMapped: false }),
      halo: new MeshBasicMaterial({ color: new Color(...saber.colour[0]), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
      spill: new MeshBasicMaterial({ color: new Color(...saber.colour[0]), alphaMap: spill, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
      plateMap: plateTexture(saber.id === "skywalker" ? "Skywalker" : saber.id),
    }));
    const plates = blades.map((blade) => new MeshBasicMaterial({ map: blade.plateMap, color: "#b9a88a", transparent: true, depthWrite: false }));
    return { blades, plates, spill, capsule: new CapsuleGeometry(.0065, BLADE_LENGTH - .013, 4, 10), card: new PlaneGeometry(.1, .026), plane: new PlaneGeometry(1, 1) };
  }, []);
  useEffect(() => () => {
    kit.blades.forEach((blade) => { [blade.core, blade.halo, blade.spill, blade.plateMap].forEach((resource) => resource.dispose()); blade.emitters.forEach(({ glow }) => { glow.geometry.dispose(); glow.material.dispose(); }); });
    kit.plates.forEach((material) => material.dispose()); [kit.spill, kit.capsule, kit.card, kit.plane].forEach((resource) => resource.dispose());
  }, [kit]);

  const live = useRef<typeof kit | null>(null);
  useLayoutEffect(() => { live.current = kit; }, [kit]);
  const cores = useRef<(Mesh | null)[][]>([]);
  const hiltGroups = useRef<(Group | null)[]>([]);
  const run = useRef({ extension: SABERS.map(() => 0), pick: SABERS.map(() => 0) });
  useEffect(() => { invalidate(); }, [lit, selected, hovered, inside, invalidate]);

  // Frames only while something is still moving toward where it should be.
  useFrame((_, delta) => {
    const k = live.current, r = run.current, step = Math.min(delta, .05);
    if (!k) return;
    let busy = false;
    k.blades.forEach((blade, i) => {
      const target = lit[blade.id] ? 1 : 0, picked = inside && selected === blade.id ? 1 : 0;
      const settle = (value: number, goal: number, rate: number) => { const next = MathUtils.damp(value, goal, rate, step); if (Math.abs(next - goal) < .002) return goal; busy = true; return next; };
      const extension = r.extension[i] = settle(r.extension[i], target, RATE);
      const pick = r.pick[i] = settle(r.pick[i], picked, 12);
      blade.halo.opacity = pick * .45 + extension * .35;
      blade.spill.opacity = extension * .22;
      k.plates[i].color.setScalar(.72 + .28 * pick);
      hiltGroups.current[i]?.position.set(0, pick * LIFT, 0);
      blade.emitters.forEach((emitter, e) => {
        emitter.glow.material.uniforms.bladeEnd.value.copy(emitter.start).addScaledVector(emitter.dir, Math.max(extension, .001) * BLADE_LENGTH);
        emitter.glow.material.uniforms.intensity.value = extension > .001 ? 1 : 0;
        const core = cores.current[i]?.[e];
        if (!core) return;
        core.visible = extension > .01;
        core.scale.set(1, Math.max(extension, .01), 1);
        core.position.copy(emitter.start).addScaledVector(emitter.dir, extension * BLADE_LENGTH / 2);
      });
    });
    if (busy) invalidate();
  });

  return (
    <group name="saber display" position={[SABER_TABLE_AT.at[0], ROOM.floor, SABER_TABLE_AT.at[2]]} rotation={[0, SABER_TABLE_AT.turn, 0]} scale={METRE}>
      <Piece parts={table} />
      {kit.blades.map((blade, i) => (
        <group key={blade.id}>
          <group ref={(group) => { hiltGroups.current[i] = group; }}><Piece parts={hilts[i]} /></group>
          <mesh geometry={kit.card} material={kit.plates[i]} position={[SABERS[i].plate[0], SABERS[i].plate[1] + .0025, SABERS[i].plate[2]]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast} />
          <mesh geometry={kit.plane} material={blade.halo} position={[SABERS[i].hit.at[0], TABLE.height + .004, SABERS[i].hit.at[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={blade.id === "maul" ? [.4, .1, 1] : [.1, .1, 1]} raycast={noRaycast} renderOrder={1} />
          <mesh geometry={kit.plane} material={blade.spill} position={[SABERS[i].hit.at[0], TABLE.height + .005, SABERS[i].hit.at[2]]} rotation={[-Math.PI / 2, 0, 0]} scale={blade.id === "maul" ? [.7, .1, 1] : [.2, .15, 1]} raycast={noRaycast} renderOrder={1} />
          {blade.emitters.map((emitter, e) => (
            <group key={e}>
              <mesh ref={(mesh) => { (cores.current[i] ??= [])[e] = mesh; }} geometry={kit.capsule} material={blade.core} quaternion={emitter.turn} visible={false} raycast={noRaycast} />
              <mesh geometry={emitter.glow.geometry} material={emitter.glow.material} frustumCulled={false} raycast={noRaycast} renderOrder={3} />
            </group>
          ))}
          {inside && (
            <mesh name={`${blade.id} saber hit`} position={SABERS[i].hit.at}
              onPointerOver={(event) => { event.stopPropagation(); setHovered(true); if (event.pointerType === "mouse") selectSaber(blade.id); }}
              onPointerOut={(event) => { setHovered(false); if (event.pointerType === "mouse" && selected === blade.id) selectSaber(null); }}
              onPointerDown={(event) => { pointerKind.current = event.pointerType; }}
              onClick={(event) => {
                event.stopPropagation();
                // A tap picks a hilt out first; a click, or a second tap, lights it.
                if (pointerKind.current !== "mouse" && selected !== blade.id) { selectSaber(blade.id); return; }
                selectSaber(blade.id);
                toggleSaber(blade.id);
              }}>
              <boxGeometry args={SABERS[i].hit.size} />
              <meshBasicMaterial visible={false} />
            </mesh>
          )}
        </group>
      ))}
      {!inside && (
        <mesh name="saber stand hit" position={[0, TABLE.height / 2 + .2, 0]}
          onPointerOver={(event) => { if (!fromRoom) return; event.stopPropagation(); setStandHover(true); }}
          onPointerOut={() => setStandHover(false)}
          onClick={(event) => { if (!fromRoom) return; event.stopPropagation(); setStandHover(false); focusRoom("sabers"); }}>
          <boxGeometry args={[TABLE.length + .1, TABLE.height + .5, TABLE.depth + .1]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}
      {standHover && fromRoom && (
        <Html position={[0, TABLE.height + .62, 0]} center style={{ pointerEvents: "none" }}>
          <span className="city-tag">LIGHTSABER COLLECTION</span>
        </Html>
      )}
    </group>
  );
}
