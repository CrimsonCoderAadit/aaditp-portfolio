"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import Workbench from "./Workbench";
import Lighting from "./Lighting";
import CameraRig from "./CameraRig";
import ProjectsComplex from "./ProjectsComplex";
import ExperienceDistrict from "./ExperienceDistrict";
import ResearchDistrict from "./ResearchDistrict";
import SkillsDistrict from "./SkillsDistrict";
import AboutDistrict from "./AboutDistrict";
import AchievementsDistrict from "./AchievementsDistrict";
import ContactDistrict from "./ContactDistrict";
import CityInfrastructure from "./CityInfrastructure";
import CityLife from "./CityLife";
import RoomShell from "./RoomShell";
import RoomFurniture from "./RoomFurniture";
import RoomDecor from "./RoomDecor";
import VaderDisplay from "./VaderDisplay";
import RoomDetails from "./RoomDetails";
import RoomMedia from "./RoomMedia";
import GamingWall from "./GamingWall";
import MuralTerminal from "./MuralTerminal";
import DistrictFlags from "./DistrictFlags";
import ChaseMcCain from "./ChaseMcCain";
import RoomArt from "./RoomArt";
import WorkstationTerminal from "./WorkstationTerminal";
import BalconyView from "./BalconyView";
import GlassCurtains from "./GlassCurtains";
import SaberDisplay from "./SaberDisplay";
import CabinetWorkshop from "./CabinetWorkshop";
import MakerCart from "./MakerCart";
import StarClock from "./StarClock";
import QualityGovernor, { calibration } from "./QualityGovernor";
import { frameClock } from "./frameClock";
import { quality } from "./quality";
import { brickDetailFull, setBrickDetail } from "./brickGeometry/moldedEdges";
import type { Material, Mesh, Scene, Texture, WebGLRenderer } from "three";
import TextureSharpness from "./TextureSharpness";
import ShadowCadence from "./ShadowCadence";
import { startup } from "./startup";
import type { RoomPixels } from "./roomAssets/surfaces";
import { RoomSurfacesProvider } from "./roomAssets/RoomSurfaces";
import { heroWallsPainted } from "./roomAssets/murals";
import { onSceneCover, sceneCovered } from "./roomInteractions";
import { ABOUT_POSITION, ABOUT_TURN, ACHIEVEMENTS_POSITION, ACHIEVEMENTS_TURN, CITY_GROUP_POSITION, CONTACT_POSITION, CONTACT_TURN, RESEARCH_POSITION, RESEARCH_TURN, SKILLS_POSITION, SKILLS_TURN } from "./districtLayout";

/** Begin deterministic surface baking alongside the Canvas boot frame. */
const pendingPixels = typeof window === "undefined" ? null : new Promise<RoomPixels>((resolve, reject) => {
  startup("surfaces");
  let worker: Worker;
  const timeout = window.setTimeout(() => { worker?.terminate(); reject(new Error("Surface worker timed out")); }, 30000);
  try {
    worker = new Worker(new URL("./roomAssets/surfaces.worker.ts", import.meta.url));
    worker.onmessage = ({ data }: MessageEvent<{ pixels?: RoomPixels; error?: string }>) => {
      clearTimeout(timeout);
      worker.terminate();
      if (data.pixels) { performance.mark("studio:surfaces-complete"); resolve(data.pixels); }
      else reject(new Error(data.error || "Surface worker failed"));
    };
    worker.onerror = () => { clearTimeout(timeout); worker.terminate(); reject(new Error("Surface worker unavailable")); };
    worker.postMessage(null);
  } catch (error) { clearTimeout(timeout); reject(error); }
});
void pendingPixels?.catch(() => {});

/** A failed or stalled mural never holds the poster up longer than this. */
const WALLS_WAIT_MS = 8000;

/** The poster stays up while the first quality reading runs behind it (see
 * QualityGovernor), so any change of quality happens out of sight, and then
 * until the live scene draws steadily at its final quality: a few back-to-back
 * frames each under STEADY_MS, or at most STEADY_WAIT_MS more. HOLD_CAP_MS
 * bounds the whole wait, so a slow machine is never kept on the poster. */
const STEADY_MS = 50, STEADY_FRAMES = 3, STEADY_WAIT_MS = 1000, HOLD_CAP_MS = 9000;

/** Everything a first visit to a district would otherwise prepare on the spot,
 * done behind the poster: every texture in the scene is uploaded, and on tiers
 * that simplify bricks, one frame is drawn with full close-up bricks so their
 * buffers are on the GPU before any district is entered. */
function prewarm(gl: WebGLRenderer, scene: Scene, render: () => void) {
  const seen = new Set<Texture>();
  scene.traverse((object) => {
    const material = (object as Mesh).material;
    if (!material) return;
    for (const m of (Array.isArray(material) ? material : [material]) as (Material & Record<string, unknown>)[]) {
      for (const value of Object.values(m)) {
        const texture = value as Texture | null;
        if (texture && (texture as Texture).isTexture && !seen.has(texture) && texture.image) { seen.add(texture); gl.initTexture(texture); }
      }
    }
  });
  if (!brickDetailFull()) { setBrickDetail(true); render(); setBrickDetail(false); }
}

