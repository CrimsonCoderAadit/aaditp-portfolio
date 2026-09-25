import type { Sfx } from "../sfx";
import type { Engine, GameDefinition, Input } from "../types";

/** NIGHT CIRCUIT: an original top-down night drive. The streets are a graph:
 * a lattice of junctions with some links removed, never leaving a junction
 * with fewer than two roads and never splitting the network, so every road is
 * reachable and there are no dead ends. Bends between junctions become filleted
 * curves. The car, traffic, collisions and beacons all use the same road
 * centre-lines, so what is drawn is exactly what can be driven. World units,
 * y down, headings in radians clockwise from +x. */

type P = { x: number; y: number };
type Road = { points: P[]; lengths: number[]; length: number; from: number; to: number };
type Car = { road: number; s: number; dir: 1 | -1; speed: number; cruise: number; colour: string; x: number; y: number; heading: number };
type Obstacle = { x: number; y: number; kind: "cone" | "barrier"; vx: number; vy: number; spin: number; angle: number; knocked: number };
type Float = { x: number; y: number; text: string; life: number; colour: string };

const N = 6, SPACING = 12, ROAD = 4.4, HALF = ROAD / 2, BEND = 4.2, EXTENT = (N - 1) * SPACING, MARGIN = 16;
const CAR_RADIUS = .72, PX = 18;
const BEACON = "#6ef0a0", VIOLET = "#8b6bff", CYAN = "#46d6e8";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

/** Lattice links, thinned while every junction keeps two roads and the whole
 * network stays connected. */
function network() {
  const id = (i: number, j: number) => j * N + i;
  const links: [number, number][] = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (i < N - 1) links.push([id(i, j), id(i + 1, j)]);
    if (j < N - 1) links.push([id(i, j), id(i, j + 1)]);
  }
  const alive = links.map(() => true);
  const degree = new Array(N * N).fill(0);
  links.forEach(([a, b]) => { degree[a]++; degree[b]++; });
  const connected = () => {
    const seen = new Set([0]), queue = [0];
    while (queue.length) {
      const node = queue.pop()!;
      links.forEach(([a, b], k) => {
        if (!alive[k] || (a !== node && b !== node)) return;
        const other = a === node ? b : a;
        if (!seen.has(other)) { seen.add(other); queue.push(other); }
      });
    }
    return seen.size === N * N;
  };
  const order = links.map((_, k) => k).sort(() => Math.random() - .5);
  let removed = 0;
  for (const k of order) {
    if (removed >= links.length * .2) break;
    const [a, b] = links[k];
    if (degree[a] <= 2 || degree[b] <= 2) continue;
    alive[k] = false;
    if (connected()) { degree[a]--; degree[b]--; removed++; } else alive[k] = true;
  }
  const node = (n: number): P => ({ x: (n % N) * SPACING, y: Math.floor(n / N) * SPACING });
  const neighbours = Array.from({ length: N * N }, () => [] as number[]);
  links.forEach(([a, b], k) => { if (alive[k]) { neighbours[a].push(b); neighbours[b].push(a); } });
  return { node, neighbours };
}

/** Roads between junctions: chains of links through two-way corners, with
 * each bend replaced by a quadratic fillet. */
