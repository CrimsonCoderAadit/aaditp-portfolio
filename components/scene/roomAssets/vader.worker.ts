import { buildVaderParts } from "./vader";

/** Builds the display figure's geometry off the main thread and hands back
 * each finish's attribute arrays, transferred rather than copied. */
self.onmessage = ({ data }: MessageEvent<{ detail: number }>) => {
  try {
    const parts = [...buildVaderParts(data.detail)].map(([finish, geometry]) => ({
      finish,
      attributes: Object.entries(geometry.attributes).map(([name, attribute]) => ({ name, array: attribute.array, itemSize: attribute.itemSize, normalized: attribute.normalized })),
      index: geometry.index?.array ?? null,
    }));
    const transfer = parts.flatMap(({ attributes, index }) => [...attributes.map(({ array }) => array.buffer), ...(index ? [index.buffer] : [])]);
    self.postMessage({ parts }, { transfer: transfer as ArrayBuffer[] });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
