import { bakeRoomPixels } from "./surfaces";

self.onmessage = () => {
  try {
    const pixels = bakeRoomPixels();
    const transfer = Object.values(pixels).flatMap(({ albedo, detail }) => [albedo.buffer, detail.buffer]);
    self.postMessage({ pixels }, { transfer });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
