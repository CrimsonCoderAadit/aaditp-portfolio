"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import { preload } from "react-dom";
import { startup, type StartupStage } from "./startup";
import { SceneTransitionProvider, useSceneTransition, type Section } from "./SceneTransition";
import { PANEL_SECTIONS } from "./districtLayout";
import { VIEWPOINT_ORDER, VIEWPOINTS } from "./viewpoints";
import { preloadSystemRunner } from "./terminalBridge";
import { markCityExplored, useCityExplored } from "./cityHint";
import { RESUME } from "../content/resume";
import { TOUR_SEEN_KEY } from "../tour/tourKey";
import RoomControls from "../room/RoomControls";
import DiscoveryToast from "../room/DiscoveryToast";
import { COMPACT_MURALS, CURTAIN_ART, HERO_WALLS, MURAL_FILES, SKYLINE } from "./roomAssets/muralFiles";
import landscapePoster from "./heroPoster/landscape.webp";
import squarePoster from "./heroPoster/square.webp";
import tabletPoster from "./heroPoster/tablet.webp";
import phonePoster from "./heroPoster/phone.webp";

const PortfolioScene = dynamic(() => {
  startup("module");
  return import("./PortfolioScene").then((module) => {
    performance.mark("studio:module-complete");
    return module;
  });
}, { ssr: false });
const SystemRunner = dynamic(preloadSystemRunner, { ssr: false });
const BackgroundMusic = dynamic(() => import("../audio/BackgroundMusic"), { ssr: false });
/** Shown in place of a section's interface while its code is still arriving. */
function SectionLoading({ label }: { label: string }) {
  return <div className="section-loading" role="status">{label}</div>;
}
// Section content loads with its section, never on the room's startup path.
const ProjectsInterface = dynamic(() => import("../projects/ProjectsInterface"), { ssr: false, loading: () => <SectionLoading label="Opening the Projects campus" /> });
const ExperienceInterface = dynamic(() => import("../experience/ExperienceInterface"), { ssr: false, loading: () => <SectionLoading label="Opening the Experience tower" /> });
const ResearchInterface = dynamic(() => import("../research/ResearchInterface"), { ssr: false, loading: () => <SectionLoading label="Activating the Research lab" /> });
const SkillsInterface = dynamic(() => import("../skills/SkillsInterface"), { ssr: false, loading: () => <SectionLoading label="Activating the Skills workshop" /> });
const AboutInterface = dynamic(() => import("../about/AboutInterface"), { ssr: false, loading: () => <SectionLoading label="Opening the studio" /> });
const AchievementsInterface = dynamic(() => import("../achievements/AchievementsInterface"), { ssr: false, loading: () => <SectionLoading label="Lighting the Achievements plaza" /> });
// The tour's code arrives only when a visitor starts it.
const GuidedTour = dynamic(() => import("../tour/GuidedTour"), { ssr: false });
const ContactInterface = dynamic(() => import("../contact/ContactInterface"), { ssr: false, loading: () => <SectionLoading label="Opening a channel" /> });

const noSubscription = () => () => {};
const subscribeStage = (listener: () => void) => {
  window.addEventListener("studio-stage", listener);
  return () => window.removeEventListener("studio-stage", listener);
};
const heroFrameDrawn = () => performance.getEntriesByName("studio:ready").length > 0;
/** True once the live scene has put a finished hero frame on screen. */
const useHeroReady = () => useSyncExternalStore(subscribeStage, heroFrameDrawn, () => false);

/** Which poster serves which screen: each was rendered from the hero camera
 * (see viewpointPose) with a wider lens than any screen in its range, so the
 * live frame is a centred crop of it. Wide and landscape screens; near-square
 * screens (drawn for 21:20); tablets held upright (drawn for 3:4); phones. */
const POSTERS = [
  { media: "(min-aspect-ratio: 6/5)", src: landscapePoster.src },
  { media: "(min-aspect-ratio: 9/10) and (max-aspect-ratio: 6/5)", src: squarePoster.src },
  { media: "(min-aspect-ratio: 33/50) and (max-aspect-ratio: 9/10)", src: tabletPoster.src },
  { media: "(max-aspect-ratio: 33/50)", src: phonePoster.src },
];

