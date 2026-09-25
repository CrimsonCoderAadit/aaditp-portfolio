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
import AdaptiveResolution from "./AdaptiveResolution";
import TextureSharpness from "./TextureSharpness";
import ShadowCadence from "./ShadowCadence";
import { startup } from "./startup";
import type { RoomPixels } from "./roomAssets/surfaces";
import { RoomSurfacesProvider } from "./roomAssets/RoomSurfaces";
import { heroWallsPainted } from "./roomAssets/murals";
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

/** Renders the scene itself (priority 1 takes over the canvas's render) so the
 * first frame waits for the hero's walls and for every program to compile in
 * parallel, instead of compiling them one by one inside that frame. Announces
 * the hero ready one animation frame after that first frame, when it is on screen. */
function HeroFrame() {
  const get = useThree((state) => state.get);
  const invalidate = useThree((state) => state.invalidate);
  const [walls, setWalls] = useState(false);
  const done = useRef(false);
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
      void gl.compileAsync(scene, camera).catch(() => {}).then(() => { stage.current = "live"; invalidate(); });
      return;
    }
    if (stage.current === "compiling") return;
    gl.render(scene, camera);
    if (done.current) return;
    done.current = true;
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
      <AdaptiveResolution />
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
