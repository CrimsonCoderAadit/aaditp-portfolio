/** SYSTEM RUNNER — the game rules, with no DOM, canvas or timers.
 *
 * The world is a fixed 960 × 600 logical field. The network scrolls from right
 * to left toward the player's packet, which moves freely inside the play band
 * between the HUD strips. Everything advances by `update(world, dt, input)`
 * with delta time, so speed is identical at any refresh rate; the caller owns
 * the loop. Randomness comes from a seeded generator so runs can be replayed
 * in tests. */

export const FIELD = { w: 960, h: 600 } as const;
/** The play band: the HUD owns the strips above and below it. */
export const PLAY = { top: 46, bottom: 554, left: 12, right: 948 } as const;

export const PLAYER_RADIUS = 11;
export const PLAYER_SPEED = 390;
export const PULSE_COOLDOWN = 2.8;
export const PULSE_RADIUS = 135;
export const INTEGRITY = 3;
export const INVULNERABLE = 1.4;
export const MULTIPLIER_TIME = 5;
/** Difficulty steps up this often, in seconds of survival. */
export const LEVEL_TIME = 17;
const MAX_LEVEL = 9;

export type Phase = "menu" | "playing" | "paused" | "over";
export type Input = { x: number; y: number; pulse: boolean };
export type GameEvent = "fragment" | "node" | "pulse" | "destroy" | "hit" | "over" | "level";

type PacketKind = "straight" | "diagonal" | "tracker";
export type Packet = { x: number; y: number; vx: number; vy: number; r: number; kind: PacketKind; spin: number; alive: boolean };
export type Wall = { x: number; w: number; gapY: number; gapH: number; born: number };
export type Fragment = { x: number; y: number; spin: number; alive: boolean };
export type RouteNode = { x: number; y: number; r: number; used: boolean; spin: number };
export type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string };
export type Ring = { x: number; y: number; r: number; max: number; life: number; duration: number; color: string };

export type World = {
  time: number;
  score: number;
  integrity: number;
  invulnerable: number;
  flash: number;
  pulseCharge: number;
  multiplier: number;
  multiplierTime: number;
  level: number;
  scroll: number;
  player: { x: number; y: number; vx: number; vy: number; trail: [number, number][] };
  packets: Packet[];
  walls: Wall[];
  fragments: Fragment[];
  nodes: RouteNode[];
  sparks: Spark[];
  rings: Ring[];
  timers: { packet: number; wall: number; fragment: number; node: number; storm: number };
  storm: { left: number; next: number; laneY: number; clearUntil: number };
  stats: { fragments: number; nodes: number; destroyed: number; hits: number; pulses: number };
  events: GameEvent[];
  trailLength: number;
  random: () => number;
  over: boolean;
};

/** mulberry32: small, fast, seedable. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function createWorld(seed = Date.now(), reducedMotion = false): World {
  return {
    time: 0, score: 0, integrity: INTEGRITY, invulnerable: 0, flash: 0, pulseCharge: 1,
    multiplier: 1, multiplierTime: 0, level: 0, scroll: scrollFor(0),
    player: { x: 180, y: (PLAY.top + PLAY.bottom) / 2, vx: 0, vy: 0, trail: [] },
    packets: [], walls: [], fragments: [], nodes: [], sparks: [], rings: [],
    // The opening seconds are quiet: first packet at 1.6s, first firewall at 5s,
    // first routing node at 12s.
    timers: { packet: 1.6, wall: 5, fragment: 1.2, node: 12, storm: 0 },
    storm: { left: 0, next: 0, laneY: 0, clearUntil: 0 },
    stats: { fragments: 0, nodes: 0, destroyed: 0, hits: 0, pulses: 0 },
    events: [], trailLength: reducedMotion ? 5 : 16,
    random: seededRandom(seed), over: false,
  };
}

function scrollFor(level: number) { return 205 * (1 + .1 * level); }

/** Seconds between hostile packets: forgiving for the first ten seconds, then
 * tightening a little every level. */
function packetInterval(world: World) {
  if (world.time < 10) return 1.55;
  return Math.max(.42, 1.12 - .085 * world.level);
}
function wallInterval(world: World) { return Math.max(2.05, 3.6 - .18 * world.level); }
function gapHeight(world: World) { return Math.max(150, 250 - 12 * world.level); }