/** Renders the scene itself (priority 1 takes over the canvas's render) so the
 * first frame waits for the hero's walls and for every program to compile in
 * parallel, instead of compiling them one by one inside that frame. While a
 * full-screen game covers the room nothing is drawn at all; the canvas keeps
 * its last picture and the GPU is left to the game. */
function HeroFrame() {
  const get = useThree((state) => state.get);
  const invalidate = useThree((state) => state.invalidate);
  const [walls, setWalls] = useState(false);
  const done = useRef(false);
  const lastDrawn = useRef(0);
  const warm = useRef({ start: 0, last: 0, frames: 0, steady: 0, settledAt: 0 });
  useEffect(() => onSceneCover(() => { if (!sceneCovered()) invalidate(); }), [invalidate]);
  const stage = useRef<"waiting" | "compiling" | "live">("waiting");
  useEffect(() => {
    let alive = true;
    const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, WALLS_WAIT_MS));
    void Promise.race([heroWallsPainted, timeout]).then(() => { if (alive) { setWalls(true); invalidate(); } });
    return () => { alive = false; };
  }, [invalidate]);
  useEffect(() => {
    if (!new URLSearchParams(location.search).has("profile")) return;
    const target = window as Window & { __studio?: ReturnType<typeof get> };
    target.__studio = get();
    return () => { delete target.__studio; };
  }, [get]);
  useFrame(({ gl, scene, camera }) => {
    if (!walls) return;
    if (stage.current === "waiting") {
      stage.current = "compiling";
      void gl.compileAsync(scene, camera).catch(() => {}).then(() => {
        try { prewarm(gl, scene, () => gl.render(scene, camera)); } catch { /* best effort */ }
        stage.current = "live"; invalidate();
      });
      return;
    }
    frameClock.rendered = false;
    if (stage.current === "compiling" || (done.current && sceneCovered())) return;
    // Capped tiers draw at most every frameCapMs; skipped frames still ask for the next.
    const cap = quality.settings().frameCapMs, now0 = performance.now();
    if (done.current && cap && now0 - lastDrawn.current < cap) { invalidate(); return; }
    lastDrawn.current = now0;
    gl.render(scene, camera);
    frameClock.rendered = true;
    if (done.current) return;
    const w = warm.current, now = performance.now();
    if (!w.start) { w.start = now; calibration.begin(); }
    w.frames++;
    const held = now - w.start > HOLD_CAP_MS;
    if (calibration.phase !== "settled" && !held) { w.last = now; invalidate(); return; }
    // Steadiness counts only frames drawn at the settled quality.
    if (!w.settledAt) { w.settledAt = now; w.steady = 0; }
    else w.steady = now - w.last < STEADY_MS ? w.steady + 1 : 0;
    w.last = now;
    if (!held && w.steady < STEADY_FRAMES && now - w.settledAt < STEADY_WAIT_MS) { invalidate(); return; }
    done.current = true;
    performance.measure("studio:warm-frames", { start: w.start, end: now, detail: w.frames });
    requestAnimationFrame(() => startup("ready"));
  }, 1);
  return null;
}

export default function PortfolioWorld() {
  const [pixels, setPixels] = useState<RoomPixels | null>(null);
  useEffect(() => {
    let alive = true;
    // As a transition the world's first render yields between components
    // instead of building every piece of the room in one long task.
    pendingPixels?.then((data) => {
      if (alive) startTransition(() => setPixels(data));
    }).catch(() => { if (alive) startup("error"); });
    return () => { alive = false; };
  }, []);
  if (!pixels) return null;

  return (
    <>
      <HeroFrame />
      <QualityGovernor />
      <TextureSharpness />
      <ShadowCadence />
      <StarClock />
      <CameraRig />
      <Lighting />
      <RoomSurfacesProvider pixels={pixels}>
        <RoomShell />
        <RoomFurniture />
        <RoomDecor />
        <WorkstationTerminal />
        <RoomDetails />
        <RoomMedia />
        <GamingWall />
        <VaderDisplay />
        <RoomArt />
        <BalconyView />
        <GlassCurtains />
        <SaberDisplay />
        <CabinetWorkshop />
        <MakerCart />
        <MuralTerminal />
      </RoomSurfacesProvider>
      <group name="portfolio-workbench-world" position={CITY_GROUP_POSITION}>
        <Workbench />
        <CityInfrastructure />
        <CityLife />
        <ChaseMcCain />
        <ProjectsComplex />
        <ExperienceDistrict />
        <ResearchDistrict position={RESEARCH_POSITION} rotation={RESEARCH_TURN} />
        <SkillsDistrict position={SKILLS_POSITION} rotation={SKILLS_TURN} />
        <AboutDistrict position={ABOUT_POSITION} rotation={ABOUT_TURN} />
        <AchievementsDistrict position={ACHIEVEMENTS_POSITION} rotation={ACHIEVEMENTS_TURN} />
        <ContactDistrict position={CONTACT_POSITION} rotation={CONTACT_TURN} />
        <DistrictFlags />
      </group>
    </>
  );
}
