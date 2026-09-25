import type { ReactNode } from "react";
import type { Project, ProjectMotif } from "../content/projects";

/** A labelled technical drawing of a project's motif, drawn only when the
 * project has no real screenshot. It illustrates the idea; it never imitates
 * the product's interface. Same motif as the project's physical bay. */

const W = 480, H = 320;

function seeded(id: string) {
  let a = [...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const INK = "rgba(214,228,232,.55)", FAINT = "rgba(214,228,232,.16)";

function drawing(motif: ProjectMotif, accent: string, random: () => number): ReactNode {
  switch (motif) {
    case "graph": {
      const levels = [[240], [150, 330], [90, 190, 290, 390], [60, 120, 170, 230, 280, 350, 410]];
      const nodes = levels.flatMap((xs, row) => xs.map((x) => ({ x, y: 70 + row * 62, row })));
      const edges = nodes.filter((n) => n.row > 0).map((n) => {
        const parents = nodes.filter((p) => p.row === n.row - 1);
        const parent = parents.reduce((best, p) => Math.abs(p.x - n.x) < Math.abs(best.x - n.x) ? p : best);
        return [parent, n] as const;
      });
      return <>
        {edges.map(([a, b], i) => <path key={i} d={`M${a.x} ${a.y + 8} C${a.x} ${(a.y + b.y) / 2} ${b.x} ${(a.y + b.y) / 2} ${b.x} ${b.y - 8}`} stroke={INK} fill="none" />)}
        <path d="M60 256 C120 200 300 200 390 132" stroke={accent} strokeDasharray="3 5" fill="none" opacity=".7" />
        {nodes.map((n, i) => <rect key={i} x={n.x - 8} y={n.y - 8} width="16" height="16" fill={i === 0 ? accent : "#0c1014"} stroke={i === 0 ? accent : INK} />)}
      </>;
    }
    case "lens": {
      const points = Array.from({ length: 70 }, () => { const a = random() * Math.PI * 2, r = Math.sqrt(random()) * 70; return [240 + Math.cos(a) * r * 1.3, 160 + Math.sin(a) * r * .8]; });
      const outliers = [[108, 88], [372, 240], [390, 78], [96, 236]];
      return <>
        {[40, 80, 120].map((r) => <ellipse key={r} cx="240" cy="160" rx={r * 1.3} ry={r * .8} stroke={FAINT} fill="none" />)}
        <path d="M240 40V280M60 160H420" stroke={FAINT} />
        {points.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.2" fill={INK} />)}
        {outliers.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="4" fill={accent} /><circle cx={x} cy={y} r="11" stroke={accent} fill="none" opacity=".6" /></g>)}
      </>;
    }
    case "timetable": {
      const cells: ReactNode[] = [];
      for (let c = 0; c < 5; c++) for (let r = 0; r < 6; r++) {
        const on = random() > .45;
        cells.push(<rect key={`${c}${r}`} x={70 + c * 70} y={54 + r * 38} width="62" height="30" fill={on ? (random() > .75 ? accent : "rgba(214,228,232,.1)") : "none"} stroke={FAINT} />);
      }
      return <>{cells}<path d="M70 44H420" stroke={INK} /></>;
    }
    case "snake": {
      const path = [[3, 2], [8, 2], [8, 5], [4, 5], [4, 8], [11, 8]].map(([x, y]) => `${60 + x * 30},${40 + y * 30}`).join(" ");
      return <>
        {Array.from({ length: 13 }, (_, i) => <path key={`v${i}`} d={`M${60 + i * 30} 40V280`} stroke={FAINT} />)}
        {Array.from({ length: 9 }, (_, i) => <path key={`h${i}`} d={`M60 ${40 + i * 30}H420`} stroke={FAINT} />)}
        <polyline points={path} stroke={INK} strokeWidth="12" strokeLinecap="square" strokeLinejoin="miter" fill="none" opacity=".75" />
        <rect x={60 + 11 * 30 - 8} y={40 + 8 * 30 - 8} width="16" height="16" fill={accent} />
        <rect x={60 + 11 * 30 - 6} y={40 + 3 * 30 - 6} width="12" height="12" stroke={accent} fill="none" />
      </>;
    }
    case "trace": {
      return <>{[0, 1, 2, 3].map((channel) => {
        const y0 = 70 + channel * 60;
        const points = Array.from({ length: 61 }, (_, i) => {
          const x = 50 + i * 6.3;
          const spike = channel === 2 && i > 34 && i < 42 ? Math.sin((i - 34) * .9) * 26 : 0;
          return `${x},${y0 + Math.sin(i * .5 + channel) * 6 + (random() - .5) * 5 + spike}`;
        }).join(" ");
        return <g key={channel}><path d={`M50 ${y0}H430`} stroke={FAINT} /><polyline points={points} stroke={channel === 2 ? accent : INK} fill="none" strokeWidth="1.4" /></g>;
      })}</>;
    }
    case "strata": {
      const tiles: ReactNode[] = [];
      for (let c = 0; c < 7; c++) for (let r = 0; r < 4; r++) {
        const x = 64 + c * 52, y = 60 + r * 52, damaged = random() > .72;
        tiles.push(<g key={`${c}${r}`}>
          <rect x={x} y={y} width="46" height="46" fill="rgba(214,228,232,.05)" stroke={damaged ? accent : FAINT} />
          <rect x={x + 10 + random() * 8} y={y + 10 + random() * 8} width="16" height="14" fill="none" stroke={INK} />
          {damaged && <path d={`M${x + 6} ${y + 6}L${x + 40} ${y + 40}M${x + 40} ${y + 6}L${x + 6} ${y + 40}`} stroke={accent} opacity=".7" />}
        </g>);
      }
      return <>{tiles}</>;
    }
    case "tree": {
      const nodes = [[240, 60], [150, 130], [330, 130], [100, 200], [190, 200], [290, 200], [370, 200], [150, 262], [330, 262]];
      const kinds: [number, number, string][] = [[0, 1, "0"], [0, 2, "0"], [1, 3, "0"], [1, 4, "0"], [2, 5, "0"], [2, 6, "0"], [4, 7, "0"], [6, 8, "0"], [3, 4, "4 5"], [5, 6, "4 5"], [4, 5, "1 4"], [7, 8, "1 4"]];
      return <>
        {kinds.map(([a, b, dash], i) => <path key={i} d={`M${nodes[a][0]} ${nodes[a][1]}L${nodes[b][0]} ${nodes[b][1]}`} stroke={dash === "0" ? INK : accent} strokeDasharray={dash === "0" ? undefined : dash} opacity={dash === "0" ? 1 : .8} />)}
        {nodes.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 0 ? 9 : 7} fill={i === 0 ? accent : "#0c1014"} stroke={i === 0 ? accent : INK} />)}
      </>;
    }
    case "transit": {
      const route = "70,250 150,250 150,180 250,180 250,110 360,110 360,70 420,70";
      return <>
        {[90, 150, 210, 270, 330, 390].map((x) => <path key={`x${x}`} d={`M${x} 40V290`} stroke={FAINT} />)}
        {[70, 110, 150, 190, 230, 270].map((y) => <path key={`y${y}`} d={`M50 ${y}H430`} stroke={FAINT} />)}
        <polyline points={route} stroke={accent} strokeWidth="3" fill="none" />
        {[[70, 250], [150, 215], [200, 180], [250, 140], [305, 110], [360, 90], [420, 70]].map(([x, y], i) => <rect key={i} x={x - 5} y={y - 5} width="10" height="10" fill="#0c1014" stroke={accent} />)}
        <circle cx="250" cy="180" r="16" stroke={INK} fill="none" strokeDasharray="2 4" />
      </>;
    }
  }
}

