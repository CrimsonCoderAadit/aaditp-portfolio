import { useMemo } from "react";
import { ContactShadows, Environment, Lightformer, SoftShadows } from "@react-three/drei";
import { Object3D } from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { CITY_GROUP_POSITION, TABLETOP_Y } from "./districtLayout";
import { GLASS_WALL, ROOM, ROOM_CENTRE_X, ROOM_CENTRE_Z } from "./roomLayout";
import { GLAZING_Z } from "./roomAssets/architecture";
import { TIER_SETTINGS, useTier } from "./quality";

// Area lights read their LTC lookup tables from here; without it they add nothing.
RectAreaLightUniformsLib.init();

const [CITY_X, , CITY_Z] = CITY_GROUP_POSITION;

/** Lighting hierarchy, strongest first:
 *  1. Key: one shadowed overhead source whose 4096² map spans the whole room, so
 *     the city and every piece of furniture share physically consistent shadows.
 *  2. Table emphasis: an unshadowed spot pooling on the model, falling off
 *     before the walls, so the city stays the brightest thing in frame.
 *  3. City: a faint cool area light across the glass wall, the night outside
 *     reaching in, plus a matching env card for reflections.
 *  4. Practicals: warm lamps (see RoomDecor, RoomDetails), short range.
 *  5. Bounce: light returned from the room's right side onto the left wall is
 *     shaded into the shell materials themselves (RoomShell), not added as a
 *     scene light that every other surface would pay for.
 * Fill comes from a low hemisphere and a studio environment used only for
 * reflections on metal, glass and plastic. */
export default function Lighting() {
  const settings = TIER_SETTINGS[useTier()];
  const tableTarget = useMemo(() => new Object3D(), []);
  const roomTarget = useMemo(() => new Object3D(), []);
  const glassMid = (ROOM.floor + ROOM.ceiling) / 2, glassHeight = ROOM.ceiling - ROOM.floor;
  return (
    <>
      {settings.softShadowSamples > 0 && <SoftShadows size={22} samples={settings.softShadowSamples} focus={0} />}
      <hemisphereLight args={["#d9dfe3", "#2a241e", .2]} />
      {/* The hero camera looks from +X/+Z; this key rakes across its view by ~36°. */}
      <primitive object={roomTarget} position={[ROOM_CENTRE_X, 0, ROOM_CENTRE_Z]} />
      <directionalLight position={[ROOM_CENTRE_X, 10, ROOM_CENTRE_Z + 7]} target={roomTarget} intensity={1.55} color="#fff0e0" castShadow
        shadow-mapSize={[settings.shadowMap, settings.shadowMap]} shadow-camera-left={-10.2} shadow-camera-right={10.2} shadow-camera-top={8.2} shadow-camera-bottom={-8.2}
        shadow-camera-near={2} shadow-camera-far={26} shadow-normalBias={.012} shadow-bias={-.00008} />
      <primitive object={tableTarget} position={[CITY_X, TABLETOP_Y, CITY_Z]} />
      <spotLight position={[CITY_X - .6, 8.6, CITY_Z + 2.2]} target={tableTarget} angle={.8} penumbra={1} decay={0} intensity={1.15} color="#fff6ea" />
      <rectAreaLight visible={settings.decorativeLights} position={[GLASS_WALL.centre, glassMid, ROOM.back + .02]} rotation={[0, Math.PI, 0]} width={GLASS_WALL.width * .9} height={glassHeight * .85} intensity={.32} color="#9fb2cf" />
      <Environment resolution={256} frames={1} environmentIntensity={.5}>
        <Lightformer form="rect" intensity={3} color="#fff2df" position={[-3, 6, 2]} rotation={[Math.PI / 2, 0, 0]} scale={[7, 5, 1]} />
        <Lightformer form="rect" intensity={.9} color="#aebfd8" position={[GLASS_WALL.centre, glassMid, GLAZING_Z - .5]} scale={[GLASS_WALL.width, glassHeight, 1]} />
        <Lightformer form="rect" intensity={1} position={[5, 2, 1]} rotation={[0, -Math.PI / 2, 0]} scale={[3, 4, 1]} />
        <Lightformer form="rect" intensity={1.3} color="#e3e9ee" position={[0, 3, 6]} rotation={[0, Math.PI, 0]} scale={[6, 3, 1]} />
        <Lightformer form="ring" intensity={1.2} color="#ffd9a8" position={[4.5, 1.8, 3]} scale={.6} />
      </Environment>
      <ContactShadows position={[CITY_X, .037, CITY_Z]} opacity={.3} scale={15} blur={1.6} far={2.5} resolution={1024} frames={1} color="#08090a" />
    </>
  );
}
