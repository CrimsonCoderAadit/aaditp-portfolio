import type { Sfx } from "../sfx";
import type { Engine, GameDefinition, Input } from "../types";

/** BYTE CLIMBER: an original vertical climber. A maintenance bot climbs a
 * failing server tower floor by floor while corruption rises from below.
 * Floors are generated as the bot climbs; every floor is joined to the one
 * beneath by at least one ladder over solid ground, so a route up always
 * exists. Hazards: timed power surges along the decks, corrupted blocks that
 * patrol them, and falling shards from above. World units, y up, floor 0 at
 * y = 0. */

type Deck = { x0: number; x1: number; y: number; mover?: { from: number; to: number; speed: number; phase: number } };
type Ladder = { x: number; y0: number; y1: number };
type Surge = { x0: number; x1: number; y: number; period: number; offset: number };
type Blob = { deck: Deck; x: number; dir: number; speed: number };
type Shard = { x: number; y: number; warn: number; vy: number };
type Fragment = { x: number; y: number; taken: boolean };

const WIDTH = 14, FLOOR = 3.2, BOT = { w: .8, h: 1 };
const GRAVITY = 32, JUMP = 12.4, RUN = 6.2, CLIMB = 4.8;
const GREEN = "#5fd08a", MAGENTA = "#e0479e", CYAN = "#46d6e8";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const hash = (a: number, b: number) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

