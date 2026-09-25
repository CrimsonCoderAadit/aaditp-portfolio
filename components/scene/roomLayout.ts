/** Interior shell bounds in scene units. The bench sets the scale: 1.75 units ≈ 1 m.
 *
 * The model table is 7.4 × 4.55 m (12.21 × 7.51 units), so the shell clears a
 * walk-around perimeter for it plus a sleeping wall on the left and a working
 * wall on the right. The room is closed on all six sides and every camera stays
 * inside it; the front zone is deep enough for the hero camera to frame the
 * table from within. Interior is 19.3 × 13.2 × 5.215 units (11.0 × 7.5 × 2.98 m). */
export const METRE = 1.75;

export const ROOM = {
  left: -9.65,
  right: 9.65,
  back: -2.7,
  front: 10.5,
  floor: .035,
  ceiling: 5.25,
} as const;

/** The back wall's floor-to-ceiling glass: four panes between slim mullions,
 * the second of them a sliding door, onto a recessed balcony. */
export const GLASS_WALL = { centre: 0, width: 10.4, panes: 4 } as const;
/** The balcony beyond it, which the camera never enters: depth from the
 * glass line to the balustrade, the wall's thickness, and the step down. */
export const BALCONY = { depth: 2.8, wall: .27, step: .06 } as const;

export const ROOM_CENTRE_X = (ROOM.left + ROOM.right) / 2;
export const ROOM_CENTRE_Z = (ROOM.back + ROOM.front) / 2;
export const ROOM_WIDTH = ROOM.right - ROOM.left;
export const ROOM_DEPTH = ROOM.front - ROOM.back;

/** Shared placement for the furniture. Decoration reads the same anchors
 * so shelf contents, desk props and lamps can be authored in furniture-local
 * metres and can never drift from the piece they sit on. */
export type Anchor = { at: [number, number, number]; turn: number };

export const BED_AT: Anchor = { at: [ROOM.left + (.08 + .675) * METRE, 0, ROOM.back + (.09 + 1.09) * METRE], turn: 0 };
export const BEDSIDE_AT: Anchor = { at: [ROOM.left + (.08 + 1.35 + .06 + .21) * METRE, 0, ROOM.back + (.08 + .20) * METRE], turn: 0 };
export const WARDROBE_AT: Anchor = { at: [ROOM.left + (.03 + .30) * METRE, 0, 5.6], turn: Math.PI / 2 };

/** The workstation faces the right wall beside the table's back half, with
 * the chair between it and the table and a clear aisle behind the chair; the
 * bookshelf stands further along the same wall, toward the front. */
export const DESK_AT: Anchor = { at: [ROOM.right - (.05 + .35) * METRE, 0, .95], turn: -Math.PI / 2 };
export const CHAIR_AT: Anchor = { at: [DESK_AT.at[0] - 1.0, 0, 1.25], turn: Math.PI / 2 };
export const SHELF_AT: Anchor = { at: [ROOM.right - (.03 + .15) * METRE, 0, 4.6], turn: -Math.PI / 2 };
export const PLANT_AT: Anchor = { at: [ROOM.right - .5, 0, 3.15], turn: .4 };

/** Door in the front wall, toward its left end, behind the hero camera:
 * opening centre and width along X, and head height, in scene units. */
export const DOOR = { centre: -8.55, width: .68 * METRE, head: 2.04 * METRE } as const;
/** The light switch beside the door's latch side, which dims the cove. */
export const COVE_SWITCH: [number, number, number] = [DOOR.centre + DOOR.width / 2 + .2 * METRE, ROOM.floor + 1.05 * METRE, ROOM.front - .02];

/** Life-size brick display figure in the left-wall bay between the bed foot and
 * the wardrobe: plinth square to the walls, figure turned toward the room. */
export const VADER_AT: Anchor = { at: [ROOM.left + (.03 + .36) * METRE, 0, 2.3], turn: .95 };

/** Secondary pieces, clear of circulation: the maker cart beside the table's
 * front-right corner, a low cabinet with a pegboard and floor lamp in the
 * back-right corner beyond the table's end and a floating shelf above the bed. */