function buildRoads() {
  const { node, neighbours } = network();
  const junction = neighbours.map((list) => list.length !== 2);
  if (!junction.some(Boolean)) junction[0] = true;
  const walked = new Set<string>();
  const key = (a: number, b: number) => a < b ? `${a}-${b}` : `${b}-${a}`;
  const roads: Road[] = [];
  neighbours.forEach((list, start) => {
    if (!junction[start]) return;
    for (const first of list) {
      if (walked.has(key(start, first))) continue;
      const chain = [start, first];
      walked.add(key(start, first));
      let previous = start, current = first;
      while (!junction[current]) {
        const next = neighbours[current].find((n) => n !== previous)!;
        walked.add(key(current, next));
        chain.push(next);
        previous = current; current = next;
      }
      const points: P[] = [node(chain[0])];
      for (let k = 1; k < chain.length - 1; k++) {
        const a = node(chain[k - 1]), b = node(chain[k]), c = node(chain[k + 1]);
        const inX = Math.sign(b.x - a.x), inY = Math.sign(b.y - a.y), outX = Math.sign(c.x - b.x), outY = Math.sign(c.y - b.y);
        if (inX === outX && inY === outY) continue;
        const p0 = { x: b.x - inX * BEND, y: b.y - inY * BEND }, p2 = { x: b.x + outX * BEND, y: b.y + outY * BEND };
        for (let t = 0; t <= 1.0001; t += 1 / 8) {
          const u = 1 - t;
          points.push({ x: u * u * p0.x + 2 * u * t * b.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * b.y + t * t * p2.y });
        }
      }
      points.push(node(current));
      const lengths = [0];
      for (let k = 1; k < points.length; k++) lengths.push(lengths[k - 1] + Math.hypot(points[k].x - points[k - 1].x, points[k].y - points[k - 1].y));
      roads.push({ points, lengths, length: lengths[lengths.length - 1], from: chain[0], to: current });
    }
  });
  const junctions = neighbours.map((_, n) => junction[n] ? node(n) : null);
  const exits = new Map<number, { road: number; atStart: boolean }[]>();
  roads.forEach((road, r) => {
    for (const [end, atStart] of [[road.from, true], [road.to, false]] as const) {
      if (!exits.has(end)) exits.set(end, []);
      exits.get(end)!.push({ road: r, atStart });
    }
  });
  return { roads, junctions, exits };
}

/** Point and direction a distance `s` along a road. */
function along(road: Road, s: number) {
  const target = Math.max(0, Math.min(road.length, s));
  let k = 1;
  while (k < road.lengths.length - 1 && road.lengths[k] < target) k++;
  const a = road.points[k - 1], b = road.points[k];
  const span = road.lengths[k] - road.lengths[k - 1] || 1, t = (target - road.lengths[k - 1]) / span;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, heading: Math.atan2(b.y - a.y, b.x - a.x) };
}

function nearestOnRoads(roads: Road[], x: number, y: number) {
  let best = Infinity, bx = x, by = y;
  for (const road of roads) {
    const points = road.points;
    for (let k = 1; k < points.length; k++) {
      const a = points[k - 1], b = points[k];
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const px = a.x + dx * t, py = a.y + dy * t, d = (x - px) ** 2 + (y - py) ** 2;
      if (d < best) { best = d; bx = px; by = py; }
    }
  }
  return { x: bx, y: by, distance: Math.sqrt(best) };
}

/** The city drawn once: blocks of lit buildings and small parks, then the
 * streets over them, with kerbs, lane markings and street lamps. */