const MOTIF_LABEL: Record<ProjectMotif, string> = {
  graph: "DEPENDENCY GRAPH", lens: "ANOMALY FIELD", timetable: "SCHEDULE GRID", snake: "GRID + LINKED LIST",
  trace: "FOUR-CHANNEL TRACE", strata: "TILE TRIAGE", tree: "AST STRUCTURE", transit: "TRANSIT TELEMETRY",
};

export default function ProjectSchematic({ project }: { project: Project }) {
  const random = seeded(project.id);
  return (
    <svg className="project-schematic" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Schematic illustration for ${project.name}: ${MOTIF_LABEL[project.motif].toLowerCase()}. Not a screenshot.`}>
      <rect width={W} height={H} fill="#0c1014" />
      {Array.from({ length: 16 }, (_, i) => <path key={`g${i}`} d={`M${i * 32} 0V${H}`} stroke="rgba(127,214,230,.035)" />)}
      {Array.from({ length: 11 }, (_, i) => <path key={`h${i}`} d={`M0 ${i * 32}H${W}`} stroke="rgba(127,214,230,.035)" />)}
      <g strokeWidth="1.2">{drawing(project.motif, project.accent, random)}</g>
      <text x="18" y="24" className="project-schematic-label">{MOTIF_LABEL[project.motif]}</text>
      <text x={W - 18} y={H - 16} textAnchor="end" className="project-schematic-label">FIG. {project.id.toUpperCase()}</text>
    </svg>
  );
}
