import { CITY_GROUP_POSITION, HERO_FOV, HERO_OFFSET, HERO_TARGET_LIFT } from "./districtLayout";

/** Curated room viewpoints. Every camera destination outside the district focus
 * transitions is defined here; the camera rig, the viewpoint navigator and any
 * future guided sequence read the same table through `goToViewpoint(id)`.
 * Every position lies inside the closed room. */

export type ViewpointId = "city" | "workstation" | "display" | "personal" | "corner" | "room" | RoomFocus;
/** Close views of room objects, reached by interacting with them rather than
 * from the viewpoint navigator. */
export type RoomFocus = "media" | "chess" | "kong" | "chase" | "sabers";
export const isRoomFocus = (id: ViewpointId): id is RoomFocus => id === "media" || id === "chess" || id === "kong" || id === "chase" || id === "sabers";

type Vec3 = [number, number, number];

/** Exploration range around a viewpoint: orbit yaw either side, pitch up and
 * down (radians), and dolly as a fraction of the viewpoint's own distance. */
export type ExploreBounds = { yaw: number; pitchUp: number; pitchDown: number; dollyIn: number; dollyOut: number };

export type Viewpoint = {
  id: ViewpointId;
  label: string;
  position: Vec3;
  target: Vec3;
  fov: number;
  bounds: ExploreBounds;
};

const [CITY_X, , CITY_Z] = CITY_GROUP_POSITION;
const CITY_TARGET: Vec3 = [CITY_X, HERO_TARGET_LIFT, CITY_Z + .55];

export const VIEWPOINTS: Record<ViewpointId, Viewpoint> = {
  // The landing composition: from high in the front zone, the model city fills
  // the frame with the mural behind it and the room at the edges.
  city: {
    id: "city", label: "City", fov: HERO_FOV, target: CITY_TARGET,
    position: [CITY_TARGET[0] + HERO_OFFSET[0], CITY_TARGET[1] + HERO_OFFSET[1], CITY_TARGET[2] + HERO_OFFSET[2]],
    bounds: { yaw: .5, pitchUp: .12, pitchDown: .1, dollyIn: .3, dollyOut: .05 },
  },
  // Behind the chair: panels, keyboard, lamp and tower, with the city's
  // Skills edge in the left of frame.
  workstation: {
    id: "workstation", label: "Workstation", fov: 46, target: [8.8, 1.8, .9],
    position: [5.3, 3.4, 5.2],
    bounds: { yaw: .3, pitchUp: .1, pitchDown: .1, dollyIn: .2, dollyOut: .06 },
  },
  // Along the figure's own facing, far enough back for the full statue and
  // plinth; the sightline clears the table's corner and the wardrobe's face.
  display: {
    id: "display", label: "Display", fov: 44, target: [-7.6, 1.9, 1.6],
    position: [-5.0, 3.0, 6.9],
    bounds: { yaw: .3, pitchUp: .08, pitchDown: .08, dollyIn: .2, dollyOut: .06 },
  },
  // The sleeping corner from over the table's front-left: bed, bedside lamp,
  // shelf and the framed blueprint, with About and Research below.
  personal: {
    id: "personal", label: "Personal", fov: 46, target: [-7.3, 1.5, -.9],
    position: [-2.6, 4.35, 6.2],
    bounds: { yaw: .3, pitchUp: .1, pitchDown: .08, dollyIn: .15, dollyOut: .06 },
  },
  // The games corner square on: the chess study, the television and the gaming
  // wall, over the saber table. Every screen reaches them from here.
  corner: {
    id: "corner", label: "Corner", fov: 52, target: [-9.4, 2.45, 8.0],
    position: [-4.6, 3.15, 8.0],
    bounds: { yaw: .2, pitchUp: .06, pitchDown: .08, dollyIn: .12, dollyOut: .04 },
  },
  // A raised read of the whole room from the front-right corner, under the ceiling.
  room: {
    id: "room", label: "Room", fov: 60, target: [-3.0, -2.2, .2],
    position: [9.1, 4.9, 10.1],
    bounds: { yaw: .22, pitchUp: .06, pitchDown: .12, dollyIn: .15, dollyOut: 0 },
  },
  // The media corner on the left wall, square to the television.
  media: {
    id: "media", label: "Media", fov: 46, target: [-9.4, 1.85, 7.47],
    position: [-6.1, 2.45, 7.62],
    bounds: { yaw: .12, pitchUp: .05, pitchDown: .05, dollyIn: .08, dollyOut: 0 },
  },
  // Square to the gaming wall: the ape, the detective and the marquee.
  kong: {
    id: "kong", label: "Wall", fov: 50, target: [-9.6, 2.75, 9.05],
    position: [-4.4, 2.9, 8.85],
    bounds: { yaw: .08, pitchUp: .04, pitchDown: .04, dollyIn: .05, dollyOut: 0 },
  },
  // Just off the table's left edge, into the detective's face on the Projects
  // campus service road, his car and the knocked cone beside him.
  chase: {
    id: "chase", label: "Detective", fov: 22, target: [-5.2, 1.72, .86],
    position: [-6.55, 2.5, 1.1],
    bounds: { yaw: .06, pitchUp: .03, pitchDown: .03, dollyIn: .04, dollyOut: 0 },
  },
  // The saber collection from in front of its table: all five hilts, their
  // plates and the staff behind, with the games corner beyond.
  sabers: {
    id: "sabers", label: "Sabers", fov: 34, target: [-5.2, 1.82, 8.55],
    position: [-3.05, 2.55, 8.55],
    bounds: { yaw: .06, pitchUp: .03, pitchDown: .03, dollyIn: .06, dollyOut: 0 },
  },
  // Close on the chess study above it.
  chess: {
    id: "chess", label: "Chess", fov: 40, target: [-9.6, 3.2, 7.47],
    position: [-6.9, 3.55, 7.5],
    bounds: { yaw: .1, pitchUp: .05, pitchDown: .05, dollyIn: .06, dollyOut: 0 },
  },
};

export const VIEWPOINT_ORDER: ViewpointId[] = ["city", "workstation", "display", "personal", "corner", "room"];