function paintCity(roads: Road[], junctions: (P | null)[]) {
  const size = (EXTENT + 2 * MARGIN) * PX;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d")!;
  c.setTransform(PX, 0, 0, PX, MARGIN * PX, MARGIN * PX);
  c.fillStyle = "#07080d"; c.fillRect(-MARGIN, -MARGIN, EXTENT + 2 * MARGIN, EXTENT + 2 * MARGIN);
  const tints = ["#8b6bff", "#46d6e8", "#f0b35a", "#6ef0a0"];
  for (let x = -MARGIN; x < EXTENT + MARGIN; x += 3) for (let y = -MARGIN; y < EXTENT + MARGIN; y += 3) {
    if (Math.random() < .12) {
      c.fillStyle = "#0d1a14"; c.fillRect(x + .2, y + .2, 2.6, 2.6);
      c.fillStyle = "#18402b";
      for (let t = 0; t < 3; t++) { c.beginPath(); c.arc(x + rand(.7, 2.3), y + rand(.7, 2.3), rand(.3, .5), 0, Math.PI * 2); c.fill(); }
      continue;
    }
    const shade = Math.floor(rand(16, 30));
    c.fillStyle = `rgb(${shade},${shade + 2},${shade + 10})`; c.fillRect(x + .15, y + .15, 2.7, 2.7);
    c.fillStyle = `rgb(${shade + 8},${shade + 10},${shade + 20})`; c.fillRect(x + .15, y + .15, 2.7, .25);
    const tint = pick(tints);
    for (let wx = .5; wx < 2.7; wx += .55) for (let wy = .6; wy < 2.7; wy += .55) {
      if (Math.random() < .28) { c.fillStyle = tint; c.globalAlpha = rand(.35, .8); c.fillRect(x + wx, y + wy, .22, .22); c.globalAlpha = 1; }
    }
  }
  const stroke = (width: number, colour: string, dash: number[] = []) => {
    c.lineWidth = width; c.strokeStyle = colour; c.setLineDash(dash); c.lineCap = "round"; c.lineJoin = "round";
    for (const road of roads) { c.beginPath(); road.points.forEach((p, k) => (k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.stroke(); }
    c.setLineDash([]);
  };
  stroke(ROAD + 1.3, "#1a1f2b");
  stroke(ROAD, "#343a48");
  stroke(ROAD - .3, "#1e222c");
  stroke(.14, "rgba(236,222,140,.5)", [1.3, 1.5]);
  for (const j of junctions) if (j) {
    c.fillStyle = "#1e222c"; c.beginPath(); c.arc(j.x, j.y, HALF - .15, 0, Math.PI * 2); c.fill();
  }
  c.globalCompositeOperation = "lighter";
  const lamp = (x: number, y: number, colour: string) => {
    const glow = c.createRadialGradient(x, y, 0, x, y, 3.2);
    glow.addColorStop(0, colour + "55"); glow.addColorStop(1, colour + "00");
    c.fillStyle = glow; c.beginPath(); c.arc(x, y, 3.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#fff6"; c.beginPath(); c.arc(x, y, .18, 0, Math.PI * 2); c.fill();
  };
  junctions.forEach((j, k) => { if (j) lamp(j.x + HALF + .5, j.y - HALF - .5, k % 2 ? VIOLET : CYAN); });
  for (const road of roads) for (let s = 6; s < road.length - 4; s += 9) {
    const p = along(road, s), nx = -Math.sin(p.heading), ny = Math.cos(p.heading);
    lamp(p.x + nx * (HALF + .5), p.y + ny * (HALF + .5), "#f0c070");
  }
  c.globalCompositeOperation = "source-over";
  return canvas;
}

function create(sfx: Sfx): Engine {
  const { roads, junctions, exits } = buildRoads();
  const city = paintCity(roads, junctions);
  const startRoad = roads.reduce((longest, road) => (road.length > longest.length ? road : longest), roads[0]);
  const start = along(startRoad, startRoad.length / 2);
  const car = { x: start.x, y: start.y, heading: start.heading, vx: 0, vy: 0, bump: 0, hurt: 0 };
  const camera = { x: car.x, y: car.y, shake: 0 };
  const traffic: Car[] = [];
  const obstacles: Obstacle[] = [];
  const floats: Float[] = [];
  const skids: { x: number; y: number; life: number }[] = [];
  const beacon = { x: 0, y: 0, pulse: 0 };
  const state = { score: 0, time: 40, beacons: 0, level: 1, combo: 0, sinceBeacon: 0, over: false, clock: 0 };

  const placeBeacon = () => {
    for (let tries = 0; tries < 60; tries++) {
      const road = pick(roads), p = along(road, rand(.2, .8) * road.length);
      if (Math.hypot(p.x - car.x, p.y - car.y) > 18 || tries > 50) { beacon.x = p.x; beacon.y = p.y; return; }
    }
  };
  const addTraffic = () => {
    const r = Math.floor(Math.random() * roads.length), road = roads[r];
    const s = rand(.1, .9) * road.length, p = along(road, s);
    if (Math.hypot(p.x - car.x, p.y - car.y) < 14) return;
    const cruise = rand(4.5, 6) + state.level * .5;
    traffic.push({ road: r, s, dir: Math.random() < .5 ? 1 : -1, speed: cruise, cruise, colour: pick(["#c9ced6", "#d35a4a", "#e0b04a", "#4a7bd3", "#5b6270"]), x: p.x, y: p.y, heading: p.heading });
  };
  // Road works: cones and barrier drums on one lane of a road's middle
  // stretch, never across both lanes and never at a junction.
  for (let k = 0; k < 10; k++) {
    const road = pick(roads);
    if (road.length < 10) continue;
    const p = along(road, rand(.3, .7) * road.length), side = Math.random() < .5 ? 1 : -1;
    const nx = -Math.sin(p.heading) * side, ny = Math.cos(p.heading) * side;
    const kind = k % 3 === 0 ? "barrier" : "cone";
    for (let n = 0; n < (kind === "cone" ? 3 : 1); n++) {
      const t = (n - 1) * 1.1;
      obstacles.push({ x: p.x + nx * HALF * .5 + Math.cos(p.heading) * t, y: p.y + ny * HALF * .5 + Math.sin(p.heading) * t, kind, vx: 0, vy: 0, spin: 0, angle: p.heading, knocked: 0 });
    }
  }
  placeBeacon();
  for (let k = 0; k < 4; k++) addTraffic();

  const float = (x: number, y: number, text: string, colour: string) => floats.push({ x, y, text, life: 1.1, colour });

  const update = (dt: number, input: Input) => {
    if (state.over) return;
    state.clock += dt;
    state.time -= dt;
    state.sinceBeacon += dt;
    const top = 16.5 + state.level * .8;
    const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
    let forward = car.vx * cos + car.vy * sin;
    let sideX = car.vx - cos * forward, sideY = car.vy - sin * forward;
    if (input.up) forward += (forward < 0 ? 26 : 13) * dt;
    else if (input.down) forward -= (forward > .5 ? 24 : 8) * dt;
    else forward *= 1 - .7 * dt;
    forward = Math.max(-6, Math.min(top, forward));
    const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const drifting = input.action && Math.abs(forward) > 6;
    car.heading += steer * (drifting ? 3.1 : 2.5) * dt * Math.max(-1, Math.min(1, forward / 6));
    const grip = drifting ? 1.8 : 10;
    sideX *= Math.exp(-grip * dt); sideY *= Math.exp(-grip * dt);
    if (drifting) forward *= 1 - .25 * dt;
    car.vx = Math.cos(car.heading) * forward + sideX;
    car.vy = Math.sin(car.heading) * forward + sideY;
    car.x += car.vx * dt; car.y += car.vy * dt;
    if (drifting || Math.hypot(sideX, sideY) > 3) skids.push({ x: car.x, y: car.y, life: 1.6 });

    // Kerbs: the car stays within the union of the road bands.
    const near = nearestOnRoads(roads, car.x, car.y), limit = HALF - CAR_RADIUS * .55;
    if (near.distance > limit) {
      const nx = (car.x - near.x) / near.distance, ny = (car.y - near.y) / near.distance;
      car.x = near.x + nx * limit; car.y = near.y + ny * limit;
      const into = car.vx * nx + car.vy * ny;
      if (into > 0) {
        car.vx -= nx * into * 1.35; car.vy -= ny * into * 1.35;
        car.vx *= .96; car.vy *= .96;
        if (into > 4 && car.bump <= 0) { sfx.play("bump"); camera.shake = Math.min(.5, into * .04); car.bump = .25; }
      }
    }
    car.bump -= dt; car.hurt -= dt;

    // Traffic keeps to its lane and takes a different road at each junction.
    const wanted = Math.min(12, 3 + Math.floor(state.level * 1.5));
    if (traffic.length < wanted && Math.random() < dt) addTraffic();
    for (const other of traffic) {
      const road = roads[other.road];
      // Drivers brake for the player's car when it is ahead of them.
      const ahead = (car.x - other.x) * Math.cos(other.heading) + (car.y - other.y) * Math.sin(other.heading);
      const blocking = ahead > 0 && ahead < 4.5 && Math.hypot(car.x - other.x, car.y - other.y) < 4.6;
      other.speed += ((blocking ? 0 : other.cruise) - other.speed) * Math.min(1, dt * (blocking ? 6 : 1.5));
      other.s += other.dir * other.speed * dt;
      if (other.s < 0 || other.s > road.length) {
        const end = other.s > road.length ? road.to : road.from;
        const options = (exits.get(end) ?? []).filter((exit) => exit.road !== other.road);
        const next = options.length ? pick(options) : { road: other.road, atStart: other.s > road.length ? false : true };
        other.road = next.road;
        other.dir = next.atStart ? 1 : -1;
        other.s = next.atStart ? 0 : roads[next.road].length;
      }
      const p = along(roads[other.road], other.s);
      const heading = other.dir > 0 ? p.heading : p.heading + Math.PI;
      other.heading = heading;
      other.x = p.x - Math.sin(heading) * HALF * .45;
      other.y = p.y + Math.cos(heading) * HALF * .45;
      const dx = car.x - other.x, dy = car.y - other.y, d = Math.hypot(dx, dy);
      if (d < 1.55 && d > 0) {
        const nx = dx / d, ny = dy / d;
        car.x = other.x + nx * 1.55; car.y = other.y + ny * 1.55;
        const into = -(car.vx * nx + car.vy * ny);
        if (into > 0) { car.vx += nx * into * 1.4; car.vy += ny * into * 1.4; }
        car.vx *= .6; car.vy *= .6;
        if (car.hurt <= 0) {
          state.time -= 2; state.combo = 0; car.hurt = 1.6;
          camera.shake = .6; sfx.play("hit"); float(car.x, car.y - 1.5, "−2s", "#ff7a6b");
        }
      }
    }

    for (const o of obstacles) {
      if (o.knocked > 0) {
        o.knocked -= dt; o.x += o.vx * dt; o.y += o.vy * dt; o.angle += o.spin * dt;
        o.vx *= 1 - 2.5 * dt; o.vy *= 1 - 2.5 * dt;
        continue;
      }
      const reach = o.kind === "cone" ? 1.05 : 1.35;
      const dx = car.x - o.x, dy = car.y - o.y, d = Math.hypot(dx, dy);
      if (d >= reach || d === 0) continue;
      if (o.kind === "cone") {
        o.knocked = 1.4; o.vx = car.vx * 1.2 + rand(-3, 3); o.vy = car.vy * 1.2 + rand(-3, 3); o.spin = rand(-12, 12);
        car.vx *= .86; car.vy *= .86; sfx.play("bump");
      } else {
        const nx = dx / d, ny = dy / d;
        car.x = o.x + nx * reach; car.y = o.y + ny * reach;
        const into = -(car.vx * nx + car.vy * ny);
        if (into > 0) { car.vx += nx * into * 1.3; car.vy += ny * into * 1.3; }
        car.vx *= .7; car.vy *= .7;
        if (car.bump <= 0) { sfx.play("bump"); camera.shake = .3; car.bump = .3; }
      }
    }

    beacon.pulse += dt;
    if (Math.hypot(car.x - beacon.x, car.y - beacon.y) < 2.4) {
      state.combo = state.sinceBeacon < 7 ? state.combo + 1 : 0;
      const speed = Math.hypot(car.vx, car.vy);
      const points = Math.round((100 + state.level * 25 + speed * 4) * (1 + state.combo * .25));
      state.score += points;
      state.beacons++;
      state.level = 1 + Math.floor(state.beacons / 4);
      const bonus = Math.max(3.2, 7 - state.level * .5);
      state.time += bonus;
      state.sinceBeacon = 0;
      float(beacon.x, beacon.y - 1.2, `+${points}  +${bonus.toFixed(1)}s`, BEACON);
      sfx.play("checkpoint");
      placeBeacon();
    }

    for (const f of floats) { f.life -= dt; f.y -= dt * 1.2; }
    for (let k = floats.length - 1; k >= 0; k--) if (floats[k].life <= 0) floats.splice(k, 1);
    for (const mark of skids) mark.life -= dt;
    while (skids.length && (skids[0].life <= 0 || skids.length > 220)) skids.shift();

    const lead = .32;
    camera.x += (car.x + car.vx * lead - camera.x) * Math.min(1, dt * 5);
    camera.y += (car.y + car.vy * lead - camera.y) * Math.min(1, dt * 5);
    camera.shake = Math.max(0, camera.shake - dt * 1.8);
    if (state.time <= 0) { state.time = 0; state.over = true; }
  };

  const drawCar = (c: CanvasRenderingContext2D, x: number, y: number, heading: number, body: string, player: boolean) => {
    c.save(); c.translate(x, y); c.rotate(heading);
    if (player) {
      c.globalCompositeOperation = "lighter";
      const beam = c.createLinearGradient(1, 0, 8, 0);
      beam.addColorStop(0, "rgba(255,244,200,.32)"); beam.addColorStop(1, "rgba(255,244,200,0)");
      c.fillStyle = beam; c.beginPath(); c.moveTo(1, -.35); c.lineTo(8, -2.4); c.lineTo(8, 2.4); c.lineTo(1, .35); c.fill();
      c.globalCompositeOperation = "source-over";
    }
    c.fillStyle = "rgba(0,0,0,.45)"; c.fillRect(-1.05, -.52, 2.2, 1.14);
    c.fillStyle = body; c.beginPath(); c.roundRect(-1.0, -.52, 2.0, 1.04, .28); c.fill();
    c.fillStyle = "#0b0d14"; c.fillRect(.1, -.4, .5, .8); c.fillRect(-.7, -.38, .4, .76);
    if (player) { c.fillStyle = CYAN; c.fillRect(-1, -.08, 2, .16); }
    c.fillStyle = "#ffe9b0"; c.fillRect(.9, -.42, .12, .2); c.fillRect(.9, .22, .12, .2);
    c.fillStyle = "#ff4a4a"; c.fillRect(-1.02, -.42, .1, .2); c.fillRect(-1.02, .22, .1, .2);
    c.restore();
  };

  const render = (c: CanvasRenderingContext2D, w: number, h: number) => {
    c.fillStyle = "#05060a"; c.fillRect(0, 0, w, h);
    const scale = Math.min(w, h) / 30;
    const shakeX = (Math.random() - .5) * camera.shake, shakeY = (Math.random() - .5) * camera.shake;
    c.save();
    c.translate(w / 2, h / 2); c.scale(scale, scale); c.translate(-camera.x + shakeX, -camera.y + shakeY);
    c.imageSmoothingEnabled = true;
    c.drawImage(city, -MARGIN, -MARGIN, EXTENT + 2 * MARGIN, EXTENT + 2 * MARGIN);
    c.fillStyle = "rgba(0,0,0,.5)";
    for (const mark of skids) { c.globalAlpha = Math.min(1, mark.life) * .5; c.fillRect(mark.x - .12, mark.y - .12, .24, .24); }
    c.globalAlpha = 1;

    // Beacon: a pulsing ring and a soft column of light.
    const pulse = (Math.sin(beacon.pulse * 5) + 1) / 2;
    c.globalCompositeOperation = "lighter";
    const glow = c.createRadialGradient(beacon.x, beacon.y, 0, beacon.x, beacon.y, 4);
    glow.addColorStop(0, "rgba(110,240,160,.55)"); glow.addColorStop(1, "rgba(110,240,160,0)");
    c.fillStyle = glow; c.beginPath(); c.arc(beacon.x, beacon.y, 4, 0, Math.PI * 2); c.fill();
    c.globalCompositeOperation = "source-over";
    c.strokeStyle = BEACON; c.lineWidth = .18;
    c.beginPath(); c.arc(beacon.x, beacon.y, 1.4 + pulse * .6, 0, Math.PI * 2); c.stroke();
    c.fillStyle = BEACON; c.beginPath(); c.moveTo(beacon.x, beacon.y - .7); c.lineTo(beacon.x + .5, beacon.y); c.lineTo(beacon.x, beacon.y + .7); c.lineTo(beacon.x - .5, beacon.y); c.fill();

    for (const o of obstacles) {
      if (o.kind === "cone" && o.knocked <= 0 && o.vx !== 0) continue;
      c.save(); c.translate(o.x, o.y); c.rotate(o.angle);
      c.globalAlpha = o.knocked > 0 ? Math.min(1, o.knocked) : 1;
      if (o.kind === "cone") {
        c.fillStyle = "#f07a2a"; c.beginPath(); c.arc(0, 0, .34, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#fff"; c.beginPath(); c.arc(0, 0, .15, 0, Math.PI * 2); c.fill();
      } else {
        c.fillStyle = "#e8e3d5"; c.fillRect(-.35, -1.05, .7, 2.1);
        c.fillStyle = "#e0572e"; for (let k = -1; k <= .6; k += .7) c.fillRect(-.35, k, .7, .32);
        c.fillStyle = "#ffcc55"; c.beginPath(); c.arc(0, -1.05, .14, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
    c.globalAlpha = 1;
    for (const other of traffic) drawCar(c, other.x, other.y, other.heading, other.colour, false);
    if (car.hurt <= 0 || Math.floor(car.hurt * 12) % 2 === 0) drawCar(c, car.x, car.y, car.heading, VIOLET, true);

    c.font = "600 .8px ui-monospace, monospace"; c.textAlign = "center";
    for (const f of floats) { c.globalAlpha = Math.min(1, f.life * 1.5); c.fillStyle = f.colour; c.fillText(f.text, f.x, f.y); }
    c.globalAlpha = 1;
    c.restore();

    // Off-screen beacon: an arrow on the frame's edge.
    const bx = (beacon.x - camera.x) * scale + w / 2, by = (beacon.y - camera.y) * scale + h / 2;
    if (bx < 0 || bx > w || by < 0 || by > h) {
      const angle = Math.atan2(by - h / 2, bx - w / 2);
      const edge = Math.min((w / 2 - 34) / Math.abs(Math.cos(angle) || 1e-6), (h / 2 - 34) / Math.abs(Math.sin(angle) || 1e-6));
      c.save(); c.translate(w / 2 + Math.cos(angle) * edge, h / 2 + Math.sin(angle) * edge); c.rotate(angle);
      c.fillStyle = BEACON; c.beginPath(); c.moveTo(12, 0); c.lineTo(-7, -8); c.lineTo(-3, 0); c.lineTo(-7, 8); c.fill();
      c.restore();
    }
    const vignette = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .35, w / 2, h / 2, Math.max(w, h) * .75);
    vignette.addColorStop(0, "rgba(0,0,0,0)"); vignette.addColorStop(1, "rgba(0,0,0,.55)");
    c.fillStyle = vignette; c.fillRect(0, 0, w, h);
  };

  return {
    update, render,
    get score() { return state.score; },
    get over() { return state.over; },
    hud: () => [["Time", state.time.toFixed(1)], ["Beacons", String(state.beacons)], ["Level", String(state.level)]],
  };
}

export const NIGHT_CIRCUIT: GameDefinition = {
  id: "night-circuit",
  title: "NIGHT CIRCUIT",
  howTo: [
    "Drive through the green data beacons before the clock runs out.",
    "Each beacon adds time; chain them quickly for a bonus.",
    "Traffic costs two seconds. Road works slow you down.",
    "W / ↑ accelerate · S / ↓ brake · A D / ← → steer · Space drift · P pause",
  ],
  touch: "drive",
  bestKey: "aadit-night-circuit-best",
  create,
};
