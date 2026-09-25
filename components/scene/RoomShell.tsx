import { useCallback, useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Color, DataTexture, Float32BufferAttribute, PlaneGeometry, RGBAFormat, SRGBColorSpace, type MeshStandardMaterial, type Texture } from "three";
import { CITY_GROUP_POSITION } from "./districtLayout";
import { DOOR, GLASS_WALL, METRE, ROOM, ROOM_CENTRE_X, ROOM_CENTRE_Z, ROOM_DEPTH, ROOM_WIDTH } from "./roomLayout";
import { Piece, useAssembled, useRoomSurfaces } from "./roomAssets/RoomSurfaces";
import { bevelBox } from "./roomAssets/shapes";
import { buildArchitecture, doorLeaf } from "./roomAssets/architecture";
import { CEILING_SKY, STAR_TIME, paintNightSky, skyTextures, type SkyImages } from "./roomAssets/nightSky";
import { QUALITY } from "./quality";
import { COVE_LIP, COVE_STRENGTH, DESK_GLOW, DESK_WASH, VIOLET } from "./roomAssets/ambience";
import { MURALS, muralPlaceholder, muralUV, useMuralMaps, type MuralWall } from "./roomAssets/murals";

type Vector = [number, number, number];
const noRaycast = () => {};

/** A single black texel on the mural channel, so a material compiles with its
 * emissive map from the first frame and never recompiles when the sky arrives. */
const blackTexture = () => {
  const texture = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.channel = 1;
  texture.needsUpdate = true;
  return texture;
};

/** The ceiling's sky is painted in a worker, or on the main thread (after a
 * yield) if no worker can run. Low-tier devices paint the same sky at half
 * size: four times the star density and half the star size keep it looking the same. */
const paintSky = () => new Promise<SkyImages>((resolve) => {
  const spec = QUALITY.tier === "low" ? { ...CEILING_SKY, width: CEILING_SKY.width / 2, height: Math.round(CEILING_SKY.height / 2), stars: CEILING_SKY.stars * 4, starScale: (CEILING_SKY.starScale ?? 1) / 2 } : CEILING_SKY;
  const onMainThread = () => window.setTimeout(() => resolve(paintNightSky(spec)), 0);
  try {
    const worker = new Worker(new URL("./roomAssets/nightSky.worker.ts", import.meta.url));
    worker.onmessage = ({ data }: MessageEvent<Partial<SkyImages> & { error?: string }>) => {
      worker.terminate();
      if (data.color && data.glow) resolve({ color: data.color, glow: data.glow });
      else onMainThread();
    };
    worker.onerror = () => { worker.terminate(); onMainThread(); };
    worker.postMessage(spec);
  } catch { onMainThread(); }
});
/** The first sky starts painting as this module loads, alongside the room's
 * construction; it is handed out once, so a remount paints its own. */
let earlySky = typeof window === "undefined" ? null : paintSky();

/** Plane whose UVs are in metres, so paint and floor detail keep true scale. */
function metrePlane(width: number, height: number) {
  const geometry = new PlaneGeometry(width, height);
  const uv = geometry.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * width / METRE, uv.getY(i) * height / METRE);
  return geometry;
}

/** Second UV set carrying the wall's mural coordinates, from each vertex's
 * world position, so a mural runs unbroken across every plane of its wall. */
function withMuralUVs(geometry: PlaneGeometry, wall: MuralWall, [ax, ay, az]: Vector) {
  const position = geometry.getAttribute("position");
  const uv1 = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const lx = position.getX(i), y = ay + position.getY(i);
    // Local +X runs to world +X on the back wall, -X on the front, -Z on the left, +Z on the right.
    const [x, z] = wall === "back" ? [ax + lx, az] : wall === "front" ? [ax - lx, az] : wall === "left" ? [ax, az - lx] : [ax, az + lx];
    uv1.set(muralUV(wall, x, y, z), i * 2);
  }
  geometry.setAttribute("uv1", new Float32BufferAttribute(uv1, 2));
  return geometry;
}

