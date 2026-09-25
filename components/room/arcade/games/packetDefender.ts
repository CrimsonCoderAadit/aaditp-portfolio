import type { Sfx } from "../sfx";
import type { Engine, GameDefinition, Input } from "../types";

/** PACKET DEFENDER: an original stationary defence game. A network node sits
 * at the centre; corrupted packets come in along six routes, in waves. The
 * player turns the node's emitter and fires pulses, each costing energy that
 * recharges over time. Shooting a power cell restores energy and integrity.
 * World units centred on the node, y down. */

type Kind = "packet" | "armoured" | "fast" | "splitter" | "shard";
type Threat = { kind: Kind; route: number; r: number; hp: number; speed: number; wobble: number; angle: number; x: number; y: number };
type Pulse = { x: number; y: number; vx: number; vy: number; life: number };
type Cell = { angle: number; r: number; x: number; y: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number; colour: string };

const ROUTES = 6, SPAWN = 110, NODE = 9, EMITTER = 14;
const GREEN = "#6ef0a0", VIOLET = "#8b6bff", RED = "#ff5a6e", CYAN = "#46d6e8";
const STATS: Record<Kind, { hp: number; speed: number; damage: number; points: number; size: number; colour: string }> = {
  packet: { hp: 1, speed: 13, damage: 8, points: 10, size: 2.6, colour: RED },
  armoured: { hp: 3, speed: 8.5, damage: 16, points: 30, size: 3.6, colour: "#ff9a4a" },
  fast: { hp: 1, speed: 22, damage: 6, points: 20, size: 2.2, colour: "#ff5ad0" },
  splitter: { hp: 2, speed: 10, damage: 10, points: 25, size: 3.2, colour: "#ffd24a" },
  shard: { hp: 1, speed: 16, damage: 4, points: 5, size: 1.6, colour: "#ffd24a" },
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function create(sfx: Sfx): Engine {
  const threats: Threat[] = [], pulses: Pulse[] = [], cells: Cell[] = [], sparks: Spark[] = [];
  const state = { aim: -Math.PI / 2, energy: 12, integrity: 100, score: 0, wave: 0, queue: [] as Kind[], spawnClock: 0, pause: 1.6, cooldown: 0, over: false, time: 0, spin: 0, banner: 0, hitFlash: 0, scale: 1, cx: 0, cy: 0, px: NaN, py: NaN };
  const routeAngle = (route: number) => route / ROUTES * Math.PI * 2 + state.spin;

  const nextWave = () => {
    state.wave++;
    const n = 6 + state.wave * 3;
    state.queue = Array.from({ length: n }, (_, i) => {
      const roll = Math.random();
      if (state.wave >= 4 && roll < .15) return "splitter";
      if (state.wave >= 2 && roll < .32) return "fast";
      if (state.wave >= 3 && roll < .5 && i % 3 === 0) return "armoured";
      return "packet";
    });
    state.banner = 1.8;
    sfx.play("wave");
  };
  const spawn = (kind: Kind, route: number, r = SPAWN) => {
    const stat = STATS[kind];
    threats.push({ kind, route, r, hp: stat.hp, speed: stat.speed * (1 + state.wave * .04), wobble: rand(0, 6), angle: routeAngle(route), x: 0, y: 0 });
  };
  const burst = (x: number, y: number, colour: string, count = 10) => {
    for (let i = 0; i < count; i++) { const a = rand(0, Math.PI * 2), v = rand(10, 34); sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(.3, .6), colour }); }
  };

  const fire = () => {
    if (state.cooldown > 0 || state.energy < 1) return;
    state.energy -= 1; state.cooldown = .15;
    pulses.push({ x: Math.cos(state.aim) * EMITTER, y: Math.sin(state.aim) * EMITTER, vx: Math.cos(state.aim) * 130, vy: Math.sin(state.aim) * 130, life: 1 });
    sfx.play("fire");
  };

  const update = (dt: number, input: Input) => {
    if (state.over) return;
    state.time += dt;
    state.spin += dt * .03 * Math.min(4, state.wave);
    state.cooldown -= dt; state.banner -= dt; state.hitFlash = Math.max(0, state.hitFlash - dt);
    state.energy = Math.min(12, state.energy + 1.7 * dt);
    // The pointer aims when it moves or presses; otherwise the keys turn the emitter.
    const { pointer } = input;
    if (pointer.active && (pointer.hit || pointer.x !== state.px || pointer.y !== state.py)) {
      state.aim = Math.atan2(pointer.y - state.cy, pointer.x - state.cx);
      state.px = pointer.x; state.py = pointer.y;
    }
    state.aim += ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * 3.4 * dt;
    if (input.actionHit || input.pointer.hit || ((input.action || input.pointer.down) && state.cooldown <= 0)) fire();

    if (!state.queue.length && !threats.length) {
      state.pause -= dt;
      if (state.pause <= 0) { if (state.wave > 0) { state.score += state.wave * 50; } nextWave(); state.pause = 2.2; }
    } else if (state.queue.length) {
      state.spawnClock -= dt;
      if (state.spawnClock <= 0) { spawn(state.queue.shift()!, Math.floor(Math.random() * ROUTES)); state.spawnClock = Math.max(.35, 1.3 - state.wave * .08); }
    }
    if (Math.random() < dt * .09 && cells.length < 1) cells.push({ angle: rand(0, Math.PI * 2), r: SPAWN, x: 0, y: 0 });

    for (const t of threats) {
      t.r -= t.speed * dt;
      const sway = t.kind === "fast" ? Math.sin(t.r * .15 + t.wobble) * .16 : Math.sin(t.r * .05 + t.wobble) * .03;
      t.angle = routeAngle(t.route) + sway;
      t.x = Math.cos(t.angle) * t.r; t.y = Math.sin(t.angle) * t.r;
      if (t.r <= NODE + 2) {
        t.hp = 0; t.r = -1;
        state.integrity -= STATS[t.kind].damage;
        state.hitFlash = .3;
        burst(t.x, t.y, RED, 14);
        sfx.play("hit");
      }
    }
    for (const c of cells) { c.r -= 7 * dt; c.x = Math.cos(c.angle) * c.r; c.y = Math.sin(c.angle) * c.r; }
    for (const p of pulses) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      for (const t of threats) {
        if (t.hp <= 0) continue;
        if ((t.x - p.x) ** 2 + (t.y - p.y) ** 2 < (STATS[t.kind].size + 1.4) ** 2) {
          t.hp--; p.life = 0;
          if (t.hp <= 0) {
            state.score += STATS[t.kind].points;
            burst(t.x, t.y, STATS[t.kind].colour);
            sfx.play("burst");
            if (t.kind === "splitter") for (const offset of [-1, 1]) { spawn("shard", t.route, t.r); threats[threats.length - 1].wobble = offset * 2; }
          } else burst(t.x, t.y, "#ffffff", 4);
          break;
        }
      }
      for (const c of cells) {
        if (p.life > 0 && (c.x - p.x) ** 2 + (c.y - p.y) ** 2 < 16) {
          c.r = -1; p.life = 0;
          state.energy = Math.min(12, state.energy + 6);
          state.integrity = Math.min(100, state.integrity + 8);
          burst(c.x, c.y, GREEN, 16);
          sfx.play("pickup");
        }
      }
    }
    for (let k = threats.length - 1; k >= 0; k--) if (threats[k].hp <= 0) threats.splice(k, 1);
    for (let k = pulses.length - 1; k >= 0; k--) if (pulses[k].life <= 0 || Math.hypot(pulses[k].x, pulses[k].y) > SPAWN + 10) pulses.splice(k, 1);
    for (let k = cells.length - 1; k >= 0; k--) if (cells[k].r < NODE) cells.splice(k, 1);
    for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; s.vx *= 1 - 3 * dt; s.vy *= 1 - 3 * dt; }
    for (let k = sparks.length - 1; k >= 0; k--) if (sparks[k].life <= 0) sparks.splice(k, 1);
    if (state.integrity <= 0) { state.integrity = 0; state.over = true; }
  };

  const render = (c: CanvasRenderingContext2D, w: number, h: number) => {
    state.scale = Math.min(w, h) / (SPAWN * 2 + 24);
    state.cx = w / 2; state.cy = h / 2 + (w < h ? 0 : 10);
    const g = c.createRadialGradient(state.cx, state.cy, 0, state.cx, state.cy, Math.max(w, h) * .7);
    g.addColorStop(0, "#10121c"); g.addColorStop(1, "#05060a");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.save(); c.translate(state.cx, state.cy); c.scale(state.scale, state.scale);

    c.lineWidth = .5;
    for (const r of [30, 55, 80, 105]) { c.strokeStyle = "rgba(139,107,255,.13)"; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); }
    for (let route = 0; route < ROUTES; route++) {
      const a = routeAngle(route);
      c.strokeStyle = "rgba(70,214,232,.16)"; c.setLineDash([3, 4]);
      c.beginPath(); c.moveTo(Math.cos(a) * (NODE + 4), Math.sin(a) * (NODE + 4)); c.lineTo(Math.cos(a) * SPAWN, Math.sin(a) * SPAWN); c.stroke();
      c.setLineDash([]);
      c.fillStyle = "rgba(70,214,232,.4)"; c.beginPath(); c.arc(Math.cos(a) * SPAWN, Math.sin(a) * SPAWN, 2, 0, Math.PI * 2); c.fill();
    }

    for (const cell of cells) {
      c.save(); c.translate(cell.x, cell.y); c.shadowColor = GREEN; c.shadowBlur = 12;
      c.strokeStyle = GREEN; c.lineWidth = .8; c.strokeRect(-2.4, -3.2, 4.8, 6.4);
      c.fillStyle = GREEN; c.fillRect(-1.6, -2.4 + 4.8 * (1 - ((state.time * 2) % 1)), 3.2, 4.8 * ((state.time * 2) % 1));
      c.restore();
    }
    for (const t of threats) {
      const stat = STATS[t.kind];
      c.save(); c.translate(t.x, t.y); c.rotate(t.angle + Math.PI / 4 + state.time * (t.kind === "fast" ? 6 : 1.5));
      c.shadowColor = stat.colour; c.shadowBlur = 10;
      c.fillStyle = stat.colour;
      c.fillRect(-stat.size / 2, -stat.size / 2, stat.size, stat.size);
      if (t.kind === "armoured") { c.strokeStyle = "#fff"; c.lineWidth = .5; c.strokeRect(-stat.size / 2 - 1, -stat.size / 2 - 1, stat.size + 2, stat.size + 2); }
      c.restore();
    }
    c.globalCompositeOperation = "lighter";
    for (const p of pulses) {
      c.strokeStyle = CYAN; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * .03, p.y - p.vy * .03); c.stroke();
    }
    for (const s of sparks) { c.globalAlpha = Math.max(0, s.life * 2); c.fillStyle = s.colour; c.fillRect(s.x - .5, s.y - .5, 1, 1); }
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";

    // The node: a core, its integrity ring and the emitter.
    const health = state.integrity / 100;
    c.strokeStyle = "rgba(255,255,255,.1)"; c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, NODE + 2, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = health > .5 ? GREEN : health > .25 ? "#ffd24a" : RED;
    c.beginPath(); c.arc(0, 0, NODE + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * health); c.stroke();
    const core = c.createRadialGradient(0, 0, 0, 0, 0, NODE);
    core.addColorStop(0, "#f2eeff"); core.addColorStop(.35, VIOLET); core.addColorStop(1, "#231a4a");
    c.fillStyle = core; c.beginPath(); c.arc(0, 0, NODE * (.9 + Math.sin(state.time * 4) * .03), 0, Math.PI * 2); c.fill();
    c.save(); c.rotate(state.aim);
    c.fillStyle = "#dfe6ee"; c.beginPath(); c.moveTo(EMITTER + 3, 0); c.lineTo(EMITTER - 2, -2.6); c.lineTo(EMITTER - 2, 2.6); c.fill();
    c.strokeStyle = "rgba(70,214,232,.25)"; c.setLineDash([2, 5]); c.lineWidth = .5;
    c.beginPath(); c.moveTo(EMITTER + 4, 0); c.lineTo(SPAWN, 0); c.stroke(); c.setLineDash([]);
    c.restore();
    // Energy: twelve segments round the emitter orbit.
    for (let i = 0; i < 12; i++) {
      const a0 = -Math.PI / 2 + i / 12 * Math.PI * 2 + .04, a1 = a0 + Math.PI * 2 / 12 - .08;
      c.strokeStyle = i < Math.floor(state.energy) ? CYAN : "rgba(70,214,232,.15)"; c.lineWidth = 1.2;
      c.beginPath(); c.arc(0, 0, EMITTER + 6, a0, a1); c.stroke();
    }
    c.restore();

    if (state.banner > 0 && state.wave > 0) {
      c.globalAlpha = Math.min(1, state.banner);
      c.fillStyle = "#e9ecef"; c.font = `700 ${Math.max(18, Math.min(w, h) * .05)}px ui-monospace, monospace`; c.textAlign = "center";
      c.fillText(`WAVE ${state.wave}`, w / 2, state.cy - Math.min(w, h) * .28);
      c.globalAlpha = 1;
    }
    if (state.hitFlash > 0) { c.fillStyle = `rgba(255,90,110,${state.hitFlash * .4})`; c.fillRect(0, 0, w, h); }
  };

  return {
    update, render,
    get score() { return state.score; },
    get over() { return state.over; },
    hud: () => [["Wave", String(state.wave)], ["Integrity", `${Math.ceil(state.integrity)}%`], ["Energy", String(Math.floor(state.energy))]],
  };
}

export const PACKET_DEFENDER: GameDefinition = {
  id: "packet-defender",
  title: "PACKET DEFENDER",
  howTo: [
    "Protect the node at the centre from corrupted packets arriving in waves.",
    "Each pulse costs energy, which recharges. Shoot green power cells to restore energy and integrity.",
    "Aim with the pointer and click, or tap where you want to fire.",
    "← → / A D turn · Space fire · P pause",
  ],
  touch: "aim",
  bestKey: "aadit-packet-defender-best",
  create,
};
