import { FIELD, PLAY, PULSE_COOLDOWN, type Phase, type World } from "./engine";

/** Canvas 2D drawing for SYSTEM RUNNER, in the 960 × 600 logical field.
 * Graphite ground, a cool network, amber/red hazards; glow is a few shadow
 * passes, never a bloom pass. */

const INK = "#0a0d11";
const CYAN = "#7fd6e6";
const BLUE = "#9cc8ff";
const GREEN = "#8fe3c0";
const AMBER = "#e0a24c";
const RED = "#e2573f";
const MUTED = "#5d7079";
const MONO = '"SF Mono", Menlo, ui-monospace, monospace';

type Backdrop = { layers: { nodes: [number, number][]; links: [number, number][]; speed: number; alpha: number }[] };

/** The network behind play: two layers of nodes and links that wrap as they
 * scroll, for parallax. Generated once. */
export function createBackdrop(seed = 11): Backdrop {
  let a = seed;
  const random = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  const layer = (count: number, speed: number, alpha: number) => {
    const nodes: [number, number][] = Array.from({ length: count }, () => [random() * FIELD.w * 2, PLAY.top + random() * (PLAY.bottom - PLAY.top)]);
    const links: [number, number][] = [];
    nodes.forEach(([x, y], i) => nodes.forEach(([x2, y2], j) => { if (j > i && Math.hypot(x - x2, y - y2) < 170 && links.length < count * 1.6) links.push([i, j]); }));
    return { nodes, links, speed, alpha };
  };
  return { layers: [layer(26, .25, .5), layer(18, .55, .9)] };
}

export type DrawOptions = { reducedMotion: boolean; clock: number };

function drawBackdrop(c: CanvasRenderingContext2D, backdrop: Backdrop, distance: number, clock: number, reduced: boolean) {
  c.fillStyle = INK; c.fillRect(0, 0, FIELD.w, FIELD.h);
  // Grid, scrolled at half the network's speed.
  c.lineWidth = 1;
  const grid = 48, offset = (distance * .5) % grid;
  c.strokeStyle = "rgba(127,214,230,.045)";
  c.beginPath();
  for (let x = -offset; x < FIELD.w; x += grid) { c.moveTo(Math.round(x) + .5, PLAY.top); c.lineTo(Math.round(x) + .5, PLAY.bottom); }
  for (let y = PLAY.top; y <= PLAY.bottom; y += grid) { c.moveTo(0, y + .5); c.lineTo(FIELD.w, y + .5); }
  c.stroke();
  const span = FIELD.w * 2;
  for (const layer of backdrop.layers) {
    const shift = (distance * layer.speed) % span;
    const at = ([x, y]: [number, number]): [number, number] => { let sx = x - shift; if (sx < -60) sx += span; return [sx, y]; };
    c.strokeStyle = `rgba(110,170,190,${.09 * layer.alpha})`;
    c.beginPath();
    for (const [i, j] of layer.links) {
      const [x1, y1] = at(layer.nodes[i]), [x2, y2] = at(layer.nodes[j]);
      if (Math.abs(x1 - x2) > 300) continue;
      c.moveTo(x1, y1); c.lineTo(x2, y2);
    }
    c.stroke();
    c.fillStyle = `rgba(127,214,230,${.22 * layer.alpha})`;
    for (const node of layer.nodes) { const [x, y] = at(node); c.fillRect(x - 1.5, y - 1.5, 3, 3); }
    // A few data particles riding the links.
    if (!reduced) {
      c.fillStyle = `rgba(143,227,192,${.5 * layer.alpha})`;
      layer.links.forEach(([i, j], k) => {
        if (k % 4) return;
        const [x1, y1] = at(layer.nodes[i]), [x2, y2] = at(layer.nodes[j]);
        if (Math.abs(x1 - x2) > 300) return;
        const t = (clock * .35 + k * .137) % 1;
        c.fillRect(x1 + (x2 - x1) * t - 1, y1 + (y2 - y1) * t - 1, 2, 2);
      });
    }
  }
  // Play-band rules.
  c.strokeStyle = "rgba(127,214,230,.14)";
  c.beginPath(); c.moveTo(0, PLAY.top - .5); c.lineTo(FIELD.w, PLAY.top - .5); c.moveTo(0, PLAY.bottom + .5); c.lineTo(FIELD.w, PLAY.bottom + .5); c.stroke();
}

function glow(c: CanvasRenderingContext2D, color: string, blur: number) { c.shadowColor = color; c.shadowBlur = blur; }
function noGlow(c: CanvasRenderingContext2D) { c.shadowBlur = 0; }