/** Soft occlusion where planes meet: walls darken toward the floor and the
 * corners, the floor toward the skirting. Computed from world position against
 * the shell bounds, so it costs no texture and no extra pass.
 *
 * The same hook adds the room's bounce: warm light returned from the lit right
 * side of the room. The key runs parallel to the left wall, so without this
 * that wall falls to black; with it the wall reads as dimly lit paint while
 * staying darker than the back wall. The ceiling gets the floor's warm bounce
 * for the same reason: it faces away from every direct source. */
function withJunctionOcclusion(material: MeshStandardMaterial, key: string, mural = false, shimmer = false) {
  material.onBeforeCompile = (shader) => {
    if (shimmer) {
      // The glow map is data, not colour: R is a star's emission, G marks
      // the few that shimmer and B is each one's phase, which also sets its
      // own slow period of 3 to 8 seconds. The hue comes from the painted
      // star beneath, so only stars ever emit.
      shader.uniforms.starTime = STAR_TIME;
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float starTime;")
        .replace("#include <emissivemap_fragment>", `#ifdef USE_EMISSIVEMAP
          vec4 starData = texture2D(emissiveMap, vEmissiveMapUv);
          float starPeriod = mix(3.0, 8.0, fract(starData.b * 7.13));
          float starShimmer = 1.0 + starData.g * .28 * sin(starTime * 6.2832 / starPeriod + starData.b * 6.2832);
          vec3 starHue = diffuseColor.rgb / max(max(diffuseColor.r, diffuseColor.g), max(diffuseColor.b, .04));
          totalEmissiveRadiance *= starHue * starData.r * starShimmer;
        #endif`);
    }
    if (mural) {
      // The artwork is the paint's colour, not a decal over it: the same roller
      // relief that drives the wall's bump and roughness also breaks up the
      // pigment slightly, so the image sits in the wall's surface.
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <map_fragment>", `#ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D(map, vMapUv);
          #ifdef USE_BUMPMAP
            sampledDiffuseColor.rgb *= .94 + .12 * texture2D(bumpMap, vBumpMapUv).r;
          #endif
          diffuseColor *= sampledDiffuseColor;
        #endif`);
    }
    shader.uniforms.coveStrength = COVE_STRENGTH;
    shader.uniforms.deskGlow = DESK_GLOW;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRoomPosition;\nvarying vec3 vRoomNormal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRoomPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvRoomNormal = normalize(mat3(modelMatrix) * objectNormal);");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRoomPosition;\nvarying vec3 vRoomNormal;\nuniform float coveStrength;\nuniform float deskGlow;")
      .replace("#include <aomap_fragment>", `#include <aomap_fragment>
        vec3 roomNormal = normalize(vRoomNormal);
        float junction = 1.0;
        if (abs(roomNormal.y) < .5) junction *= mix(.74, 1.0, smoothstep(0.0, .85, vRoomPosition.y - ${ROOM.floor.toFixed(3)}));
        if (abs(roomNormal.x) < .5) junction *= mix(.8, 1.0, smoothstep(0.0, .7, min(vRoomPosition.x - (${ROOM.left.toFixed(3)}), ${ROOM.right.toFixed(3)} - vRoomPosition.x)));
        if (abs(roomNormal.z) < .5) junction *= mix(.8, 1.0, smoothstep(0.0, .7, vRoomPosition.z - (${ROOM.back.toFixed(3)})));
        vec3 bounceDirection = normalize(vec3(1.0, .37, .29));
        reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(.142, .133, .122) * max(dot(roomNormal, bounceDirection), 0.0);
        // The front wall faces the whole lit room and table; it takes the same
        // strength of return the left wall gets, from behind the visitor.
        reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(.142, .136, .13) * max(-roomNormal.z, 0.0);
        // The ceiling faces the lit floor and warm lamps, not the sky. The
        // painted sky ceiling takes a cooler return, strongest over the model
        // table where the key and the table spot pool on the floor below.
        ${shimmer ? `float tablePool = exp(-dot(vRoomPosition.xz - vec2(${CITY_GROUP_POSITION[0].toFixed(2)}, ${CITY_GROUP_POSITION[2].toFixed(2)}), vRoomPosition.xz - vec2(${CITY_GROUP_POSITION[0].toFixed(2)}, ${CITY_GROUP_POSITION[2].toFixed(2)})) / 60.0);
        reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(.42, .43, .5) * (.6 + .6 * tablePool) * max(-roomNormal.y, 0.0);` : `reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(.2, .17, .13) * max(-roomNormal.y, 0.0);`}
        reflectedLight.indirectDiffuse *= junction;
        reflectedLight.indirectSpecular *= junction;
        reflectedLight.directDiffuse *= mix(1.0, junction, .45);
        ${mural ? `float towardCeiling = mix(1.0, .6, smoothstep(${(ROOM.ceiling - 1.5).toFixed(2)}, ${ROOM.ceiling.toFixed(2)}, vRoomPosition.y));
        reflectedLight.directDiffuse *= towardCeiling; reflectedLight.indirectDiffuse *= towardCeiling;` : ""}
        // Violet accent, added after the occlusion because it is brightest in
        // the corners it comes from. The cove strip sits on a lip just below
        // the ceiling: the wall above the lip and a band of ceiling along each
        // wall catch it, the wall below the lip only a little spill, and the
        // ceiling's centre none at all.
        vec3 violet = vec3(${VIOLET.join(", ")});
        vec3 accentAlbedo = diffuseColor.rgb + (roomNormal.y < -.5 ? .2 : .045);
        float belowCeiling = ${ROOM.ceiling.toFixed(3)} - vRoomPosition.y;
        float coveLight = 0.0;
        if (abs(roomNormal.y) < .5) coveLight = belowCeiling < ${COVE_LIP.toFixed(3)}
          ? mix(1.0, .55, belowCeiling / ${COVE_LIP.toFixed(3)})
          : .2 * exp(-(belowCeiling - ${COVE_LIP.toFixed(3)}) / .32);
        else if (roomNormal.y < -.5) {
          float fromWall = min(min(vRoomPosition.x - (${ROOM.left.toFixed(3)}), ${ROOM.right.toFixed(3)} - vRoomPosition.x), min(vRoomPosition.z - (${ROOM.back.toFixed(3)}), ${ROOM.front.toFixed(3)} - vRoomPosition.z));
          coveLight = .8 * exp(-fromWall / .42);
        }
        reflectedLight.indirectDiffuse += accentAlbedo * violet * coveLight * .9 * coveStrength;
        // The workstation's bias strips light the right wall behind the
        // monitors; the under-desk strip a faint pool on the wall and floor.
        float deskLight = 0.0;
        if (roomNormal.x < -.5) {
          vec2 bias = (vRoomPosition.zy - vec2(${DESK_WASH.along.toFixed(3)}, ${DESK_WASH.bias.y.toFixed(3)})) / vec2(${DESK_WASH.bias.spread.map((v) => v.toFixed(3)).join(", ")});
          vec2 under = (vRoomPosition.zy - vec2(${DESK_WASH.along.toFixed(3)}, ${DESK_WASH.under.y.toFixed(3)})) / vec2(${DESK_WASH.under.spread.map((v) => v.toFixed(3)).join(", ")});
          deskLight = exp(-dot(bias, bias)) + .35 * exp(-dot(under, under));
        } else if (roomNormal.y > .5) {
          vec2 pool = (vRoomPosition.xz - vec2(${DESK_WASH.floor.x.toFixed(3)}, ${DESK_WASH.along.toFixed(3)})) / vec2(${DESK_WASH.floor.spread.map((v) => v.toFixed(3)).join(", ")});
          deskLight = .3 * exp(-dot(pool, pool));
        }
        reflectedLight.indirectDiffuse += accentAlbedo * violet * deskLight * 1.1 * deskGlow;
      `);
  };
  material.customProgramCacheKey = () => `room-junction-bounce-accent-${mural ? "mural-" : ""}${shimmer ? "star-" : ""}${key}`;
  return material;
}