const inBand = (y: number, margin: number) => clamp(y, PLAY.top + margin, PLAY.bottom - margin);

function spawnPacket(world: World, y: number, kind: PacketKind) {
  const { random } = world;
  const r = 9 + random() * 3;
  const vy = kind === "diagonal" ? (random() < .5 ? -1 : 1) * (60 + random() * 55) : 0;
  // A storm reserves its lane until the burst has crossed the play field.
  if (world.time < world.storm.clearUntil && Math.abs(y - world.storm.laneY) < 85)
    y = world.storm.laneY < (PLAY.top + PLAY.bottom) / 2 ? world.storm.laneY + 105 : world.storm.laneY - 105;
  world.packets.push({ x: FIELD.w + r + 8, y: inBand(y, r + 4), vx: -(world.scroll + 40 + random() * 95), vy, r, kind, spin: random() * 6, alive: true });
}

/** A firewall whose gap is always reachable from the previous one at the
 * player's speed in the time between them, with a generous margin. */
function spawnWall(world: World) {
  const { random } = world;
  const gapH = gapHeight(world);
  const half = gapH / 2 + 6;
  const previous = world.walls[world.walls.length - 1];
  let gapY = PLAY.top + half + random() * (PLAY.bottom - PLAY.top - 2 * half);
  if (previous) {
    const travel = (FIELD.w + 30 - previous.x) / world.scroll;
    const reach = Math.max(80, PLAYER_SPEED * .5 * Math.max(.4, travel));
    gapY = clamp(gapY, previous.gapY - reach, previous.gapY + reach);
  }
  if (world.time < world.storm.clearUntil) gapY = world.storm.laneY;
  gapY = clamp(gapY, PLAY.top + half, PLAY.bottom - half);
  world.walls.push({ x: FIELD.w + 10, w: 30, gapY, gapH, born: world.time });
  // No hostile packet enters just as a firewall does.
  world.timers.packet = Math.max(world.timers.packet, .6);
}

function spawnFragment(world: World) {
  const { random } = world;
  // Right after a firewall, the fragment sits in its gap: a reward for threading it.
  const fresh = world.walls.find((wall) => world.time - wall.born < .35);
  const y = fresh ? fresh.gapY : PLAY.top + 30 + random() * (PLAY.bottom - PLAY.top - 60);
  world.fragments.push({ x: FIELD.w + (fresh ? fresh.w / 2 + 10 : 20), y, spin: random() * 6, alive: true });
}

function spawnNode(world: World) {
  const { random } = world;
  // Never inside a firewall: nodes enter only when the right edge is clear.
  const blocked = world.walls.some((wall) => wall.x > FIELD.w - 160);
  if (blocked) { world.timers.node = .8; return; }
  world.nodes.push({ x: FIELD.w + 40, y: PLAY.top + 60 + random() * (PLAY.bottom - PLAY.top - 120), r: 34, used: false, spin: 0 });
}

function burst(world: World, x: number, y: number, color: string, count: number, speed = 160) {
  const { random } = world;
  for (let i = 0; i < count && world.sparks.length < 160; i++) {
    const a = random() * Math.PI * 2, s = speed * (.35 + random() * .65), life = .35 + random() * .35;
    world.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color });
  }
}

function damage(world: World) {
  if (world.invulnerable > 0 || world.over) return;
  world.integrity -= 1;
  world.stats.hits += 1;
  world.invulnerable = INVULNERABLE;
  world.flash = .35;
  world.events.push("hit");
  burst(world, world.player.x, world.player.y, "#ff7a5c", 14, 190);
  if (world.integrity <= 0) {
    world.integrity = 0;
    world.over = true;
    world.events.push("over");
  }
}