export function draw(c: CanvasRenderingContext2D, world: World, backdrop: Backdrop, phase: Phase, { reducedMotion, clock }: DrawOptions) {
  const distance = (phase === "menu" ? clock * 60 : world.time * world.scroll) * (reducedMotion ? .4 : 1);
  drawBackdrop(c, backdrop, distance, clock, reducedMotion);
  if (phase === "menu") return;

  // Firewalls: segmented bricks, a scan line, brackets at the gap.
  for (const wall of world.walls) {
    const top = wall.gapY - wall.gapH / 2, bottom = wall.gapY + wall.gapH / 2;
    for (const [y0, y1] of [[PLAY.top, top], [bottom, PLAY.bottom]]) {
      c.fillStyle = "rgba(226,87,63,.14)"; c.fillRect(wall.x - 4, y0, wall.w + 8, y1 - y0);
      for (let y = y0 + 2; y < y1 - 2; y += 14) {
        c.fillStyle = (Math.floor(y / 14) % 3 === 0) ? AMBER : RED;
        c.globalAlpha = .75;
        c.fillRect(wall.x + 3, y, wall.w - 6, Math.min(10, y1 - 2 - y));
      }
      c.globalAlpha = 1;
    }
    const scan = PLAY.top + ((clock * 180 + wall.born * 97) % (PLAY.bottom - PLAY.top));
    if (scan < top || scan > bottom) { c.fillStyle = "rgba(255,210,160,.55)"; c.fillRect(wall.x, scan, wall.w, 2); }
    c.strokeStyle = AMBER; c.lineWidth = 2;
    c.beginPath();
    c.moveTo(wall.x - 6, top - 1); c.lineTo(wall.x + wall.w + 6, top - 1);
    c.moveTo(wall.x - 6, bottom + 1); c.lineTo(wall.x + wall.w + 6, bottom + 1);
    c.stroke();
  }

  // Routing nodes: a rotating ring of ticks.
  for (const node of world.nodes) {
    c.save(); c.translate(node.x, node.y);
    glow(c, BLUE, node.used ? 4 : 12);
    c.strokeStyle = node.used ? "rgba(156,200,255,.25)" : BLUE; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, node.r, 0, Math.PI * 2); c.stroke();
    c.rotate(node.spin);
    for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); c.fillStyle = node.used ? "rgba(156,200,255,.3)" : BLUE; c.fillRect(node.r - 3, -1.5, 8, 3); }
    noGlow(c);
    c.restore();
    if (!node.used) { c.fillStyle = "rgba(156,200,255,.7)"; c.font = `600 10px ${MONO}`; c.textAlign = "center"; c.fillText("ROUTE ×2", node.x, node.y + node.r + 16); }
  }

  // Data fragments: small luminous shards.
  for (const fragment of world.fragments) {
    c.save(); c.translate(fragment.x, fragment.y); c.rotate(fragment.spin);
    glow(c, GREEN, 10);
    c.fillStyle = GREEN;
    c.beginPath(); c.moveTo(0, -9); c.lineTo(6, 0); c.lineTo(0, 9); c.lineTo(-6, 0); c.closePath(); c.fill();
    noGlow(c);
    c.fillStyle = INK; c.fillRect(-1.5, -4, 3, 8);
    c.restore();
  }

  // Corrupted packets: jittering red squares with glitch slivers.
  for (const packet of world.packets) {
    c.save(); c.translate(packet.x, packet.y); c.rotate(packet.spin);
    glow(c, RED, 8);
    c.fillStyle = packet.kind === "tracker" ? AMBER : RED;
    c.fillRect(-packet.r, -packet.r, packet.r * 2, packet.r * 2);
    noGlow(c);
    c.fillStyle = INK; c.fillRect(-packet.r * .45, -packet.r * .45, packet.r * .9, packet.r * .9);
    c.restore();
    if (!reducedMotion && Math.floor(clock * 20 + packet.r) % 5 === 0) { c.fillStyle = "rgba(226,87,63,.6)"; c.fillRect(packet.x - packet.r - 8, packet.y - 2, 5, 2); }
  }

  // Pulse and node rings.
  for (const ring of world.rings) {
    const fade = 1 - ring.life / ring.duration;
    c.strokeStyle = ring.color; c.globalAlpha = fade * .9; c.lineWidth = 2 + fade * 3;
    c.beginPath(); c.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 1;
  }
  for (const spark of world.sparks) {
    c.globalAlpha = Math.max(0, spark.life / spark.max);
    c.fillStyle = spark.color; c.fillRect(spark.x - 1.5, spark.y - 1.5, 3, 3);
  }
  c.globalAlpha = 1;

  // The packet: a trail, a glowing core, blinking while invulnerable.
  const p = world.player;
  if (p.trail.length > 1) {
    for (let i = 1; i < p.trail.length; i++) {
      const [x0, y0] = p.trail[i - 1], [x1, y1] = p.trail[i];
      c.strokeStyle = `rgba(127,214,230,${(i / p.trail.length) * .45})`; c.lineWidth = 1 + (i / p.trail.length) * 5;
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
  }
  const visible = world.invulnerable <= 0 || Math.floor(world.invulnerable * 14) % 2 === 0;
  if (visible && !world.over) {
    c.save(); c.translate(p.x, p.y); c.rotate(Math.PI / 4 + world.time * .8);
    if (world.flash > 0) { c.fillStyle = "rgba(226,87,63,.6)"; c.fillRect(-11 + 3, -11, 22, 22); }
    glow(c, CYAN, 16);
    c.strokeStyle = CYAN; c.lineWidth = 2.5; c.strokeRect(-10, -10, 20, 20);
    c.fillStyle = "#e4fbff"; c.fillRect(-4.5, -4.5, 9, 9);
    noGlow(c);
    c.restore();
  }

  // Damage flash: a thin red wash at the edges, no shake.
  if (world.flash > 0) {
    const a = world.flash / .35 * .28;
    const g = c.createRadialGradient(FIELD.w / 2, FIELD.h / 2, FIELD.h * .35, FIELD.w / 2, FIELD.h / 2, FIELD.w * .65);
    g.addColorStop(0, "rgba(226,87,63,0)"); g.addColorStop(1, `rgba(226,87,63,${a})`);
    c.fillStyle = g; c.fillRect(0, 0, FIELD.w, FIELD.h);
  }

  drawHud(c, world);
}

