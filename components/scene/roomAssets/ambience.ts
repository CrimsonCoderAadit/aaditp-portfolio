import { DESK_AT, METRE, ROOM } from "../roomLayout";

/** The room's violet accent layer. None of it is a scene light: the shell
 * shader (RoomShell) shades the reflected light of the concealed ceiling cove
 * and of the workstation's bias and under-desk strips straight into the wall,
 * ceiling and floor paint, and the emitters themselves are small `led` parts.
 *
 * Strengths are shared uniforms. The cove is fixed; the desk glow responds to
 * the terminal (a touch brighter on hover, dimmed while the game has focus). */
export const COVE_STRENGTH = { value: 1 };
export const DESK_GLOW = { value: 1 };

/** Deep blue-violet, linear RGB. */
export const VIOLET = [.36, .25, 1] as const;

/** Height below the ceiling of the cove lip the strip hides behind, in scene units. */
export const COVE_LIP = .07 * METRE;

/** Where the bias light lands on the right wall: centred behind the two
 * monitors, and the under-desk strip's pool lower down, in world units. */
const deskAlong = DESK_AT.at[2];
export const DESK_WASH = {
  along: deskAlong,
  bias: { y: ROOM.floor + 1.2 * METRE, spread: [.62 * METRE, .26 * METRE] },
  under: { y: ROOM.floor + .42 * METRE, spread: [.55 * METRE, .2 * METRE] },
  floor: { x: DESK_AT.at[0] + .12 * METRE, spread: [.24 * METRE, .5 * METRE] },
} as const;