/** The first thing on screen: the City hero as a still image, laid over the
 * live canvas until that has drawn the same view, then gone in a blink. Also
 * starts the hero's wall artwork and skyline downloading alongside the 3D code. */
function HeroPoster() {
  const ready = useHeroReady();
  const [gone, setGone] = useState(false);
  for (const { media, src } of POSTERS) preload(src, { as: "image", media, fetchPriority: "high" });
  for (const { url, small, glow } of [...HERO_WALLS.map((wall) => MURAL_FILES[wall]), SKYLINE, { url: CURTAIN_ART }]) {
    preload(url, { as: "image", crossOrigin: "anonymous", media: small ? `not all and ${COMPACT_MURALS}` : undefined });
    if (small) preload(small, { as: "image", crossOrigin: "anonymous", media: COMPACT_MURALS });
    if (glow) preload(glow, { as: "image", crossOrigin: "anonymous" });
  }
  if (gone) return null;
  return (
    <div className="hero-poster" aria-hidden="true" data-ready={ready || undefined} onTransitionEnd={() => { if (ready) setGone(true); }}>
      <picture>
        {POSTERS.slice(0, -1).map(({ media, src }) => <source key={src} media={media} srcSet={src} />)}
        <img src={POSTERS[POSTERS.length - 1].src} alt="" fetchPriority="high" onError={(event) => { event.currentTarget.hidden = true; }} />
      </picture>
    </div>
  );
}
const tourUnseen = () => { try { return sessionStorage.getItem(TOUR_SEEN_KEY) === null; } catch { return true; } };

/** Every section, in the order the keyboard entries list them: its name, its
 * interface, and for sections with entries the address parameter an open
 * entry is kept in and what the status line calls it. */
const SECTIONS: { id: Section; label: string; Interface: ComponentType; param?: string; entry?: string }[] = [
  { id: "projects", label: "Projects", Interface: ProjectsInterface, param: "project", entry: "Project detail" },
  { id: "experience", label: "Experience", Interface: ExperienceInterface, param: "experience", entry: "Experience detail" },
  { id: "research", label: "Research", Interface: ResearchInterface, param: "research", entry: "Publication detail" },
  { id: "skills", label: "Skills", Interface: SkillsInterface, param: "skill", entry: "Skill category detail" },
  { id: "about", label: "About", Interface: AboutInterface },
  { id: "achievements", label: "Achievements", Interface: AchievementsInterface, param: "achievement", entry: "Achievement detail" },
  { id: "contact", label: "Contact", Interface: ContactInterface },
];
const sectionOf = (id: Section) => SECTIONS.find((item) => item.id === id)!;

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { startup("error"); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Only a failed start (no WebGL, a failed module, a stalled GPU) says anything. */
function StudioError() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let ready = false;
    const update = (event: Event) => {
      const stage = (event as CustomEvent<StartupStage>).detail;
      if (stage === "ready") ready = true;
      if (stage === "error") setFailed(true);
    };
    window.addEventListener("studio-stage", update);
    // Bounded recovery for module download, unavailable WebGL or a stalled GPU.
    const timeout = window.setTimeout(() => { if (!ready) setFailed(true); }, 45000);
    return () => { clearTimeout(timeout); window.removeEventListener("studio-stage", update); };
  }, []);
  if (!failed) return null;
  return <div className="studio-error" role="alert">
    <p>The studio could not finish opening.</p>
    <button onClick={() => window.location.reload()}>Try again</button>
  </div>;
}

/** Minimal curated-viewpoint navigator: one dot per viewpoint, label on hover
 * or focus. Arrow keys step through viewpoints when nothing else has focus. */
