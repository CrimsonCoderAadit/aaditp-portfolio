import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { CanvasTexture, LinearMipmapLinearFilter, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Texture } from "three";
import { Piece, useAssembled } from "./roomAssets/RoomSurfaces";
import { BALCONY_EDGE, buildBalcony } from "./roomAssets/balcony";
import { METRE } from "./roomLayout";
import { claim, settleWall, skylineFile } from "./roomAssets/murals";

const noRaycast = () => {};

/** The skyline plane beyond the balustrade, in scene units: how far past it,
 * how wide, and where its bottom edge sits. Sized so that through the balcony's
 * frame, from every camera the room allows, no edge of it can show; its
 * horizon (42% down the photograph) lands near a standing eye height. */
const SKYLINE = { distance: 10, width: 30, bottom: -3.6, aspect: 2560 / 1099, horizon: .42 } as const;
const SKYLINE_HEIGHT = SKYLINE.width / SKYLINE.aspect;
/** The photograph sits slightly below full brightness behind glass. */
const SKYLINE_TINT = "#dfe3ea";

/** A soft band of evening haze across the skyline's horizon. */
function hazeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1; canvas.height = 128;
  const context = canvas.getContext("2d")!;
  const gradient = context.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, "rgba(96, 118, 158, 0)");
  gradient.addColorStop(.5, "rgba(96, 118, 158, .16)");
  gradient.addColorStop(1, "rgba(96, 118, 158, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** The balcony beyond the glass wall and the Manhattan night past it: real
 * geometry for everything near, one photograph for the city. */
export default function BalconyView() {
  const balcony = useAssembled(buildBalcony);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const [skyline, setSkyline] = useState<Texture | null>(null);
  useEffect(() => {
    let alive = true, loaded: Texture | null = null;
    void claim(skylineFile()).then((texture) => {
      if (!alive) { texture?.dispose(); return; }
      if (texture) {
        texture.colorSpace = SRGBColorSpace;
        texture.generateMipmaps = true;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
        gl.initTexture(texture);
        loaded = texture;
        setSkyline(texture);
        invalidate();
      }
      settleWall("skyline");
    });
    return () => { alive = false; loaded?.dispose(); };
  }, [gl, invalidate]);

  const plane = useMemo(() => {
    const geometry = new PlaneGeometry(SKYLINE.width, SKYLINE_HEIGHT);
    const haze = new PlaneGeometry(SKYLINE.width, SKYLINE_HEIGHT * .3);
    const hazeMap = hazeTexture();
    return {
      geometry, haze, hazeMap,
      hazeMaterial: new MeshBasicMaterial({ map: hazeMap, transparent: true, depthWrite: false, toneMapped: false, fog: false }),
      z: BALCONY_EDGE.outer - SKYLINE.distance,
      y: SKYLINE.bottom + SKYLINE_HEIGHT / 2,
      horizonY: SKYLINE.bottom + SKYLINE_HEIGHT * (1 - SKYLINE.horizon),
    };
  }, []);
  const material = useMemo(() => skyline ? new MeshBasicMaterial({ map: skyline, color: SKYLINE_TINT, toneMapped: false, fog: false }) : null, [skyline]);
  useEffect(() => () => material?.dispose(), [material]);
  useEffect(() => () => { plane.geometry.dispose(); plane.haze.dispose(); plane.hazeMap.dispose(); plane.hazeMaterial.dispose(); }, [plane]);

  return (
    <group name="balcony view">
      <Piece name="balcony" parts={balcony} scale={METRE} />
      {material && <mesh name="manhattan skyline" geometry={plane.geometry} material={material} position={[0, plane.y, plane.z]} raycast={noRaycast} />}
      <mesh name="skyline haze" geometry={plane.haze} material={plane.hazeMaterial} position={[0, plane.horizonY, plane.z + .5]} raycast={noRaycast} renderOrder={1} />
    </group>
  );
}
