/** Original cover art for the library tiles, painted on canvas at tile size. */
export type CoverPainter = (c: CanvasRenderingContext2D, w: number, h: number) => void;

const glow = (c: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string) => {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, colour); g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
};

export const paintNightCircuit: CoverPainter = (c, w, h) => {
  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#120c2a"); sky.addColorStop(.55, "#1b1240"); sky.addColorStop(1, "#07060e");
  c.fillStyle = sky; c.fillRect(0, 0, w, h);
  const horizon = h * .48;
  for (let i = 0; i < 16; i++) {
    const bw = w * (.05 + (i * 37 % 7) / 70), bh = h * (.08 + (i * 53 % 9) / 40), x = (i * 97 % 100) / 100 * w;
    c.fillStyle = "#0c0a1c"; c.fillRect(x, horizon - bh, bw, bh);
    c.fillStyle = i % 3 ? "#8b6bff66" : "#46d6e866";
    for (let y = horizon - bh + 6; y < horizon - 4; y += 9) for (let wx = x + 4; wx < x + bw - 4; wx += 8) if ((wx * y) % 5 < 2) c.fillRect(wx, y, 3, 3);
  }
  c.fillStyle = "#0a0a12";
  c.beginPath(); c.moveTo(w * .46, horizon); c.lineTo(w * .54, horizon); c.lineTo(w * 1.1, h); c.lineTo(-w * .1, h); c.fill();
  c.strokeStyle = "#f0d27a"; c.lineWidth = Math.max(2, w * .012);
  for (let k = 0; k < 7; k++) {
    const t0 = k / 7, t1 = t0 + .06, y0 = horizon + (h - horizon) * t0 ** 1.6, y1 = horizon + (h - horizon) * t1 ** 1.6;
    c.beginPath(); c.moveTo(w / 2, y0); c.lineTo(w / 2, y1); c.stroke();
  }
  c.strokeStyle = "#8b6bff"; c.lineWidth = 2;
  c.beginPath(); c.moveTo(w * .46, horizon); c.lineTo(-w * .1, h); c.moveTo(w * .54, horizon); c.lineTo(w * 1.1, h); c.stroke();
  c.globalCompositeOperation = "lighter";
  glow(c, w * .38, h * .86, w * .28, "rgba(255,240,200,.45)");
  glow(c, w * .62, h * .86, w * .28, "rgba(255,240,200,.45)");
  glow(c, w * .5, horizon, w * .5, "rgba(139,107,255,.35)");
  c.globalCompositeOperation = "source-over";
};

export const paintByteClimber: CoverPainter = (c, w, h) => {
  const bg = c.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#0b0e18"); bg.addColorStop(1, "#1c0a18");
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  const tx = w * .22, tw = w * .56;
  c.fillStyle = "#121624"; c.fillRect(tx, 0, tw, h);
  for (let y = h * .12; y < h; y += h * .16) {
    c.fillStyle = "#2a3142"; c.fillRect(tx + (y % 3) * 8, y, tw * .62, h * .018);
    c.fillStyle = "#5fd08a99"; c.fillRect(tx + (y % 3) * 8, y + h * .018, tw * .62, 2);
    for (let i = 0; i < 6; i++) { c.fillStyle = (i + y) % 3 < 1 ? "#ff5a5a" : "#5fd08a"; c.fillRect(tx + tw * .7 + i * 6, y - h * .05, 3, 3); }
  }
  c.fillStyle = "#b7963c";
  const lx = tx + tw * .5;
  c.fillRect(lx, h * .44, 3, h * .16); c.fillRect(lx + 16, h * .44, 3, h * .16);
  for (let y = h * .45; y < h * .6; y += 9) c.fillRect(lx, y, 19, 2);
  c.fillStyle = "#d8dde6"; c.beginPath(); c.roundRect(lx + 1, h * .36, 18, 22, 5); c.fill();
  c.fillStyle = "#11141b"; c.fillRect(lx + 4, h * .36 + 6, 12, 6);
  c.fillStyle = "#5fd08a"; c.fillRect(lx + 10, h * .36 + 8, 4, 2);
  const tide = c.createLinearGradient(0, h * .78, 0, h);
  tide.addColorStop(0, "rgba(224,71,158,0)"); tide.addColorStop(.3, "rgba(224,71,158,.7)"); tide.addColorStop(1, "rgba(90,10,50,1)");
  c.fillStyle = tide; c.fillRect(0, h * .78, w, h * .22);
};

export const paintPacketDefender: CoverPainter = (c, w, h) => {
  c.fillStyle = "#07080f"; c.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h * .52, r = Math.min(w, h) * .42;
  c.strokeStyle = "rgba(139,107,255,.25)"; c.lineWidth = 1;
  for (const k of [.3, .55, .8, 1]) { c.beginPath(); c.arc(cx, cy, r * k, 0, Math.PI * 2); c.stroke(); }
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 - .3;
    c.strokeStyle = "rgba(70,214,232,.3)"; c.setLineDash([4, 5]);
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2); c.stroke(); c.setLineDash([]);
    const d = r * (.55 + (i % 3) * .18);
    c.fillStyle = i % 2 ? "#ff5a6e" : "#ff5ad0";
    c.save(); c.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d); c.rotate(.8); c.fillRect(-5, -5, 10, 10); c.restore();
  }
  c.globalCompositeOperation = "lighter";
  glow(c, cx, cy, r * .5, "rgba(139,107,255,.8)");
  c.globalCompositeOperation = "source-over";
  c.fillStyle = "#efeaff"; c.beginPath(); c.arc(cx, cy, r * .12, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#6ef0a0"; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, r * .18, -1.6, 3.4); c.stroke();
  c.strokeStyle = "#46d6e8"; c.lineWidth = 2;
  c.beginPath(); c.moveTo(cx + r * .2, cy - r * .08); c.lineTo(cx + r * .62, cy - r * .3); c.stroke();
};

export const paintSystemRunner: CoverPainter = (c, w, h) => {
  c.fillStyle = "#050807"; c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(95,208,138,.12)"; c.lineWidth = 1;
  for (let x = 0; x < w; x += 14) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  for (let y = 0; y < h; y += 14) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
  c.strokeStyle = "#5fd08a"; c.lineWidth = 3;
  c.beginPath(); c.moveTo(w * .1, h * .7); c.lineTo(w * .35, h * .7); c.lineTo(w * .35, h * .45); c.lineTo(w * .65, h * .45); c.lineTo(w * .65, h * .3); c.lineTo(w * .9, h * .3); c.stroke();
  c.fillStyle = "#c9ffd9"; c.fillRect(w * .62, h * .43, 8, 8);
  c.fillStyle = "#5fd08acc"; c.font = `600 ${Math.max(10, w * .05)}px ui-monospace, monospace`;
  c.fillText("> route --live", w * .1, h * .88);
};
