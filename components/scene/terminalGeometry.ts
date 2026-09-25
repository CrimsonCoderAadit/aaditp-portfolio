import { Group, MathUtils, Object3D, Vector3 } from "three";
import { DESK_AT, METRE, ROOM } from "./roomLayout";
import { MONITOR_GLASS, MONITORS } from "./roomAssets/furniture";

/** The workstation's terminal screen, as world-space geometry. The same
 * transform chain RoomDecor uses to place the panel content (desk anchor,
 * then monitor, then glass) is rebuilt here once, so the camera, the hit
 * target and the DOM overlay all agree on where the screen is. */
export const TERMINAL_MONITOR = 1;
/** The other panel runs the ambient systems dashboard. */
export const DASHBOARD_MONITOR = 0;

function glassOf(index: number) {
  const desk = new Group();
  desk.position.set(DESK_AT.at[0], ROOM.floor, DESK_AT.at[2]);
  desk.rotation.y = DESK_AT.turn;
  desk.scale.setScalar(METRE);
  const monitor = new Group();
  monitor.position.set(...MONITORS[index].at);
  monitor.rotation.y = MONITORS[index].turn;
  const glass = new Object3D();
  glass.position.set(...MONITOR_GLASS.at);
  desk.add(monitor); monitor.add(glass);
  desk.updateMatrixWorld(true);
  return glass;
}
const glass = glassOf(TERMINAL_MONITOR);

export const DASHBOARD_CENTRE = new Vector3().setFromMatrixPosition(glassOf(DASHBOARD_MONITOR).matrixWorld);

export const SCREEN = {
  centre: new Vector3().setFromMatrixPosition(glass.matrixWorld),
  normal: new Vector3(0, 0, 1).transformDirection(glass.matrixWorld),
  right: new Vector3(1, 0, 0).transformDirection(glass.matrixWorld),
  up: new Vector3(0, 1, 0).transformDirection(glass.matrixWorld),
  width: MONITOR_GLASS.size[0] * METRE,
  height: MONITOR_GLASS.size[1] * METRE,
};

/** World corners of the glass, for projecting the screen onto the page. */
export function screenCorners() {
  const { centre, right, up, width, height } = SCREEN;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => centre.clone().addScaledVector(right, sx * width / 2).addScaledVector(up, sy * height / 2));
}

/** The seated view of the terminal: in front of the screen and a little above
 * it, looking over the chair back, far enough off that the desk, lamp and wall
 * still frame the screen. The screen fills about 45% of the frame width. */
export const TERMINAL_FOV = 38;
export function terminalPose(aspect: number) {
  const halfWidth = Math.tan(MathUtils.degToRad(TERMINAL_FOV) / 2) * aspect;
  const distance = MathUtils.clamp(SCREEN.width / (.45 * 2 * halfWidth), 1.35, 2.6);
  const position = SCREEN.centre.clone().addScaledVector(SCREEN.normal, distance).add(new Vector3(0, .3, 0));
  const target = SCREEN.centre.clone().add(new Vector3(0, -.02, 0));
  return { position, target, fov: TERMINAL_FOV };
}
