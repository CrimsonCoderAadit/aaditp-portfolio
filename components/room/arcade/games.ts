import type { GameDefinition } from "./types";
import { paintByteClimber, paintNightCircuit, paintPacketDefender, paintSystemRunner, type CoverPainter } from "./covers";

/** One title in the library. Playable titles load their code only when
 * launched; SYSTEM RUNNER is listed but plays at the workstation. */
export type ArcadeTitle = {
  id: string;
  title: string;
  line: string;
  controls: string;
  cover: CoverPainter;
  load?: () => Promise<GameDefinition>;
  exclusive?: string;
};

export const ARCADE_LIBRARY: ArcadeTitle[] = [
  {
    id: "night-circuit", title: "NIGHT CIRCUIT", line: "Race a neon city after dark, chaining data beacons against the clock.",
    controls: "WASD or arrows · Space to drift", cover: paintNightCircuit,
    load: () => import("./games/nightCircuit").then((module) => module.NIGHT_CIRCUIT),
  },
  {
    id: "byte-climber", title: "BYTE CLIMBER", line: "Guide a maintenance bot up a failing server tower before corruption catches it.",
    controls: "Arrows or WASD · Space to jump", cover: paintByteClimber,
    load: () => import("./games/byteClimber").then((module) => module.BYTE_CLIMBER),
  },
  {
    id: "packet-defender", title: "PACKET DEFENDER", line: "Hold the network node against waves of corrupted packets.",
    controls: "Pointer to aim and fire · or ← → and Space", cover: paintPacketDefender,
    load: () => import("./games/packetDefender").then((module) => module.PACKET_DEFENDER),
  },
  {
    id: "system-runner", title: "SYSTEM RUNNER", line: "Route a signal through a failing system. Plays on the workstation's monitors.",
    controls: "At the desk", cover: paintSystemRunner, exclusive: "Workstation exclusive",
  },
];