/** Existing bench height defines scale: 1.75 scene units ≈ 1 metre.
 * A closed box: floor, ceiling and four walls meet exactly at the room's
 * bounds, and every camera stays inside it, so no view can reach past the
 * architecture. Openings (window, door) carry their own reveals and jambs.
 */
export default function RoomShell() {
  const surfaces = useRoomSurfaces();
  const architecture = useAssembled(buildArchitecture);
  const { floor, ceiling } = useMemo(() => ({
    floor: withJunctionOcclusion(surfaces.floor, "floor"),
    // The ceiling is a deep night sky under the room's lamps.
    ceiling: withJunctionOcclusion(Object.assign(surfaces.materials.wall.clone(), { map: blackTexture(), emissiveMap: blackTexture(), emissive: new Color("#ffffff"), emissiveIntensity: 1.1 }), "ceiling", false, true),
  }), [surfaces]);
  useEffect(() => () => { ceiling.map?.dispose(); ceiling.emissiveMap?.dispose(); ceiling.dispose(); }, [ceiling]);
  const invalidate = useThree((state) => state.invalidate);
  const gl = useThree((state) => state.gl);
  const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
  useEffect(() => {
    let cancelled = false;
    const pending = earlySky ?? paintSky();
    earlySky = null;
    void pending.then((images) => {
      if (cancelled) return;
      const sky = skyTextures(images, maxAnisotropy);
      for (const old of [ceiling.map, ceiling.emissiveMap]) old?.dispose();
      ceiling.map = sky.map; ceiling.emissiveMap = sky.glow;
      invalidate();
    });
    return () => { cancelled = true; };
  }, [ceiling, gl, maxAnisotropy, invalidate]);
  // One painted-wall material per mural: the same matte paint response and
  // roller texture as the rest of the shell, with the artwork as its colour.
  const murals = useMemo(() => {
    const paint = (wall: MuralWall) => {
      const material = surfaces.materials.wall.clone();
      material.color.set(MURALS[wall].level);
      material.map = muralPlaceholder();
      if (MURALS[wall].glow) {
        // The brightest stars and city lights are tiny emissive accents.
        material.emissiveMap = blackTexture();
        material.emissive = new Color("#ffffff");
        material.emissiveIntensity = 1.1;
      }
      return withJunctionOcclusion(material, wall, true, !!MURALS[wall].glow);
    };
    return { back: paint("back"), left: paint("left"), right: paint("right"), front: paint("front") } as Record<MuralWall, MeshStandardMaterial>;
  }, [surfaces]);
  // The door leaf in the room's own door paint, the deep night navy its
  // panel mouldings (casingNight) were drawn against, not the wall's mural.
  const doorPaint = surfaces.materials.doorNight;
  const doorGeometry = useMemo(() => {
    const leaf = doorLeaf();
    const geometry = bevelBox(leaf.size, .003, "y");
    geometry.scale(METRE, METRE, METRE);
    geometry.translate(...leaf.at);
    return geometry;
  }, []);
  useEffect(() => () => doorGeometry.dispose(), [doorGeometry]);
  useEffect(() => () => Object.values(murals).forEach((material) => { material.map?.dispose(); material.emissiveMap?.dispose(); material.dispose(); }), [murals]);
  const paintMural = useCallback((muralWall: MuralWall, texture: Texture, glow?: Texture) => {
    const material = murals[muralWall];
    const previous = material.map;
    // Swapping a material's map is imperative GPU state, like the camera rig.
    // eslint-disable-next-line react-hooks/immutability
    material.map = texture;
    if (glow) { material.emissiveMap?.dispose(); material.emissiveMap = glow; }
    // Upload now, not on the first frame that sees the wall.
    gl.initTexture(texture);
    if (glow) gl.initTexture(glow);
    // Only the first-frame placeholder is ours to free; loaded maps are the loader's.
    if ((previous as DataTexture | null)?.isDataTexture) previous!.dispose();
    invalidate();
  }, [murals, invalidate, gl]);
  useMuralMaps(maxAnisotropy, paintMural);

  const openingLeft = GLASS_WALL.centre - GLASS_WALL.width / 2;
  const openingRight = GLASS_WALL.centre + GLASS_WALL.width / 2;
  const doorFrom = DOOR.centre - DOOR.width / 2, doorTo = DOOR.centre + DOOR.width / 2;
  const planes = useMemo(() => {
    const { left, right, back, front, floor: y0, ceiling: y1 } = ROOM;
    const height = y1 - y0, midY = (y0 + y1) / 2;
    const doorTop = y0 + DOOR.head;
    return [
      // Back wall: the two piers either side of the glass wall.
      { wall: "back", at: [(left + openingLeft) / 2, midY, back], turn: 0, size: [openingLeft - left, height] },
      { wall: "back", at: [(openingRight + right) / 2, midY, back], turn: 0, size: [right - openingRight, height] },
      { wall: "left", at: [left, midY, ROOM_CENTRE_Z], turn: Math.PI / 2, size: [ROOM_DEPTH, height] },
      { wall: "right", at: [right, midY, ROOM_CENTRE_Z], turn: -Math.PI / 2, size: [ROOM_DEPTH, height] },
      // Front wall: the left wall's sky continued behind the visitor, opened for the door.
      { wall: "front", at: [(left + doorFrom) / 2, midY, front], turn: Math.PI, size: [doorFrom - left, height] },
      { wall: "front", at: [(doorTo + right) / 2, midY, front], turn: Math.PI, size: [right - doorTo, height] },
      { wall: "front", at: [DOOR.centre, (doorTop + y1) / 2, front], turn: Math.PI, size: [DOOR.width, y1 - doorTop] },
    ].map((plane) => {
      const geometry = metrePlane(plane.size[0], plane.size[1]);
      return { ...plane, geometry: plane.wall ? withMuralUVs(geometry, plane.wall as MuralWall, plane.at as Vector) : geometry };
    });
  }, [openingLeft, openingRight, doorFrom, doorTo]);
  const floorGeometry = useMemo(() => metrePlane(ROOM_WIDTH, ROOM_DEPTH), []);
  const ceilingGeometry = useMemo(() => {
    const geometry = metrePlane(ROOM_WIDTH, ROOM_DEPTH);
    // Sky coordinates: one image across the whole ceiling, top row first (see skyTextures).
    const uv1 = new PlaneGeometry(1, 1).getAttribute("uv").clone();
    for (let i = 0; i < uv1.count; i++) uv1.setY(i, 1 - uv1.getY(i));
    geometry.setAttribute("uv1", uv1);
    return geometry;
  }, []);
  useEffect(() => () => {
    planes.forEach(({ geometry }) => geometry.dispose());
    [floorGeometry, ceilingGeometry].forEach((geometry) => geometry.dispose());
  }, [planes, floorGeometry, ceilingGeometry]);

  return (
    <group name="room-shell">
      <mesh geometry={floorGeometry} material={floor} rotation={[-Math.PI / 2, 0, 0]} position={[ROOM_CENTRE_X, ROOM.floor, ROOM_CENTRE_Z]} receiveShadow raycast={noRaycast} />
      {planes.map(({ at, turn, geometry, wall: muralWall }, i) => (
        <mesh key={i} geometry={geometry} material={murals[muralWall as MuralWall]} position={at as Vector} rotation={[0, turn, 0]} receiveShadow raycast={noRaycast} />
      ))}
      <Piece name="architecture" parts={architecture} scale={METRE} />
      <mesh name="door leaf" geometry={doorGeometry} material={doorPaint} castShadow receiveShadow raycast={noRaycast} />
      <mesh geometry={ceilingGeometry} material={ceiling} position={[ROOM_CENTRE_X, ROOM.ceiling, ROOM_CENTRE_Z]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast} />
    </group>
  );
}
