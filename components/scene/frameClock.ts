/** Whether the scene was drawn in the current frame. HeroFrame sets it; the
 * quality governor times only drawn frames, so frames skipped by a frame-rate
 * cap never count as fast ones. */
export const frameClock = { rendered: false };
