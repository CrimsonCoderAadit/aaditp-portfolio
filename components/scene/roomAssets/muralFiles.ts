/** Where each wall's artwork and the skyline are served, kept free of three.js
 * so the page can preload what the hero sees before the 3D bundle arrives. */
export type MuralWall = "back" | "left" | "right" | "front";
export type MuralFiles = { url: string; small?: string; glow?: string };

const panorama = (wall: "front" | "left" | "back"): MuralFiles => ({
  url: `/murals/panorama-${wall}.webp`, small: `/murals/panorama-${wall}-small.webp`, glow: `/murals/panorama-${wall}-glow.png`,
});

export const MURAL_FILES: Record<MuralWall, MuralFiles> = {
  back: panorama("back"),
  left: panorama("left"),
  right: { url: "/murals/right-wall-pixel.png" },
  front: panorama("front"),
};

/** The artwork printed across the two glass-wall curtains (see GlassCurtains). */
export const CURTAIN_ART = "/curtains/clone-wars.webp";

/** The Manhattan skyline beyond the balcony (see BalconyView). */
export const SKYLINE: MuralFiles = { url: "/skyline/manhattan-night.webp", small: "/skyline/manhattan-night-small.webp" };

/** The walls the City hero sees; the live scene replaces the hero poster only
 * once these, and the skyline, are painted. */
export const HERO_WALLS: MuralWall[] = ["back", "left", "right"];
/** Matches the artwork choice in useMuralMaps (which also steps down on low-memory devices). */
export const COMPACT_MURALS = "(max-width: 900px)";