function ViewpointNav() {
  const { mode, viewpoint, viewpointMoving, goToViewpoint, touring, roomFocus } = useSceneTransition();
  const ready = useHeroReady();
  useEffect(() => {
    const step = (event: KeyboardEvent) => {
      if (!ready || mode !== "workbench" || touring || roomFocus || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      const focused = document.activeElement;
      if (focused && focused !== document.body && !focused.closest(".viewpoint-nav")) return;
      event.preventDefault();
      const index = VIEWPOINT_ORDER.indexOf(viewpoint);
      const next = VIEWPOINT_ORDER[(index + (event.key === "ArrowRight" ? 1 : VIEWPOINT_ORDER.length - 1)) % VIEWPOINT_ORDER.length];
      goToViewpoint(next);
    };
    window.addEventListener("keydown", step);
    return () => window.removeEventListener("keydown", step);
  }, [ready, mode, viewpoint, goToViewpoint, touring, roomFocus]);
  if (mode !== "workbench" || touring || roomFocus) return null;
  return (
    <nav className="viewpoint-nav" aria-label="Room viewpoints" data-moving={viewpointMoving || undefined}>
      {VIEWPOINT_ORDER.map((id) => (
        <button key={id} type="button" className="viewpoint-dot" aria-label={`${VIEWPOINTS[id].label} view`} aria-current={viewpoint === id ? "true" : undefined}
          disabled={viewpointMoving || !ready} onClick={() => goToViewpoint(id)}>
          <span className="viewpoint-label" aria-hidden="true">{VIEWPOINTS[id].label}</span>
        </button>
      ))}
    </nav>
  );
}

/** A first-visit invitation under the city: shown on the City view, and put away for the session by the first district hover or
 * click, the tour, or after a few seconds on its own. */
function CityHint() {
  const { mode, viewpoint, viewpointMoving, touring, roomFocus } = useSceneTransition();
  const explored = useCityExplored();
  const showing = !explored && mode === "workbench" && viewpoint === "city" && !viewpointMoving && !touring && !roomFocus;
  useEffect(() => {
    if (!showing) return;
    const timer = window.setTimeout(markCityExplored, 9000);
    return () => window.clearTimeout(timer);
  }, [showing]);
  // A tap straight into a district, or the tour, counts as having found the way in.
  useEffect(() => { if (mode !== "workbench" || touring) markCityExplored(); }, [mode, touring]);
  return (
    <p className="city-hint" data-visible={showing || undefined} aria-hidden={!showing}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5v11l3-2.6 2 4.4 1.8-.8-2-4.3 4-.3z" /></svg>
      <span className="city-hint-fine">Hover over a district to explore</span>
      <span className="city-hint-coarse">Tap a district to explore</span>
    </p>
  );
}

function Experience({ resume }: { resume: string | null }) {
  const { mode, section, enter, leave, detailId, selectDetail, touring, setTouring, viewpointMoving, roomFocus } = useSceneTransition();
  // A close-up of a room object hides the room's chrome, like the tour does.
  const roomChrome = mode === "workbench" && !touring && !roomFocus;
  // Games take the whole screen and its attention: the résumé steps aside.
  const gaming = mode.startsWith("terminal") || roomFocus === "media";
  const ready = useHeroReady();
  // The tour invitation asks for a little attention until it has been taken once
  // this session; the server render never depends on it.
  const tourFresh = useSyncExternalStore(noSubscription, tourUnseen, () => false);
  const back = useRef<HTMLButtonElement>(null);
  const entries = useRef<Partial<Record<Section, HTMLButtonElement | null>>>({});
  const keyboardSession = useRef(false);
  const previous = useRef(mode);
  useEffect(() => {
    if (mode === section && keyboardSession.current) back.current?.focus({ preventScroll: true });
    if (mode === "workbench" && previous.current.startsWith("leaving-") && keyboardSession.current) {
      entries.current[section]?.focus({ preventScroll: true });
      keyboardSession.current = false;
    }
    previous.current = mode;
  }, [mode, section]);

  // Escape steps back one level at a time: entry → district → city.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || mode !== section || touring) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      if (detailId) selectDetail(null);
      else { keyboardSession.current = true; leave(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, section, detailId, selectDetail, leave, touring]);

  // `?project=<id>`, `?experience=<id>` or `?research=<id>` opens that section on that entry
  // once the studio is ready; the address follows the open entry from then on.
  // Read once per mount, inside effects; undefined means not yet read.
  const deepLink = useRef<{ section: Section; id: string } | null | undefined>(undefined);
  useEffect(() => {
    // Unknown ids are dropped when the section's interface validates them.
    if (deepLink.current === undefined) {
      const params = new URLSearchParams(window.location.search);
      const linked = SECTIONS.find((item) => item.param && params.get(item.param));
      deepLink.current = linked ? { section: linked.id, id: params.get(linked.param!)! } : null;
    }
    const link = deepLink.current;
    if (!link) return;
    const open = () => enter(link.section);
    const ready = (event: Event) => { if ((event as CustomEvent).detail === "ready") open(); };
    if (performance.getEntriesByName("studio:ready").length) open();
    else window.addEventListener("studio-stage", ready);
    return () => window.removeEventListener("studio-stage", ready);
  }, [enter]);
  useEffect(() => {
    if (deepLink.current && mode === deepLink.current.section) { selectDetail(deepLink.current.id); deepLink.current = null; }
  }, [mode, selectDetail]);
  useEffect(() => {
    if (deepLink.current) return;
    const url = new URL(window.location.href);
    const param = sectionOf(section).param;
    const next = new URL(url);
    SECTIONS.forEach((item) => { if (item.param) next.searchParams.delete(item.param); });
    if (param && detailId) next.searchParams.set(param, detailId);
    if (next.search === url.search) return;
    window.history.replaceState(window.history.state, "", next);
  }, [section, detailId]);

  return (
    <main className="workbench-hero" data-mode={mode}>
      <div className="scene" aria-label="Interactive engineering workbench and brick-built Projects district">
        <SceneBoundary><PortfolioScene /></SceneBoundary>
      </div>
      <HeroPoster />
      <StudioError />
      <BackgroundMusic game={mode.startsWith("terminal") || roomFocus === "media"} />
      {mode === "terminal" && <SystemRunner />}
      <ViewpointNav />
      <header className="identity" aria-hidden={!roomChrome} data-hidden={touring || roomFocus || undefined}>
        <h1 className="hero-name">
          <span className="hero-name-live">AADIT PRAVEEN NATH</span>
          <span className="hero-name-sizer" aria-hidden="true">AADIT PRAVEEN NATH</span>
        </h1>
        <p>Software Engineer <span>·</span> AI <span>·</span> Systems</p>
        {roomChrome && <div className="hero-actions">
          <button type="button" className="tour-start" data-fresh={tourFresh || undefined} disabled={viewpointMoving || !ready}
            onClick={() => setTouring(true)}>Take the tour <span aria-hidden="true">→</span></button>
          {resume && <a className="resume-link" href={resume} download={RESUME.file}>Download résumé <span aria-hidden="true">↓</span></a>}
        </div>}
      </header>
      {resume && !roomChrome && !gaming && <a className="resume-utility" href={resume} download={RESUME.file} aria-label="Download résumé (PDF)">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8m-3.5-3.5L8 10l3.5-3.5M3 13.5h10" /></svg><span>Résumé</span>
      </a>}
      <CityHint />
      {touring && <GuidedTour />}
      <RoomControls />
      <DiscoveryToast />
      {roomChrome && ready && SECTIONS.map((item) => <button key={item.id} ref={(button) => { entries.current[item.id] = button; }} className="projects-keyboard-entry"
        onClick={() => { keyboardSession.current = true; enter(item.id); }}>Open {item.label}</button>)}
      {/* A panel section's panel carries its own way back. */}
      {mode === section && !detailId && !touring && !PANEL_SECTIONS.has(section) && <button ref={back} className="workbench-back" onClick={leave}>← Back to City</button>}
      {/* The tour shows districts, never their content. */}
      {!touring && SECTIONS.map(({ id, Interface }) => mode === id && <Interface key={id} />)}
      <div className="scene-status" role="status">{mode === section ? (detailId ? sectionOf(section).entry : `${sectionOf(section).label} ${PANEL_SECTIONS.has(section) ? "view" : "architectural view"}`) : mode === "workbench" ? "Workbench overview" : ""}</div>
    </main>
  );
}

export default function SceneLoader({ resume }: { resume: string | null }) {
  return <SceneTransitionProvider><Experience resume={resume} /></SceneTransitionProvider>;
}
