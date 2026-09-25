import { useEffect } from "react";
import {
  DataTexture, LinearFilter, LinearMipmapLinearFilter, NearestFilter, NoColorSpace, RGBAFormat, SRGBColorSpace, Texture, TextureLoader,
} from "three";
import { CanvasTexture } from "three";
import { ROOM, ROOM_DEPTH, ROOM_WIDTH } from "../roomLayout";
import { paintFrontMural } from "./frontMural";

/** Full-wall murals. Each is mapped through a second UV set computed from
 * world position, so one image runs continuously across every plane a wall is
 * split into (around the window and the door) and stops exactly at the room's
 * corners, floor and ceiling line.
 *
 * The front, left and back walls are three slices of one panorama (built by
 * art/murals/build-panorama.py): one alien world with a shared horizon, cut at
 * the corners so every feature continues round them. The window wall carries
 * the ringed planet and the spire city; the left wall is its darker, quieter
 * side behind the display figure; the front wall its far edge. The right wall
 * keeps its own pixel-art city behind the workstation. */
import { COMPACT_MURALS, CURTAIN_ART, HERO_WALLS, MURAL_FILES, SKYLINE, type MuralWall } from "./muralFiles";

export type { MuralWall };

/** `aspect` is the artwork's width over height. The artwork covers its wall
 * without stretching: where the wall is proportionally wider than the image,
 * the image spans the wall's width and a band of its height is cropped away;
 * `focus` is the vertical centre of the kept band, 0 at the image's bottom
 * edge and 1 at its top. `level` balances each wall's paint against the others
 * under the same room light. `glow` is half-size emission data for the few
 * stars and city lights that glow (R emission, G shimmers, B phase). */
type Mural = { url: string; small?: string; glow?: string; pixel?: boolean; aspect: number; focus: number; level: string;
  /** Painting laid over the loaded artwork (and its glow data) before upload. */
  overlay?: (paint: CanvasRenderingContext2D, glow: CanvasRenderingContext2D | null) => void };

const panorama = (wall: "front" | "left" | "back", width: number): Mural => ({
  ...MURAL_FILES[wall], aspect: width / 1107, focus: .5, level: "#ffffff",
});

export const MURALS: Record<MuralWall, Mural> = {
  back: panorama("back", 4097),
  left: panorama("left", 2802),
  right: { ...MURAL_FILES.right, pixel: true, aspect: 496 / 250, focus: .5, level: "#e6e6e6" },
  front: { ...panorama("front", 4097), overlay: paintFrontMural },
};

/** The loaded image and glow redrawn on canvases with the wall's overlay on top. */
function withOverlay(mural: Mural, texture: Texture, glow: Texture | null) {
  if (!mural.overlay) return { texture, glow };
  const canvasOf = (image: CanvasImageSource & { width: number; height: number }) => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    return context;
  };
  const paint = canvasOf(texture.image);
  const data = glow ? canvasOf(glow.image) : null;
  mural.overlay(paint, data);
  texture.dispose(); glow?.dispose();
  return { texture: new CanvasTexture(paint.canvas), glow: data ? new CanvasTexture(data.canvas) : null };
}

/** Loading order: the hero sees the back wall first. */
const ORDER: MuralWall[] = ["back", "left", "right", "front"];

const FLOOR = ROOM.floor, HEIGHT = ROOM.ceiling - ROOM.floor;

/** Maps a wall fraction (0..1 across the wall's width and height) into the
 * image, cropping the image to the wall's proportions around its focus. */
function cover(mural: Mural, wallLength: number, u: number, v: number): [number, number] {
  const wallAspect = wallLength / HEIGHT;
  if (wallAspect >= mural.aspect) {
    const span = mural.aspect / wallAspect;
    const from = Math.min(1 - span, Math.max(0, mural.focus - span / 2));
    return [u, from + v * span];
  }
  const span = wallAspect / mural.aspect;
  return [(1 - span) / 2 + u * span, v];
}

/** Mural coordinates for a world point on a wall, as the viewer facing that
 * wall reads it: u left to right, v floor to ceiling. */
export function muralUV(wall: MuralWall, x: number, y: number, z: number): [number, number] {
  const v = (y - FLOOR) / HEIGHT;
  if (wall === "back") return cover(MURALS.back, ROOM_WIDTH, (x - ROOM.left) / ROOM_WIDTH, v);
  // Facing -X the viewer's left is the front of the room; facing +X, the back.
  if (wall === "left") return cover(MURALS.left, ROOM_DEPTH, (ROOM.front - z) / ROOM_DEPTH, v);
  if (wall === "front") return cover(MURALS.front, ROOM_WIDTH, (ROOM.right - x) / ROOM_WIDTH, v);
  return cover(MURALS.right, ROOM_DEPTH, (z - ROOM.back) / ROOM_DEPTH, v);
}