export const CART_AT: Anchor = { at: [6.95, 0, 6.75], turn: -.45 };
export const CABINET_AT: Anchor = { at: [7.75, 0, ROOM.back + (.2 + .02) * METRE], turn: 0 };
export const FLOOR_LAMP_AT: Anchor = { at: [ROOM.right - .5, 0, -2.25], turn: 0 };
export const PEGBOARD_AT: Anchor = { at: [7.75, 0, ROOM.back], turn: 0 };
export const WALL_SHELF_AT: Anchor = { at: [ROOM.left, 0, .22], turn: Math.PI / 2 };

/** The media corner on the left wall between the wardrobe and the door: a
 * low console and wall-hung television, the chess study and its ledge above,
 * and a bean bag on the floor facing them. MEDIA_AT is the wall plane. */
export const MEDIA_AT: Anchor = { at: [ROOM.left, 0, 7.47], turn: Math.PI / 2 };
export const BEANBAG_AT: Anchor = { at: [-7.45, 0, 7.6], turn: -Math.PI / 2 };
/** The saber display table in the walk between the media corner and the rug,
 * its long side along the room and its front to the room's right. */
export const SABER_TABLE_AT: Anchor = { at: [-5.2, 0, 8.55], turn: Math.PI / 2 };

/** Framed pieces hung over the murals: wall, centre along the wall, centre
 * height and outer size, in scene units. Hung in groups on the bare stretches
 * of wall, clear of the furniture and of the identity text's side of the room. */
export type FrameSpec = {
  wall: "back" | "left" | "right"; along: number; y: number; size: [number, number];
  art: "blueprint" | "chess" | "pixel" | "orbits" | "pitch" | "flute" | "manuscript" | "network" | "knight" | "brickSketch" | "stave" | "waves";
  /** Moulding: satin black (default), oak, white lacquer or thin brushed metal. */
  frame?: "black" | "oak" | "white" | "metal";
  /** A mat between frame and print; on by default. */
  mat?: boolean;
};
export const FRAMES: FrameSpec[] = [
  { wall: "back", along: -6.6, y: 3.55, size: [1.55, 1.05], art: "blueprint" },
  { wall: "right", along: 6.75, y: 2.95, size: [.95, 1.25], art: "orbits", frame: "oak" },
  { wall: "right", along: .95, y: 3.85, size: [.8, .8], art: "pixel" },
  // The chess study hangs above the media corner's television.
  { wall: "left", along: 7.47, y: 3.35, size: [1.0, 1.3], art: "chess", frame: "oak" },
  // The left wall's gallery by the bed, round the brick figure and clear of its
  // outline, one piece for each of Aadit's constants: football in goal, the
  // flute, fiction, chess and the graph models of his research.
  { wall: "left", along: 3.75, y: 3.95, size: [1.25, .8], art: "pitch" },
  { wall: "left", along: 3.62, y: 2.8, size: [.95, .5], art: "flute", frame: "oak", mat: false },
  { wall: "left", along: 1.1, y: 3.95, size: [.7, .95], art: "manuscript", frame: "white" },
  { wall: "left", along: 1.3, y: 2.72, size: [.52, .52], art: "network", frame: "metal", mat: false },
  { wall: "left", along: 2.3, y: 4.58, size: [.56, .44], art: "knight", frame: "black", mat: false },
  // A pencil study in the corner above the bed, and two on the working wall.
  { wall: "back", along: -8.75, y: 3.65, size: [.6, .78], art: "brickSketch", frame: "white" },
  { wall: "right", along: -1.3, y: 3.5, size: [.82, .56], art: "stave", frame: "oak" },
  { wall: "right", along: 2.45, y: 3.6, size: [.6, .8], art: "waves", frame: "metal", mat: false },
];

/** The gaming wall on the left wall's front stretch, between the media corner
 * and the front corner, in scene units: the ape's pixel mural low in the corner
 * (`pixel` is one mural cell), the detective's poster higher, beside the chess
 * study, and the score marquee above the ape. */
export const GAMING_WALL = {
  kong: { along: 9.47, bottom: .42, pixel: .031 },
  chase: { along: 8.62, y: 4.0, size: [.92, 1.84] as [number, number] },
  marquee: { along: 9.92, y: 3.36, size: [.84, .233] as [number, number] },
} as const;
