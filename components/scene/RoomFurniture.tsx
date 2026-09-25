import { ContactShadows } from "@react-three/drei";
import { Piece, useAssembled } from "./roomAssets/RoomSurfaces";
import { buildBed, buildBedsideTable, buildBookshelf, buildChair, buildWorkstation } from "./roomAssets/furniture";
import { BED_AT, BEDSIDE_AT, CHAIR_AT, DESK_AT, METRE, ROOM, SHELF_AT, WARDROBE_AT } from "./roomLayout";
import RoomWardrobe from "./RoomWardrobe";

/** Approved furniture at approved anchors. Each piece is authored geometry merged
 * to one mesh per finish (see roomAssets/furniture.ts), in metres under the
 * group's METRE scale. */
export default function RoomFurniture() {
  const bed = useAssembled(buildBed);
  const bedside = useAssembled(buildBedsideTable);
  const workstation = useAssembled(buildWorkstation);
  const chair = useAssembled(buildChair);
  const bookshelf = useAssembled(buildBookshelf);
  return (
    <group name="room-furniture" position={[0, ROOM.floor, 0]}>
      <Piece name="bed" parts={bed} at={BED_AT.at} turn={BED_AT.turn} scale={METRE} />
      <Piece name="bedside table" parts={bedside} at={BEDSIDE_AT.at} turn={BEDSIDE_AT.turn} scale={METRE} />
      <RoomWardrobe />
      <Piece name="workstation" parts={workstation} at={DESK_AT.at} turn={DESK_AT.turn} scale={METRE} />
      <Piece name="desk chair" parts={chair} at={CHAIR_AT.at} turn={CHAIR_AT.turn} scale={METRE} />
      <Piece name="bookshelf" parts={bookshelf} at={SHELF_AT.at} turn={SHELF_AT.turn} scale={METRE} />
      {/* Baked ambient contact under each cluster; the room key supplies the cast shadows. */}
      {/* Scalar dimensions keep Drei's render-target memo stable. Fresh scale
          arrays recreated six GPU textures on every navigation render. */}
      <ContactShadows position={[ROOM.left + 1.3, .004, -.65]} scale={1} width={3.4} height={5.0} far={.9} blur={2.2} opacity={.22} resolution={512} frames={1} color="#0a0b0c" />
      <ContactShadows position={[WARDROBE_AT.at[0], .004, WARDROBE_AT.at[2]]} scale={1} width={1.9} height={2.9} far={.9} blur={2.2} opacity={.22} resolution={256} frames={1} color="#0a0b0c" />
      <ContactShadows position={[ROOM.right - 1.3, .004, 2.2]} scale={1} width={3.4} height={6.6} far={.9} blur={2.2} opacity={.22} resolution={512} frames={1} color="#0a0b0c" />
    </group>
  );
}