function circleHitsRect(cx: number, cy: number, r: number, x0: number, y0: number, x1: number, y1: number) {
  const nx = clamp(cx, x0, x1), ny = clamp(cy, y0, y1);
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

/** Whether the player's packet overlaps a firewall's solid segments. */
export function hitsWall(wall: Wall, x: number, y: number, r: number) {
  const top = wall.gapY - wall.gapH / 2, bottom = wall.gapY + wall.gapH / 2;
  return circleHitsRect(x, y, r, wall.x, PLAY.top, wall.x + wall.w, top) || circleHitsRect(x, y, r, wall.x, bottom, wall.x + wall.w, PLAY.bottom);
}

/** Fires the pulse if charged. Returns how many packets it destroyed. */
export function pulse(world: World) {
  if (world.pulseCharge < 1 || world.over) return -1;
  world.pulseCharge = 0;
  world.stats.pulses += 1;
  world.events.push("pulse");
  const { x, y } = world.player;
  world.rings.push({ x, y, r: 0, max: PULSE_RADIUS, life: 0, duration: .42, color: "#7fd6e6" });
  let destroyed = 0;
  for (const packet of world.packets) {
    if (!packet.alive || Math.hypot(packet.x - x, packet.y - y) > PULSE_RADIUS + packet.r) continue;
    packet.alive = false;
    destroyed++;
    world.score += 50 * world.multiplier;
    burst(world, packet.x, packet.y, "#ff9a6a", 8);
  }
  world.stats.destroyed += destroyed;
  if (destroyed) world.events.push("destroy");
  return destroyed;
}

export function update(world: World, dt: number, input: Input) {
  if (world.over) return;
  dt = Math.min(dt, 1 / 20);
  world.time += dt;
  const level = Math.min(MAX_LEVEL, Math.floor(world.time / LEVEL_TIME));
  if (level !== world.level) { world.level = level; world.events.push("level"); }
  world.scroll = scrollFor(world.level);

  // Player: velocity eases toward the input direction; the band bounds it.
  const p = world.player;
  const length = Math.hypot(input.x, input.y);
  const ix = length > 1 ? input.x / length : input.x, iy = length > 1 ? input.y / length : input.y;
  const follow = 1 - Math.exp(-16 * dt);
  p.vx += (ix * PLAYER_SPEED - p.vx) * follow;
  p.vy += (iy * PLAYER_SPEED - p.vy) * follow;
  p.x = clamp(p.x + p.vx * dt, PLAY.left + PLAYER_RADIUS, PLAY.right - PLAYER_RADIUS);
  p.y = clamp(p.y + p.vy * dt, PLAY.top + PLAYER_RADIUS, PLAY.bottom - PLAYER_RADIUS);
  p.trail.push([p.x, p.y]);
  while (p.trail.length > world.trailLength) p.trail.shift();

  // Pulse and its recharge.
  if (input.pulse) pulse(world);
  world.pulseCharge = Math.min(1, world.pulseCharge + dt / PULSE_COOLDOWN);

  // Timers and spawning.
  const t = world.timers;
  t.packet -= dt; t.wall -= dt; t.fragment -= dt; t.node -= dt;
  if (t.wall <= 0) { spawnWall(world); t.wall = wallInterval(world) * (.9 + world.random() * .2); }
  if (t.packet <= 0) {
    const r = world.random();
    const kind: PacketKind = world.time < 10 ? "straight" : world.level >= 2 && r < .22 ? "tracker" : world.level >= 1 && r < .55 ? "diagonal" : "straight";
    // Never directly on the player's line when it enters: keep a safe band.
    let y = PLAY.top + 20 + world.random() * (PLAY.bottom - PLAY.top - 40);
    if (Math.abs(y - p.y) < 36 && world.time < 20) y += y < p.y ? -48 : 48;
    spawnPacket(world, y, kind);
    t.packet = packetInterval(world) * (.75 + world.random() * .5);
  }
  if (t.fragment <= 0) { spawnFragment(world); t.fragment = 2.2 + world.random() * 1.4; }
  if (t.node <= 0) { spawnNode(world); if (t.node <= 0) t.node = 16 + world.random() * 6; }

  // Packet storms from level 2: a short burst that always leaves a clear lane.
  if (world.level >= 2) {
    const s = world.storm;
    if (s.left === 0) {
      t.storm -= dt;
      if (t.storm <= 0) {
        s.left = 6 + Math.floor(world.random() * 2);
        s.next = 0;
        const nearWall = [...world.walls].reverse().find((wall) => wall.x > FIELD.w - 500);
        s.laneY = nearWall ? nearWall.gapY : PLAY.top + 90 + world.random() * (PLAY.bottom - PLAY.top - 180);
        s.clearUntil = world.time + 5.5;
        t.storm = 13 + world.random() * 5;
      }
    } else {
      s.next -= dt;
      if (s.next <= 0) {
        let y: number;
        do { y = PLAY.top + 16 + world.random() * (PLAY.bottom - PLAY.top - 32); } while (Math.abs(y - s.laneY) < 85);
        spawnPacket(world, y, "straight");
        s.left -= 1;
        s.next = .15;
      }
    }
  } else t.storm = 6;

  // Movement.
  for (const packet of world.packets) {
    if (packet.kind === "tracker") packet.vy = clamp(packet.vy + Math.sign(p.y - packet.y) * 90 * dt, -115, 115);
    packet.x += packet.vx * dt;
    packet.y += packet.vy * dt;
    if (packet.y < PLAY.top + packet.r || packet.y > PLAY.bottom - packet.r) { packet.vy *= -1; packet.y = inBand(packet.y, packet.r); }
    if (world.time < world.storm.clearUntil && Math.abs(packet.y - world.storm.laneY) < 85) {
      packet.y = world.storm.laneY + (packet.y < world.storm.laneY ? -85 : 85);
      packet.vy = 0;
    }
    packet.spin += dt * 3;
  }
  for (const wall of world.walls) wall.x -= world.scroll * dt;
  for (const fragment of world.fragments) { fragment.x -= world.scroll * dt; fragment.spin += dt * 2.4; }
  for (const node of world.nodes) { node.x -= world.scroll * .9 * dt; node.spin += dt * (node.used ? 5 : 1.4); }

  // Collisions. The packet's collision circle is a little smaller than it
  // looks, so grazes feel fair.
  const hit = PLAYER_RADIUS * .82;
  for (const packet of world.packets) {
    if (!packet.alive) continue;
    if (Math.hypot(packet.x - p.x, packet.y - p.y) < packet.r + hit && world.invulnerable <= 0) {
      packet.alive = false;
      damage(world);
    }
  }
  for (const wall of world.walls) if (hitsWall(wall, p.x, p.y, hit)) damage(world);
  for (const fragment of world.fragments) {
    if (!fragment.alive || Math.hypot(fragment.x - p.x, fragment.y - p.y) > PLAYER_RADIUS + 12) continue;
    fragment.alive = false;
    world.score += 100 * world.multiplier;
    world.pulseCharge = Math.min(1, world.pulseCharge + .15);
    world.stats.fragments += 1;
    world.events.push("fragment");
    burst(world, fragment.x, fragment.y, "#8fe3c0", 10, 120);
  }
  for (const node of world.nodes) {
    if (node.used || Math.hypot(node.x - p.x, node.y - p.y) > node.r - 6) continue;
    node.used = true;
    world.score += 250 * world.multiplier;
    world.multiplier = 2;
    world.multiplierTime = MULTIPLIER_TIME;
    world.stats.nodes += 1;
    world.events.push("node");
    world.rings.push({ x: node.x, y: node.y, r: node.r, max: node.r * 2.6, life: 0, duration: .55, color: "#9cc8ff" });
  }

  // Timers, score and effects.
  world.invulnerable = Math.max(0, world.invulnerable - dt);
  world.flash = Math.max(0, world.flash - dt);
  if (world.multiplierTime > 0) { world.multiplierTime = Math.max(0, world.multiplierTime - dt); if (world.multiplierTime === 0) world.multiplier = 1; }
  if (!world.over) world.score += dt * 22 * world.multiplier;
  for (const spark of world.sparks) { spark.x += spark.vx * dt; spark.y += spark.vy * dt; spark.vx *= .92; spark.vy *= .92; spark.life -= dt; }
  for (const ring of world.rings) { ring.life += dt; ring.r = ring.max * Math.min(1, ring.life / ring.duration); }

  // Cleanup: off-screen and spent entities.
  world.packets = world.packets.filter((packet) => packet.alive && packet.x > -40);
  world.walls = world.walls.filter((wall) => wall.x + wall.w > -10);
  world.fragments = world.fragments.filter((fragment) => fragment.alive && fragment.x > -30);
  world.nodes = world.nodes.filter((node) => node.x > -60);
  world.sparks = world.sparks.filter((spark) => spark.life > 0);
  world.rings = world.rings.filter((ring) => ring.life < ring.duration);
}

/** Survival seconds and score as shown to the player. */
export const displayScore = (world: World) => Math.floor(world.score);
