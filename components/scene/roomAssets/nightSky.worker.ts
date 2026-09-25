import { paintNightSky, type SkySpec } from "./nightSky";

/** Paints the ceiling sky off the main thread and hands back both images as
 * raw pixels, transferred rather than copied. (A bitmap of a worker's canvas
 * can live on the worker's GPU context and die with the worker.) */
self.onmessage = ({ data }: MessageEvent<SkySpec>) => {
  try {
    const sky = paintNightSky(data);
    const [color, glow] = [sky.color, sky.glow].map((canvas) => {
      const { width, height } = canvas as OffscreenCanvas;
      const pixels = (canvas as OffscreenCanvas).getContext("2d")!.getImageData(0, 0, width, height).data;
      return { data: new Uint8Array(pixels.buffer), width, height };
    });
    self.postMessage({ color, glow }, { transfer: [color.data.buffer, glow.data.buffer] });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