/** Mid wall tone, so the wall shaders compile with a map from the first frame
 * and nothing pops to white while the artwork streams in. */
export function muralPlaceholder() {
  const texture = new DataTexture(new Uint8Array([189, 182, 170, 255]), 1, 1, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.channel = 1;
  texture.needsUpdate = true;
  return texture;
}

const compactArtwork = () => {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return window.matchMedia(COMPACT_MURALS).matches || (memory !== undefined && memory < 4);
};
/** Artwork requested ahead of the room mounting, decoded off the upload path;
 * each is handed out once, so a remount fetches its own. */
const early = new Map<string, Promise<Texture | null>>();
const loader = new TextureLoader();
function request(url: string) {
  return loader.loadAsync(url).then(async (texture) => {
    await (texture.image as HTMLImageElement).decode?.().catch(() => {});
    return texture;
  }, () => null);
}
export function claim(url: string) {
  const pending = early.get(url);
  early.delete(url);
  return pending ?? request(url);
}
// The hero's walls start with the 3D code, not after the room's first frame.
if (typeof window !== "undefined") {
  const compact = compactArtwork();
  const skyline = skylineFile(compact);
  early.set(skyline, request(skyline));
  early.set(CURTAIN_ART, request(CURTAIN_ART));
  for (const wall of HERO_WALLS) {
    const { url, small, glow } = MURAL_FILES[wall];
    const paint = compact && small ? small : url;
    early.set(paint, request(paint));
    if (glow) early.set(glow, request(glow));
  }
}

/** The skyline's file for this screen and device. */
export function skylineFile(compact = compactArtwork()) {
  return compact ? SKYLINE.small! : SKYLINE.url;
}

let paintHeroWalls = () => {};
const heroPending = new Set<MuralWall | "skyline" | "curtains" | "vader">([...HERO_WALLS, "skyline", "curtains", "vader"]);
/** Settles once every wall the City hero sees, the skyline, the curtains' print and the display figure are in place or have failed to load. */
export const heroWallsPainted = new Promise<void>((resolve) => { paintHeroWalls = resolve; });
export function settleWall(wall: MuralWall | "skyline" | "curtains" | "vader") {
  heroPending.delete(wall);
  if (!heroPending.size) paintHeroWalls();
}

/** Streams the artwork in, wall by wall, handing each finished texture to
 * `onLoad` to replace that wall's placeholder map. Small screens get
 * half-resolution painted walls. */
export function useMuralMaps(maxAnisotropy: number, onLoad: (wall: MuralWall, texture: Texture, glow?: Texture) => void) {
  useEffect(() => {
    let cancelled = false;
    const loaded: Texture[] = [];
    const compact = compactArtwork();
    const load = async (wall: MuralWall) => {
        const mural = MURALS[wall];
        performance.mark(`studio:mural-${wall}-start`);
        const [loadedTexture, loadedGlow] = await Promise.all([
          claim(compact && mural.small ? mural.small : mural.url),
          mural.glow ? claim(mural.glow) : null,
        ]);
        if (!loadedTexture) { loadedGlow?.dispose(); performance.mark(`studio:mural-${wall}-failed`); settleWall(wall); return; }
        if (cancelled) { loadedTexture.dispose(); loadedGlow?.dispose(); return; }
        const { texture, glow } = withOverlay(mural, loadedTexture, loadedGlow);
        texture.colorSpace = SRGBColorSpace;
        texture.channel = 1;
        texture.generateMipmaps = true;
        texture.minFilter = LinearMipmapLinearFilter;
        // Pixel art keeps hard intentional pixels up close; mipmaps and
        // anisotropy keep it from shimmering at grazing angles.
        texture.magFilter = mural.pixel ? NearestFilter : LinearFilter;
        texture.anisotropy = Math.min(16, maxAnisotropy);
        loaded.push(texture);
        if (glow) {
          // Emission data, not colour: read linearly, filtered like the paint.
          glow.colorSpace = NoColorSpace;
          glow.channel = 1;
          glow.generateMipmaps = true;
          glow.minFilter = LinearMipmapLinearFilter;
          glow.magFilter = LinearFilter;
          glow.anisotropy = Math.min(16, maxAnisotropy);
          loaded.push(glow);
        }
        onLoad(wall, texture, glow ?? undefined);
        performance.mark(`studio:mural-${wall}-ready`);
        settleWall(wall);
    };
    // Each wall is independent: a stalled or failed request can never hold up
    // another mural or the first frame.
    for (const wall of ORDER) void load(wall);
    return () => {
      cancelled = true;
      loaded.forEach((texture) => texture.dispose());
    };
  }, [maxAnisotropy, onLoad]);
}
