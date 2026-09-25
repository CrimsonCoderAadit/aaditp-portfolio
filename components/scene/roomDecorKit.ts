import { BoxGeometry, CanvasTexture, CylinderGeometry, MeshStandardMaterial, SRGBColorSpace, SphereGeometry } from "three";

export type DecorFinish =
  | "paper" | "card" | "cloth" | "rug" | "brass" | "leather"
  | "bookA" | "bookB" | "bookC" | "bookD" | "bookE"
  | "boardLight" | "boardDark" | "ballShell" | "ballMark"
  | "shade" | "lampMetal" | "steel" | "slate"
  | "brickRed" | "brickBlue" | "brickSand";

type Draw = (context: CanvasRenderingContext2D, w: number, h: number) => void;

function printed(width: number, height: number, draw: Draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d")!;
  draw(context, width, height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

const artwork = {
  /** Eight by eight, two squares lifted out. */
  board: () => printed(256, 256, (c, w) => {
    const cell = w / 8;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      c.fillStyle = (i + j) % 2 ? "#3b352e" : "#c9c2ae";
      c.fillRect(i * cell, j * cell, cell, cell);
    }
  }),
};

/** One shared geometry set and one muted palette for everything decorative. */
export function createRoomDecorKit() {
  const box = new BoxGeometry(1, 1, 1);
  const rod = new CylinderGeometry(.5, .5, 1, 10);
  const cone = new CylinderGeometry(.34, .5, 1, 12, 1, true);
  const ball = new SphereGeometry(.5, 16, 12);
  const materials: Record<DecorFinish, MeshStandardMaterial> = {
    paper: new MeshStandardMaterial({ color: "#c8c2b2", roughness: .92 }),
    card: new MeshStandardMaterial({ color: "#8a8073", roughness: .84 }),
    cloth: new MeshStandardMaterial({ color: "#524d41", roughness: .97 }),
    rug: new MeshStandardMaterial({ color: "#2c2a24", roughness: .98 }),
    brass: new MeshStandardMaterial({ color: "#8d7440", roughness: .38, metalness: .55 }),
    leather: new MeshStandardMaterial({ color: "#4a4035", roughness: .72 }),
    bookA: new MeshStandardMaterial({ color: "#5b4a3e", roughness: .80 }),
    bookB: new MeshStandardMaterial({ color: "#3f4a52", roughness: .80 }),
    bookC: new MeshStandardMaterial({ color: "#6d6659", roughness: .80 }),
    bookD: new MeshStandardMaterial({ color: "#7a4f42", roughness: .80 }),
    bookE: new MeshStandardMaterial({ color: "#4c5148", roughness: .80 }),
    boardLight: new MeshStandardMaterial({ color: "#c4bda9", roughness: .55 }),
    boardDark: new MeshStandardMaterial({ color: "#3a342d", roughness: .55 }),
    ballShell: new MeshStandardMaterial({ color: "#c5c3bb", roughness: .58 }),
    ballMark: new MeshStandardMaterial({ color: "#33362f", roughness: .58 }),
    shade: new MeshStandardMaterial({ color: "#ddd0b2", roughness: .82, emissive: "#c99a52", emissiveIntensity: .55 }),
    lampMetal: new MeshStandardMaterial({ color: "#2d3033", roughness: .40, metalness: .60 }),
    steel: new MeshStandardMaterial({ color: "#9aa0a2", roughness: .38, metalness: .58 }),
    slate: new MeshStandardMaterial({ color: "#3a3f43", roughness: .62 }),
    // Loose stock for the parts tray, tinted to read as the same bricks the city uses.
    brickRed: new MeshStandardMaterial({ color: "#8f4d41", roughness: .42 }),
    brickBlue: new MeshStandardMaterial({ color: "#42647f", roughness: .42 }),
    brickSand: new MeshStandardMaterial({ color: "#ab8f4a", roughness: .42 }),
  };

  const prints = { board: artwork.board() };
  const printMaterials = {
    board: new MeshStandardMaterial({ map: prints.board, roughness: .50 }),
  };

  return {
    box, rod, cone, ball, materials, prints, printMaterials,
    dispose() {
      [box, rod, cone, ball].forEach((geometry) => geometry.dispose());
      Object.values(materials).forEach((finish) => finish.dispose());
      Object.values(printMaterials).forEach((finish) => finish.dispose());
      Object.values(prints).forEach((texture) => texture.dispose());
    },
  };
}

export type RoomDecorKit = ReturnType<typeof createRoomDecorKit>;
