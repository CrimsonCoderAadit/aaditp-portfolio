import { useMemo } from "react";
import { Piece, useAssembled } from "./roomAssets/RoomSurfaces";
import { RoomSwitch, useCoveDimmer, useSwitchedLamp } from "./RoomSwitches";
import {
  buildBedsideExtras, buildDeskExtras, buildFloatingShelf, buildFloorLamp, buildPegboard, buildStorageCabinet,
} from "./roomAssets/props";
import { BEDSIDE_AT, CABINET_AT, COVE_SWITCH, DESK_AT, FLOOR_LAMP_AT, METRE, PEGBOARD_AT, ROOM, WALL_SHELF_AT, type Anchor } from "./roomLayout";

const onFloor = ({ at }: Anchor): [number, number, number] => [at[0], ROOM.floor, at[2]];

/** Secondary furniture and wall-mounted storage that make the room lived-in without
 * competing with the table. Scenery never takes a pointer hit; the floor lamp
 * and the cove's wall switch have their own switch targets. */
export default function RoomDetails() {
  const cabinet = useAssembled(buildStorageCabinet);
  const lamp = useMemo(() => buildFloorLamp(), []);
  const lampParts = useAssembled(() => lamp.geometry);
  const pegboard = useAssembled(() => buildPegboard(1.36));
  const wallShelf = useAssembled(() => buildFloatingShelf(.72, 1.42));
  const desk = useAssembled(buildDeskExtras);
  const bedside = useAssembled(buildBedsideExtras);
  const [lx, ly, lz] = lamp.bulb;
  const bulb: [number, number, number] = [FLOOR_LAMP_AT.at[0] + lx * METRE, ROOM.floor + ly * METRE, FLOOR_LAMP_AT.at[2] + lz * METRE];
  const [floorShade, floorLightRef] = useSwitchedLamp("floorLamp", 2.2);
  useCoveDimmer();
  return (
    <group name="room-details">
      <Piece name="storage cabinet" parts={cabinet} at={onFloor(CABINET_AT)} turn={CABINET_AT.turn} scale={METRE} />
      <Piece name="floor lamp" parts={lampParts} at={onFloor(FLOOR_LAMP_AT)} scale={METRE} overrides={floorShade} />
      <Piece name="pegboard" parts={pegboard} at={onFloor(PEGBOARD_AT)} turn={PEGBOARD_AT.turn} scale={METRE} />
      <Piece name="wall shelf" parts={wallShelf} at={onFloor(WALL_SHELF_AT)} turn={WALL_SHELF_AT.turn} scale={METRE} />
      <Piece name="desk extras" parts={desk} at={onFloor(DESK_AT)} turn={DESK_AT.turn} scale={METRE} />
      <Piece name="bedside extras" parts={bedside} at={onFloor(BEDSIDE_AT)} turn={BEDSIDE_AT.turn} scale={METRE} />
      {/* Third warm practical, lighting the maker corner; short range like the others. */}
      <pointLight ref={floorLightRef} position={bulb} intensity={2.2} distance={3.2} decay={2} color="#ffc684" />
      <RoomSwitch name="floor lamp switch" toggle="floorLamp" at={bulb} radius={.42} from={["workstation", "room"]} />
      <RoomSwitch name="cove dimmer" toggle="coveDimmed" at={COVE_SWITCH} radius={.3} halo={.5} from={["room"]} />
    </group>
  );
}