function create(sfx: Sfx): Engine {
  const decks: Deck[] = [], ladders: Ladder[] = [], surges: Surge[] = [], blobs: Blob[] = [], shards: Shard[] = [], fragments: Fragment[] = [];
  const floors: Deck[][] = [];
  const bot = { x: WIDTH / 2, y: 0, vx: 0, vy: 0, ground: null as Deck | null, ladder: null as Ladder | null, facing: 1, coyote: 0, buffer: 0, hurt: 0 };
  const state = { time: 0, level: 1, integrity: 3, fragments: 0, top: 0, tide: -6, camera: -1, over: false, flash: 0 };

  const moverX = (deck: Deck, time: number) => {
    const m = deck.mover!;
    return m.from + (m.to - m.from) * (Math.sin(time * m.speed + m.phase) + 1) / 2;
  };
  const span = (deck: Deck, time: number): [number, number] => {
    if (!deck.mover) return [deck.x0, deck.x1];
    const x = moverX(deck, time), half = (deck.x1 - deck.x0) / 2;
    return [x - half, x + half];
  };

  const addFloor = (k: number) => {
    const y = k * FLOOR;
    let row: Deck[] = [];
    if (k === 0) row = [{ x0: 0, x1: WIDTH, y }];
    else {
      let x = rand(0, 1.2);
      while (x < WIDTH - 1.2) {
        const end = Math.min(WIDTH, x + rand(2.6, 5.4));
        if (end - x >= 1.8) row.push({ x0: x, x1: end, y });
        x = end + rand(1.3, 2.5);
      }
      const below = floors[k - 1].filter((deck) => !deck.mover);
      const overlaps = () => row.flatMap((deck) => below.map((under) => [Math.max(deck.x0, under.x0), Math.min(deck.x1, under.x1)] as [number, number])).filter(([a, b]) => b - a >= 1.4);
      if (!overlaps().length) {
        const under = below[Math.floor(Math.random() * below.length)], mid = (under.x0 + under.x1) / 2;
        row.push({ x0: Math.max(0, mid - 1.3), x1: Math.min(WIDTH, mid + 1.3), y });
      }
      const options = overlaps().sort(() => Math.random() - .5);
      for (const [a, b] of options.slice(0, k > 2 && Math.random() < .45 ? 2 : 1)) ladders.push({ x: rand(a + .5, b - .5), y0: y - FLOOR, y1: y });
      // Shuttles across the wider gaps: another way up and across.
      const sorted = [...row].sort((p, q) => p.x0 - q.x0);
      for (let i = 1; i < sorted.length; i++) {
        const gap0 = sorted[i - 1].x1, gap1 = sorted[i].x0;
        if (gap1 - gap0 > 2.2 && k > 1 && Math.random() < .4) {
          row.push({ x0: gap0 + .1, x1: gap0 + 1.7, y, mover: { from: gap0 + .9, to: gap1 - .9, speed: rand(.8, 1.4), phase: rand(0, 6) } });
        }
      }
    }
    floors[k] = row;
    decks.push(...row);
    if (k < 2) return;
    const level = state.level;
    const statics = row.filter((deck) => !deck.mover);
    const clearOfLadders = (x0: number, x1: number) => !ladders.some((l) => (Math.abs(l.y0 - y) < .01 || Math.abs(l.y1 - y) < .01) && l.x > x0 - .9 && l.x < x1 + .9);
    for (const deck of statics) {
      if (deck.x1 - deck.x0 > 3 && Math.random() < .28 + level * .05) {
        const x0 = rand(deck.x0 + .2, deck.x1 - 1.9);
        if (clearOfLadders(x0, x0 + 1.6)) surges.push({ x0, x1: x0 + 1.6, y, period: rand(2.6, 3.4) / (1 + level * .08), offset: rand(0, 3) });
      }
      if (deck.x1 - deck.x0 > 3.4 && Math.random() < .22 + level * .06) blobs.push({ deck, x: rand(deck.x0 + .5, deck.x1 - .5), dir: Math.random() < .5 ? -1 : 1, speed: rand(1.2, 1.9) + level * .3 });
      if (Math.random() < .5) fragments.push({ x: rand(deck.x0 + .4, deck.x1 - .4), y: y + .7, taken: false });
    }
  };
  for (let k = 0; k < 8; k++) addFloor(k);

  const surgeLive = (s: Surge) => { const t = ((state.time + s.offset) % s.period) / s.period; return t > .55 && t < .85 ? "live" : t > .38 && t <= .55 ? "warn" : "off"; };

  const hurt = () => {
    if (bot.hurt > 0 || state.over) return;
    state.integrity--;
    bot.hurt = 1.6; bot.vy = 8; bot.vx = -bot.facing * 4; bot.ladder = null; bot.ground = null;
    state.flash = .35;
    sfx.play("hit");
    if (state.integrity <= 0) state.over = true;
  };

  const update = (dt: number, input: Input) => {
    if (state.over) return;
    state.time += dt;
    state.level = 1 + Math.floor(state.time / 25);
    state.flash = Math.max(0, state.flash - dt);
    bot.hurt -= dt;
    const move = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (move) bot.facing = move;
    if (input.actionHit) bot.buffer = .12;
    bot.buffer -= dt;

    // Ladders: grab with up or down while over one.
    if (!bot.ladder && (input.up || (input.down && bot.ground))) {
      const grab = ladders.find((l) => Math.abs(bot.x - l.x) < .55 && (input.up ? bot.y >= l.y0 - .05 && bot.y < l.y1 - .05 : bot.y > l.y0 + .05 && bot.y <= l.y1 + .05));
      if (grab) { bot.ladder = grab; bot.ground = null; }
    }
    if (bot.ladder) {
      const l = bot.ladder;
      bot.x = l.x; bot.vx = 0;
      bot.vy = ((input.up ? 1 : 0) - (input.down ? 1 : 0)) * CLIMB;
      bot.y = Math.max(l.y0, Math.min(l.y1, bot.y + bot.vy * dt));
      const atEnd = (bot.y >= l.y1 && input.up) || (bot.y <= l.y0 && input.down);
      if (atEnd || (move && (bot.y >= l.y1 - .1 || bot.y <= l.y0 + .1))) {
        bot.ladder = null; bot.vy = 0;
        bot.ground = decks.find((d) => Math.abs(d.y - bot.y) < .15 && bot.x > span(d, state.time)[0] && bot.x < span(d, state.time)[1]) ?? null;
      }
      if (bot.buffer > 0 && bot.ladder) { bot.ladder = null; bot.vy = JUMP * .85; bot.buffer = 0; sfx.play("jump"); }
    } else {
      const target = move * RUN, accel = bot.ground ? 42 : 22;
      bot.vx += Math.max(-accel * dt, Math.min(accel * dt, target - bot.vx));
      if (bot.ground) bot.coyote = .09; else bot.coyote -= dt;
      if (bot.buffer > 0 && bot.coyote > 0) { bot.vy = JUMP; bot.ground = null; bot.coyote = 0; bot.buffer = 0; sfx.play("jump"); }
      // Riding a shuttle carries the bot with it.
      if (bot.ground?.mover) bot.x += moverX(bot.ground, state.time) - moverX(bot.ground, state.time - dt);
      const previous = bot.y;
      if (!bot.ground) bot.vy = Math.max(-20, bot.vy - GRAVITY * dt);
      bot.x = Math.max(BOT.w / 2, Math.min(WIDTH - BOT.w / 2, bot.x + bot.vx * dt));
      bot.y += bot.vy * dt;
      if (bot.ground) {
        const [a, b] = span(bot.ground, state.time);
        if (bot.x + BOT.w / 2 < a || bot.x - BOT.w / 2 > b) bot.ground = null;
        else bot.y = bot.ground.y;
      }
      if (!bot.ground && bot.vy <= 0) {
        for (const deck of decks) {
          const [a, b] = span(deck, state.time);
          if (previous >= deck.y - .001 && bot.y <= deck.y && bot.x + BOT.w / 2 > a && bot.x - BOT.w / 2 < b) {
            bot.y = deck.y; bot.vy = 0; bot.ground = deck; break;
          }
        }
      }
    }

    const floor = Math.floor((bot.y + .01) / FLOOR);
    state.top = Math.max(state.top, floor);
    while (floors.length < floor + 9) addFloor(floors.length);

    // Hazards.
    const box = { x0: bot.x - BOT.w / 2, x1: bot.x + BOT.w / 2, y0: bot.y, y1: bot.y + BOT.h };
    for (const s of surges) if (surgeLive(s) === "live" && Math.abs(bot.y - s.y) < .2 && box.x1 > s.x0 && box.x0 < s.x1) hurt();
    for (const b of blobs) {
      b.x += b.dir * b.speed * dt;
      if (b.x < b.deck.x0 + .35 || b.x > b.deck.x1 - .35) { b.dir *= -1; b.x = Math.max(b.deck.x0 + .35, Math.min(b.deck.x1 - .35, b.x)); }
      if (box.x1 > b.x - .35 && box.x0 < b.x + .35 && box.y0 < b.deck.y + .6 && box.y1 > b.deck.y) hurt();
    }
    const viewTop = state.camera + 18;
    if (state.time > 6 && Math.random() < dt * (.25 + state.level * .12)) shards.push({ x: rand(.5, WIDTH - .5), y: viewTop, warn: .9, vy: 0 });
    for (const s of shards) {
      if (s.warn > 0) { s.warn -= dt; continue; }
      s.vy = Math.min(14, s.vy + 22 * dt); s.y -= s.vy * dt;
      if (Math.abs(s.x - bot.x) < .55 && s.y > box.y0 && s.y < box.y1 + .3) { hurt(); s.y = -999; }
    }
    for (let k = shards.length - 1; k >= 0; k--) if (shards[k].y < state.tide - 2) shards.splice(k, 1);
    for (const f of fragments) if (!f.taken && Math.abs(f.x - bot.x) < .6 && f.y > box.y0 - .2 && f.y < box.y1 + .2) { f.taken = true; state.fragments++; sfx.play("pickup"); }

    // Corruption rises, faster each level, and never falls far behind.
    state.tide = Math.max(state.tide + (.32 + state.level * .12) * dt, bot.y - 15);
    if (bot.y + BOT.h * .4 < state.tide) { state.integrity = 0; state.over = true; sfx.play("hit"); }

    const targetCamera = Math.max(-1, bot.y - 5);
    state.camera += (targetCamera - state.camera) * Math.min(1, dt * 4);
  };

  const render = (c: CanvasRenderingContext2D, w: number, h: number) => {
    const scale = Math.min(w / (WIDTH + 1), h / 12.5);
    const left = (w - WIDTH * scale) / 2;
    const sx = (x: number) => left + x * scale, sy = (y: number) => h - (y - state.camera) * scale - h * .08;
    const bg = c.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0a0b14"); bg.addColorStop(1, "#06070b");
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = "#0c0e16"; c.fillRect(sx(0), 0, WIDTH * scale, h);

    const first = Math.max(0, Math.floor((state.camera - 2) / FLOOR)), last = Math.ceil((state.camera + h / scale + 2) / FLOOR);
    // Server racks behind every floor, their lights ticking over.
    for (let k = first; k <= last; k++) {
      for (let i = 0; i < 4; i++) {
        const x = .7 + i * 3.4, y = k * FLOOR + .25;
        c.fillStyle = "#121521"; c.fillRect(sx(x), sy(y + FLOOR - .5), 2.6 * scale, (FLOOR - .5) * scale);
        c.fillStyle = "#1a1e2d";
        for (let u = 0; u < 5; u++) c.fillRect(sx(x + .12), sy(y + .3 + u * .5 + .36), 2.36 * scale, .34 * scale);
        for (let u = 0; u < 5; u++) for (let v = 0; v < 3; v++) {
          const on = hash(k * 13 + i, u * 7 + v + Math.floor(state.time * 1.5 + hash(k, i) * 3)) > .45;
          if (!on) continue;
          c.fillStyle = hash(k + u, i + v) > .85 ? "#ff5a5a" : hash(k, u + v) > .5 ? GREEN : CYAN;
          c.fillRect(sx(x + .3 + v * .22), sy(y + .3 + u * .5 + .24), .09 * scale, .09 * scale);
        }
      }
      c.strokeStyle = "#232838"; c.lineWidth = Math.max(1, .06 * scale);
      c.beginPath(); c.moveTo(sx(3.3), sy(k * FLOOR + 2.8)); c.quadraticCurveTo(sx(3.5), sy(k * FLOOR + 2 - hash(k, 2)), sx(4.1), sy(k * FLOOR + 2.8)); c.stroke();
    }
    c.fillStyle = "#07080d"; c.fillRect(0, 0, sx(0), h); c.fillRect(sx(WIDTH), 0, w - sx(WIDTH), h);

    for (const l of ladders) {
      if (l.y1 < state.camera - 2 || l.y0 > state.camera + h / scale + 2) continue;
      c.fillStyle = "#b7963c";
      c.fillRect(sx(l.x - .38), sy(l.y1), .08 * scale, FLOOR * scale);
      c.fillRect(sx(l.x + .3), sy(l.y1), .08 * scale, FLOOR * scale);
      for (let y = l.y0 + .3; y < l.y1; y += .45) c.fillRect(sx(l.x - .38), sy(y), .76 * scale, .07 * scale);
    }
    for (const deck of decks) {
      if (deck.y < state.camera - 2 || deck.y > state.camera + h / scale + 2) continue;
      const [a, b] = span(deck, state.time);
      c.fillStyle = deck.mover ? "#3a3522" : "#262c3a"; c.fillRect(sx(a), sy(deck.y), (b - a) * scale, .34 * scale);
      c.fillStyle = deck.mover ? "#e0b04a" : "#3b4356"; c.fillRect(sx(a), sy(deck.y), (b - a) * scale, .07 * scale);
      c.fillStyle = GREEN; c.globalAlpha = .6; c.fillRect(sx(a), sy(deck.y - .3), (b - a) * scale, .03 * scale); c.globalAlpha = 1;
    }
    for (const s of surges) {
      const phase = surgeLive(s);
      if (phase === "off") continue;
      if (phase === "warn") {
        c.fillStyle = Math.floor(state.time * 14) % 2 ? "#ff5a5a" : "#5a1f28";
        for (let x = s.x0; x < s.x1; x += .4) c.fillRect(sx(x), sy(s.y + .08), .2 * scale, .08 * scale);
        continue;
      }
      c.save(); c.shadowColor = CYAN; c.shadowBlur = 14;
      c.strokeStyle = "#bff4ff"; c.lineWidth = Math.max(1.5, .06 * scale);
      c.beginPath();
      for (let x = s.x0; x <= s.x1 + .01; x += .2) c.lineTo(sx(x), sy(s.y + .15 + Math.random() * .45));
      c.stroke(); c.restore();
    }
    for (const b of blobs) {
      const y = b.deck.y;
      c.fillStyle = MAGENTA;
      for (let i = 0; i < 5; i++) {
        const jx = (hash(i, Math.floor(state.time * 10)) - .5) * .18, jy = (hash(i + 3, Math.floor(state.time * 10)) - .5) * .12;
        c.globalAlpha = .55 + i * .09;
        c.fillRect(sx(b.x - .3 + (i % 3) * .2 + jx), sy(y + .55 - Math.floor(i / 3) * .25 + jy), .22 * scale, .22 * scale);
      }
      c.globalAlpha = 1;
    }
    for (const f of fragments) {
      if (f.taken) continue;
      const bob = Math.sin(state.time * 3 + f.x) * .08;
      c.save(); c.translate(sx(f.x), sy(f.y + bob)); c.rotate(state.time * 2);
      c.shadowColor = GREEN; c.shadowBlur = 10; c.fillStyle = GREEN;
      c.fillRect(-.14 * scale, -.14 * scale, .28 * scale, .28 * scale); c.restore();
    }
    for (const s of shards) {
      if (s.warn > 0) {
        c.fillStyle = Math.floor(s.warn * 10) % 2 ? "#ff5a5a" : "#7a2030";
        c.beginPath(); c.moveTo(sx(s.x - .3), 8); c.lineTo(sx(s.x + .3), 8); c.lineTo(sx(s.x), 22); c.fill();
        continue;
      }
      c.fillStyle = MAGENTA; c.fillRect(sx(s.x - .12), sy(s.y + .5), .24 * scale, .5 * scale);
    }

    if (bot.hurt <= 0 || Math.floor(bot.hurt * 12) % 2 === 0) {
      const x = sx(bot.x - BOT.w / 2), y = sy(bot.y + BOT.h), bw = BOT.w * scale, bh = BOT.h * scale;
      c.fillStyle = "#d8dde6"; c.beginPath(); c.roundRect(x, y + bh * .12, bw, bh * .88, bw * .22); c.fill();
      c.fillStyle = "#11141b"; c.fillRect(x + bw * .14, y + bh * .26, bw * .72, bh * .26);
      c.fillStyle = GREEN; c.fillRect(x + bw * (bot.facing > 0 ? .56 : .22), y + bh * .32, bw * .2, bh * .12);
      c.fillStyle = "#9aa3b2"; c.fillRect(x + bw * .46, y, bw * .08, bh * .14);
      c.fillStyle = "#6a7282"; c.fillRect(x + bw * .12, y + bh * .9, bw * .28, bh * .1); c.fillRect(x + bw * .6, y + bh * .9, bw * .28, bh * .1);
    }

    // The corruption tide.
    const tideY = sy(state.tide);
    if (tideY < h) {
      const g = c.createLinearGradient(0, tideY - 30, 0, h);
      g.addColorStop(0, "rgba(224,71,158,0)"); g.addColorStop(.15, "rgba(224,71,158,.55)"); g.addColorStop(1, "rgba(80,10,40,.95)");
      c.fillStyle = g; c.fillRect(0, tideY - 30, w, h - tideY + 30);
      for (let i = 0; i < 14; i++) {
        c.fillStyle = hash(i, Math.floor(state.time * 12)) > .5 ? "#ff5aa8" : "#ffffff";
        c.globalAlpha = .35;
        c.fillRect(hash(i, Math.floor(state.time * 8)) * w, tideY + hash(i + 9, Math.floor(state.time * 8)) * 60 - 10, 20 + hash(i, 3) * 60, 3);
      }
      c.globalAlpha = 1;
    }
    if (state.flash > 0) { c.fillStyle = `rgba(255,70,110,${state.flash * .5})`; c.fillRect(0, 0, w, h); }
  };

  return {
    update, render,
    get score() { return state.top * 10 + state.fragments * 50 + Math.floor(state.time) * 2; },
    get over() { return state.over; },
    hud: () => [["Floor", String(state.top)], ["Memory", String(state.fragments)], ["Integrity", "■".repeat(Math.max(0, state.integrity)) + "□".repeat(3 - Math.max(0, state.integrity))], ["Level", String(state.level)]],
  };
}

export const BYTE_CLIMBER: GameDefinition = {
  id: "byte-climber",
  title: "BYTE CLIMBER",
  howTo: [
    "Climb the failing server tower before the corruption below reaches you.",
    "Collect green memory fragments. Avoid power surges, corrupted blocks and falling shards.",
    "Every floor has a ladder up; shuttles cross the wider gaps.",
    "A D / ← → move · W S / ↑ ↓ climb · Space jump · P pause",
  ],
  touch: "platform",
  bestKey: "aadit-byte-climber-best",
  create,
};
