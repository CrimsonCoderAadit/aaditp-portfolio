import { Euler, Vector3 } from "three";
import type { BrickPart } from "../BrickInstances";

/** A physical reveal inside an existing opening. Front is local +Z.
 * Outer envelope is unchanged; glazing is inset behind jambs, head and sill.
 * Return parts to the caller's existing batch/animation owner, not a new group.
 */
export function builtWindow(position: BrickPart["position"], size: BrickPart["size"], rotation: BrickPart["rotation"] = [0, 0, 0], mullion = false) {
  const [w, h, d] = size;
  const rail = Math.min(.022, h * .18, w * .12);
  const paneDepth = Math.min(.018, d * .30);
  const euler = new Euler(...rotation);
  const part = (offset: BrickPart["position"], size: BrickPart["size"]): BrickPart => {
    const p = new Vector3(...offset).applyEuler(euler).add(new Vector3(...position));
    return { position: [p.x, p.y, p.z], size, rotation };
  };
  const frame = [
    part([0, -(h - rail) / 2, 0], [w, rail, d]),
    part([0, (h - rail) / 2, -d * .06], [w, rail, d * .88]),
    ...[-1, 1].map((side) => part([side * (w - rail) / 2, 0, -d * .06], [rail, h - 2 * rail, d * .88])),
  ];
  if (mullion) frame.push(part([0, 0, -d * .04], [rail * .65, h - 2 * rail, d * .72]));
  // A small rear seating lip keeps the pane off its wall/backing contact plane.
  const glass = part([0, 0, -(d - paneDepth) / 2 + d * .10], [w - 2 * rail, h - 2 * rail, paneDepth]);
  return { frame, glass };
}
