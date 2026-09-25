import { Vector3 } from "three";
import { BEANBAG_AT, CABINET_AT, CART_AT, CHAIR_AT, DESK_AT, FLOOR_LAMP_AT, ROOM, MEDIA_AT, PLANT_AT, SABER_TABLE_AT, SHELF_AT, VADER_AT, WARDROBE_AT } from "./roomLayout";
import { CITY_GROUP_POSITION, TABLETOP_Y } from "./districtLayout";
import { BOULEVARD, TABLE_HALF } from "./cityMasterplan";

/** Simple camera safety, no physics: the room is a closed box and every camera
 * lives inside it, clear of the walls, floor and ceiling, and outside the
 * volumes of the table, its city and the furniture. */

export type Box = { min: [number, number, number]; max: [number, number, number] };

const MARGIN = .35;
const [CX, , CZ] = CITY_GROUP_POSITION;
const around = ([x, , z]: [number, number, number], halfX: number, halfZ: number, top: number): Box => ({ min: [x - halfX, 0, z - halfZ], max: [x + halfX, top, z + halfZ] });

/** The maker cart's volume, which follows the cart when it is dragged. */
export const CART_BOX: Box = around(CART_AT.at, .6, .6, 1.5);

/** Keep-out volumes in scene units, generous rather than exact. */
const KEEP_OUT: Box[] = [
  CART_BOX,
  // Model table and the low city across its whole top.
  { min: [CX - TABLE_HALF.x, 0, CZ - TABLE_HALF.z], max: [CX + TABLE_HALF.x, TABLETOP_Y + 1.25, CZ + TABLE_HALF.z] },
  // The tall back row north of the boulevard, crowned by Contact's spire.
  { min: [CX - TABLE_HALF.x, 0, CZ - TABLE_HALF.z], max: [CX + TABLE_HALF.x, 4.4, CZ + BOULEVARD.centre] },
  // Bed and bedside table.
  { min: [ROOM.left, 0, ROOM.back], max: [ROOM.left + 2.9, 1.9, 1.35] },
  around(WARDROBE_AT.at, .55, 1.1, 3.8),
  around(VADER_AT.at, .7, .7, 3.9),
  around(DESK_AT.at, .75, 1.45, 2.6),
  around(CHAIR_AT.at, .6, .6, 2.3),
  around(SHELF_AT.at, .35, .75, 3.4),
  around(CABINET_AT.at, 1.0, .45, 3.0),
  { min: [MEDIA_AT.at[0], 0, MEDIA_AT.at[2] - .8], max: [MEDIA_AT.at[0] + .8, 2.5, MEDIA_AT.at[2] + .8] },
  around(BEANBAG_AT.at, .75, .75, 1.1),
  around(SABER_TABLE_AT.at, .4, 1.15, 2.3),
];

/** What stands on the floor, for things dragged across it: every keep-out
 * volume but the cart's own, plus the plant and the floor lamp. */
export const FLOOR_OBSTACLES: Box[] = [
  ...KEEP_OUT.filter((box) => box !== CART_BOX),
  around(PLANT_AT.at, .45, .45, 2), around(FLOOR_LAMP_AT.at, .35, .35, 2.6),
];

/** The room's interior, less a margin so the near plane never meets a wall. */
const BOUNDS = {
  minX: ROOM.left + .4, maxX: ROOM.right - .4,
  minZ: ROOM.back + .5, maxZ: ROOM.front - .3,
  minY: ROOM.floor + .9, maxY: ROOM.ceiling - .28,
};

/** Keeps a position inside the room's walls, floor and ceiling. */
export function clampToRoom(position: Vector3) {
  position.x = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, position.x));
  position.y = Math.min(BOUNDS.maxY, Math.max(BOUNDS.minY, position.y));
  position.z = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, position.z));
  return position;
}

/** Pushes a proposed camera position inside the room and out of the keep-out
 * volumes, leaving each volume by its shallowest face. */
export function clampCamera(position: Vector3) {
  clampToRoom(position);
  for (const box of KEEP_OUT) {
    const lo = box.min.map((v) => v - MARGIN), hi = box.max.map((v) => v + MARGIN);
    const p = [position.x, position.y, position.z];
    if (p.some((v, i) => v <= lo[i] || v >= hi[i])) continue;
    // The floor face is never an exit, nor is any face that would leave the room.
    const limits = [[BOUNDS.minX, BOUNDS.maxX], [BOUNDS.minY, BOUNDS.maxY], [BOUNDS.minZ, BOUNDS.maxZ]];
    let axis = -1, target = 0, depth = Infinity;
    for (let i = 0; i < 3; i++) {
      for (const [bound, d] of [[lo[i], p[i] - lo[i]], [hi[i], hi[i] - p[i]]] as const) {
        if (i === 1 && bound === lo[1]) continue;
        if (bound < limits[i][0] || bound > limits[i][1]) continue;
        if (d < depth) { depth = d; axis = i; target = bound; }
      }
    }
    if (axis >= 0) position.setComponent(axis, target);
  }
  return position;
}