function drawHud(c: CanvasRenderingContext2D, world: World) {
  c.textBaseline = "middle";
  // Top strip: score and multiplier.
  c.font = `600 13px ${MONO}`; c.textAlign = "left";
  c.fillStyle = MUTED; c.fillText("SCORE", 18, 24);
  c.fillStyle = "#dfe8ea"; c.font = `600 17px ${MONO}`;
  c.fillText(String(Math.floor(world.score)).padStart(6, "0"), 76, 24);
  if (world.multiplier > 1) {
    c.textAlign = "right"; c.fillStyle = BLUE; c.font = `700 17px ${MONO}`;
    c.fillText(`×${world.multiplier}`, FIELD.w - 18, 24);
    c.fillStyle = "rgba(156,200,255,.25)"; c.fillRect(FIELD.w - 118, 36, 70, 2);
    c.fillStyle = BLUE; c.fillRect(FIELD.w - 118, 36, 70 * world.multiplierTime / 5, 2);
  }
  // Bottom strip: integrity and pulse.
  const y = FIELD.h - 23;
  c.textAlign = "left"; c.font = `600 13px ${MONO}`; c.fillStyle = MUTED; c.fillText("INTEGRITY", 18, y);
  for (let i = 0; i < 3; i++) {
    c.beginPath(); c.arc(116 + i * 20, y, 6, 0, Math.PI * 2);
    if (i < world.integrity) { c.fillStyle = CYAN; c.fill(); } else { c.strokeStyle = "rgba(127,214,230,.35)"; c.lineWidth = 1.5; c.stroke(); }
  }
  c.textAlign = "right"; c.fillStyle = world.pulseCharge >= 1 ? CYAN : MUTED; c.fillText(world.pulseCharge >= 1 ? "PULSE READY" : "PULSE", FIELD.w - 196, y);
  const cells = 10, cw = 15, x0 = FIELD.w - 18 - cells * (cw + 2);
  for (let i = 0; i < cells; i++) {
    const on = world.pulseCharge * cells > i + .01;
    c.fillStyle = on ? (world.pulseCharge >= 1 ? CYAN : "rgba(127,214,230,.6)") : "rgba(127,214,230,.12)";
    c.fillRect(x0 + i * (cw + 2), y - 5, cw, 10);
  }
}

/** Keeps the drawing buffer at the element's size × device pixel ratio, with
 * the logical field letterboxed inside it. Returns the transform in use. */
export function fitCanvas(canvas: HTMLCanvasElement, ratio: number) {
  // Layout size, not the bounding box: the console is scaled and skewed by CSS transforms.
  const width = Math.max(1, Math.round(canvas.clientWidth * ratio)), height = Math.max(1, Math.round(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const scale = Math.min(width / FIELD.w, height / FIELD.h);
  return { scale, x: (width - FIELD.w * scale) / 2, y: (height - FIELD.h * scale) / 2 };
}

export const PULSE_SECONDS = PULSE_COOLDOWN;
