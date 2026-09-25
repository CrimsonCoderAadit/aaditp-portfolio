import type { Sfx } from "./sfx";

/** Everything a game reads from the player each frame. `actionHit` and
 * `pointer.hit` are true for the one frame after a press. */
export type Input = {
  left: boolean; right: boolean; up: boolean; down: boolean;
  action: boolean; actionHit: boolean;
  /** Pointer position in canvas CSS pixels, when the pointer is over the game. */
  pointer: { x: number; y: number; active: boolean; down: boolean; hit: boolean };
};

/** A running game. The frame owns the loop, input, canvas and menus; the
 * engine owns its world. */
export type Engine = {
  update: (dt: number, input: Input) => void;
  render: (context: CanvasRenderingContext2D, width: number, height: number) => void;
  readonly score: number;
  readonly over: boolean;
  /** Status readouts beside the score, label and value. */
  hud: () => [string, string][];
};

/** On-screen controls for touch: steering and pedals, move/climb/jump, or aim
 * by tapping the playfield. */
export type TouchLayout = "drive" | "platform" | "aim";

export type GameDefinition = {
  id: string;
  title: string;
  /** Each line of the title screen's short instructions. */
  howTo: string[];
  touch: TouchLayout;
  /** localStorage key for the best score. */
  bestKey: string;
  create: (sfx: Sfx) => Engine;
};
