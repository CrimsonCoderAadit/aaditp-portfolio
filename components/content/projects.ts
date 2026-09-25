/** Portfolio projects: the one source of project content for the scene and the
 * interface. Text, technologies, links and recognitions are taken from the
 * previous portfolio (NEWPORTFOLIO/index.html, "Projects" and "Achievements"
 * sections); nothing here is invented. Where that source has no value for a
 * field, the field is left out rather than filled in.
 *
 * Every project has a physical exhibit in the Projects campus. IDs are stable:
 * they key those exhibits and `?project=<id>` deep links. */

export type ProjectLinkKind = "demo" | "github" | "paper" | "case-study";
export type ProjectLink = { kind: ProjectLinkKind; href: string };
/** A real screenshot or photo. None exist in the source yet. */
export type ProjectMedia = { src: string; alt: string; width: number; height: number };
/** The symbol a project's exhibit and schematic are drawn from. */
export type ProjectMotif = "graph" | "lens" | "timetable" | "snake" | "trace" | "strata" | "tree" | "transit";

export type Project = {
  id: string;
  name: string;
  /** Where it was built, as the source states it. */
  context?: string;
  /** Result at that event, as the source states it. */
  recognition?: string;
  /** Authorship note, where the source gives one. */
  role?: string;
  year?: number;
  summary: string;
  description: string[];
  highlights: string[];
  technologies: string[];
  links: ProjectLink[];
  media: ProjectMedia[];
  motif: ProjectMotif;
  accent: string;
};

export const PROJECTS: Project[] = [
  {
    id: "cassian-ai",
    name: "CASSIAN-AI",
    context: "Zenith Hackathon SSN 2026",
    recognition: "Finalist",
    year: 2026,
    summary: "Codebase analysis system generating filetree dependency graphs for modular code reasoning, on a serverless AWS pipeline.",
    description: [
      "Understanding an unfamiliar codebase usually means opening thirty files and holding the relationships in your head. CASSIAN-AI does that part for you: it ingests a repository and produces a filetree dependency graph that shows how modules actually connect, so you can reason about structure before reading a single line of implementation.",
      "The processing runs serverless: uploads land in S3, AWS Lambda handles the parsing and graph construction, and results stream back to a Next.js frontend written in TypeScript. Moving the analysis off a persistent server and onto Lambda cut end-to-end latency by roughly 30% while removing the idle infrastructure cost entirely.",
      "Technically, the pipeline parses repository files into an AST-derived import/dependency map, resolving both relative and absolute module references, then serializes that into a directed graph for rendering. The serverless split matters for cost shape as much as latency: analysis is bursty and idle most of the time, so Lambda's per-invocation billing beats a persistent server that spends its life waiting. Cold starts were the tradeoff, mitigated by keeping the handler's dependency footprint minimal so init time stays low. Large repositories are chunked so no single invocation approaches Lambda's execution ceiling, with partial results assembled client-side as they stream back from S3.",
      "The interesting problem here was representation. A dependency graph is easy to draw badly: everything connected to everything, unreadable at any real scale. Most of the work went into deciding what edges actually matter and how to lay them out so the output is something a person can genuinely use to orient themselves.",
    ],
    highlights: [
      "Ingests a repository and produces a filetree dependency graph of how its modules actually connect",
      "Parses files into an AST-derived import map, resolving relative and absolute module references",
      "Serverless pipeline: uploads land in S3, AWS Lambda parses and builds the graph, results stream to a Next.js frontend",
      "Moving analysis onto Lambda cut end-to-end latency by roughly 30% and removed idle infrastructure cost",
    ],
    technologies: ["Next.js", "TypeScript", "AWS S3", "AWS Lambda"],
    links: [
      { kind: "demo", href: "https://cassian-ai.vercel.app" },
      { kind: "github", href: "https://github.com/CrimsonCoderAadit/CASSIAN-AI" },
    ],
    media: [],
    motif: "graph",
    accent: "#7fd6e6",
  },
  {
    id: "crib-eyes",
    name: "Crib-Eyes",
    context: "Barclays Hack-o-Hire 2026",
    recognition: "Top 10 Finalist",
    year: 2026,
    summary: "AI-driven Security Operations Center tool that detects anomalies and drafts its own incident response playbooks.",
    description: [
      "Security operations teams drown in alerts. The hard part isn't detecting that something anomalous happened: it's deciding what to do about it, quickly, at three in the morning. Crib-Eyes attempts both halves: it flags the anomaly and then drafts the response playbook.",
      "The pipeline is deliberately hybrid rather than purely neural. PyOD handles statistical outlier detection over telemetry normalised against ECS schemas; detections are then mapped onto MITRE ATT&CK techniques for context; and a locally-hosted LLM running through Ollama generates the human-readable response playbook from that structured evidence. Keeping the model local matters here: security telemetry is exactly the category of data you don't want leaving your network to a third-party API.",
      "The detection layer uses PyOD's unsupervised ensemble (isolation forests and density-based estimators over telemetry features), chosen because labelled attack data is scarce in practice and supervised detection generalizes badly to novel intrusions. Normalizing everything to ECS schemas first means detectors operate on a consistent field structure regardless of source, so adding a new log source doesn't require retraining. MITRE ATT&CK mapping happens after detection, converting an anomaly score into structured context the LLM can reason over.",
      "Building it meant sitting with the reality that a confidently wrong playbook is worse than no playbook, which shaped how much the system asserts versus how much it presents as evidence for a human to judge.",
    ],
    highlights: [
      "Unsupervised PyOD ensemble of isolation forests and density-based estimators over telemetry",
      "Telemetry normalised to ECS schemas, so a new log source needs no retraining",
      "Detections mapped onto MITRE ATT&CK techniques before any playbook is written",
      "Playbooks drafted by a locally hosted LLM through Ollama, so security data never leaves the network",
    ],
    technologies: ["PyOD", "ECS", "MITRE ATT&CK", "Ollama LLMs"],
    links: [{ kind: "github", href: "https://github.com/Uthayamurthy/Crib-Eye" }],
    media: [],
    motif: "lens",
    accent: "#d98a6c",
  },
  {
    id: "acadex-ai",
    name: "ACADEX-AI",
    context: "Google Developer Groups Hackathon",
    recognition: "10th Place",
    summary: "Academic schedule manager: dynamic timetables, attendance tracking, bunk calculator.",
    description: [
      "Every student builds an informal mental model of their own timetable: what's mandatory, what's skippable, how much attendance buffer they have left. ACADEX-AI makes that model explicit.",
      "It generates dynamic timetables from user-defined constraints, tracks attendance across courses, and includes a bunk calculator that tells you precisely how many classes you can afford to miss while staying above threshold. Built in Next.js, it handles automated schedule adjustments as constraints change over a semester.",
      "Timetable generation is a constraint satisfaction problem: a scheduling search over course slots subject to non-overlap, instructor availability, and user-defined preferences. Naive backtracking degrades quickly once real-world constraints interact, so the solver prunes aggressively rather than exhaustively enumerating. The bunk calculator is deliberately conservative: it computes the maximum skippable classes against the attendance threshold with the remaining schedule accounted for, rounding against the user rather than in their favour.",
      "It's a small, genuinely useful tool, and the constraint-satisfaction problem underneath it is more interesting than the surface suggests.",
    ],
    highlights: [
      "Generates dynamic timetables from user-defined constraints and adjusts them as a semester changes",
      "Tracks attendance across courses",
      "Conservative bunk calculator: the most classes you can miss while staying above the attendance threshold",
      "Constraint-satisfaction scheduler that prunes aggressively instead of enumerating exhaustively",
    ],
    technologies: ["Next.js"],
    links: [
      { kind: "demo", href: "https://acadexai-1-tu93.onrender.com" },
      { kind: "github", href: "https://github.com/CrimsonCoderAadit/ACADEXAI-1" },
    ],
    media: [],
    motif: "timetable",
    accent: "#8fe3c0",
  },
  {
    id: "csnake",
    name: "CSnake",
    summary: "Snake in C on SDL, no engine: the body is a hand-rolled linked list, with real-time input and grid collision detection. Built to prove the fundamentals still matter.",
    description: [
      "A snake game written from scratch in C with SDL: no engine, no framework, just the language and a rendering library.",
      "The snake body is a linked list, which makes growth an O(1) insertion rather than an array shuffle, and the game loop handles collision detection and real-time movement input directly. Writing it in C meant confronting memory management honestly: every node allocated has to be freed, and a subtle leak in a game loop compounds fast. Collision detection is O(n) per frame against body segments, acceptable at snake lengths a human can actually reach.",
      "It's since been compiled to WebAssembly and deployed to run entirely in the browser: the version linked here is the actual C program, running client-side, no server involved. Getting a native SDL game to that point required inverting control of the game loop: native SDL runs a blocking while loop owning the frame clock, but a browser cannot be blocked, so the loop body was refactored into a callback handed to emscripten_set_main_loop() and driven by the browser's requestAnimationFrame. A genuinely instructive exercise in how differently a browser and an OS think about who owns the clock.",
    ],
    highlights: [
      "Written from scratch in C with SDL: no engine, no framework",
      "Snake body as a hand-rolled linked list, so growth is an O(1) insertion",
      "Compiled to WebAssembly: the live demo is the actual C program running in the browser",
      "Game loop inverted into an emscripten_set_main_loop() callback driven by requestAnimationFrame",
    ],
    technologies: ["C", "SDL", "Linked lists", "WebAssembly"],
    links: [
      { kind: "demo", href: "https://crimsoncoderaadit.github.io/SNAKE-PROJECT/" },
      { kind: "github", href: "https://github.com/CrimsonCoderAadit/SNAKE-PROJECT" },
    ],
    media: [],
    motif: "snake",
    accent: "#c3cf6a",
  },
  {
    id: "false-positive",
    name: "FALSE POSITIVE: The Black Box Murders",
    context: "CEG Hackathon",
    summary: "An interactive detective thriller where you interrogate AI suspects in natural language and read a deliberately unreliable polygraph. The instrument measures arousal, not truth, and it will convict an innocent person if you let it.",
    description: [
      "FALSE POSITIVE is a Netflix-styled interrogation game with a thesis buried inside it. You question seven AI-driven suspects in free-form natural language, watch a four-channel polygraph called VERITAS respond in real time, gather evidence from what you extract, and eventually make an accusation.",
      "The catch is the instrument. VERITAS measures physiological arousal, not deception, so the suspect concealing an unrelated expense fraud spikes harder than the actual murderer. The game teaches automation bias by inflicting it on you: the evidence is all there, shown and never explained, and most players trust the needle anyway. The debrief afterwards shows you exactly how the system adapted to your interrogation style, and exactly where you deferred to a machine that couldn't tell shame from murder.",
      "Under the hood, the suspects are driven by Gemini Flash with three independent containment layers preventing the model from fabricating alibis (client-side routing, server-side refusal, and an output scan), because an LLM inventing new facts mid-interrogation would break the case's internal logic entirely. A deterministic alibi ledger injects each suspect's claimed facts verbatim every turn so their stories stay consistent under pressure. An adaptive Director engine scores each question on relevance, aggression, and evidence-backing, then adjusts suspect resistance and triggers a probabilistic lawyer-arrival system as pressure builds. Facts register by content-based signature matching rather than exact phrasing, so discoveries count regardless of how you phrased the question that surfaced them. spaCy NER drives evidence spawning; sentence-transformers handle Director scoring.",
      "Getting the conversation quality right took the most iteration: nudge stacking dropped from 246 to 59 occurrences across 280 answers, wrong-topic adoptions were eliminated, and the protected keyword set was refined from 233 terms down to 57. Adaptive difficulty was verified across four player archetypes producing four genuinely distinct experience tiers.",
    ],
    highlights: [
      "Seven AI-driven suspects questioned in free-form natural language, read through the VERITAS polygraph",
      "Three independent containment layers stop Gemini Flash from fabricating alibis mid-interrogation",
      "Adaptive Director engine scores every question and adjusts suspect resistance as pressure builds",
      "Nudge stacking cut from 246 to 59 occurrences across 280 answers",
    ],
    technologies: ["Next.js", "Serverless", "Gemini Flash", "spaCy NER", "sentence-transformers", "Vercel"],
    links: [
      { kind: "demo", href: "https://falsepositive-murex.vercel.app" },
      { kind: "github", href: "https://github.com/CrimsonCoderAadit/FALSEPOSITIVE" },
    ],
    media: [],
    motif: "trace",
    accent: "#9a88e6",
  },
  {
    id: "strata",
    name: "STRATA",
    context: "IEEE Masathon",
    recognition: "1st Place",
    summary: "Post-disaster damage assessment from satellite imagery: a CNN ensemble classifying hurricane-affected structures as damaged or intact, with coordinates carried through to map predictions back to real locations.",
    description: [
      "After a hurricane, the bottleneck in disaster response is triage: knowing which structures need attention first, across a volume of aerial imagery no human team can review quickly. STRATA automates the first pass as a binary classification problem over satellite tiles.",
      "The classifier is a CNN ensemble rather than a single network. Ensembling was the right call given the data constraint: with only 2,000 images, a single deep network overfits aggressively, while averaging predictions across architectures with different inductive biases buys back generalization that more data would otherwise provide.",
      "Training ran on a balanced 2,000-image dataset, 1,000 per class, using transfer learning from ImageNet-pretrained weights rather than training from scratch. Source imagery encodes geographic coordinates, which are parsed and carried through inference so every prediction maps back to a real location rather than existing as a disembodied label.",
      "Scope was deliberately constrained to hurricane damage rather than multi-hazard generalization. Covering earthquakes, floods, and wildfires on a dataset this size would have produced a model mediocre at all four: better to demonstrate the method convincingly on one hazard than unconvincingly across several.",
      "The honest framing of the whole project is that the dataset is a demonstration constraint, not a ceiling: the same pipeline retrained on the imagery volume a national disaster agency already holds would be materially more capable, and it was architected with that scaling path in mind.",
    ],
    highlights: [
      "First place in the AI track at IEEE Masathon",
      "CNN ensemble with transfer learning from ImageNet-pretrained weights",
      "Trained on a balanced 2,000-image dataset, 1,000 images per class",
      "Geographic coordinates carried through inference, so every prediction maps back to a real location",
    ],
    technologies: ["PyTorch", "CNN ensemble", "Next.js", "Vercel"],
    links: [
      { kind: "demo", href: "https://strata-teal-nu.vercel.app" },
      { kind: "github", href: "https://github.com/ad8thya/IEEEMasathon" },
    ],
    media: [],
    motif: "strata",
    accent: "#e0a24c",
  },
  {
    id: "structure-over-surface",
    name: "Structure Over Surface",
    role: "Solo research project",
    summary: "Detects machine-generated Python code from structure alone — a Graph Isomorphism Network trained on AST-derived graphs, evaluated for cross-generator transfer and adversarial robustness.",
    description: [
      "Most machine-generated code detectors look at surface text — token frequencies, stylistic quirks, the kind of thing a paraphrase can defeat. Structure Over Surface asks a different question: if you strip away every identifier and every surface-level choice, does the underlying shape of the code still give it away?",
      "The approach represents each function as a graph built from its abstract syntax tree, with three distinct edge types capturing different structural relationships, and trains a Graph Isomorphism Network to classify human-written versus machine-generated code from that structure alone. The dataset is roughly 927 human/machine code pairs.",
      "The evaluation is where this gets honest rather than promotional. The model was tested for cross-generator transfer — does it still work on generators it never saw in training — and for adversarial robustness against code deliberately restructured to evade detection. Along the way it surfaced a docstring-rate confound hiding in a standard evaluation setup, hit two architectural dead ends worth reporting, and found that GraphCodeBERT actually beats the proposed GNN on structural robustness specifically. That last result stays in the writeup rather than getting buried, because a detector's failure modes matter as much as its wins.",
      "This is solo, first-author research, and it's left as a public, open-source repository — anyone is welcome to dig in, challenge the approach, extend it, or push improvements if they want to take it further.",
    ],
    highlights: [
      "Graph Isomorphism Network over AST-derived graphs with three distinct edge types",
      "Roughly 927 human/machine code pairs",
      "Evaluated for cross-generator transfer and adversarial robustness",
      "Reports openly that GraphCodeBERT beats the proposed GNN on structural robustness",
    ],
    technologies: ["PyTorch", "Graph Isomorphism Networks", "AST graph construction"],
    links: [
      { kind: "demo", href: "https://structure-over-surface.vercel.app" },
      { kind: "github", href: "https://github.com/CrimsonCoderAadit/structure-over-surface" },
    ],
    media: [],
    motif: "tree",
    accent: "#9cc8ff",
  },
  {
    id: "drishti",
    name: "DRISHTI",
    context: "Smart India Hackathon 2026",
    year: 2026,
    summary: "An AI-powered urban digital twin of Chennai, built from live bus GPS data — turning a city's transit telemetry into a queryable model of how it actually moves.",
    description: [
      "A city generates enormous amounts of positional data every day and mostly throws it away. DRISHTI is an attempt to do something with it: an AI-powered urban digital twin of Chennai built on live bus GPS telemetry, modelling how the city actually moves rather than how a static map says it should.",
      "Built by a six-person team across a seven-day sprint for the Smart India Hackathon 2026. My track was incidents and ANPR — automatic number plate recognition, plus hazard detection: identifying road incidents and reading vehicle plates from the feed, so the twin carries not just where things are, but what's going wrong and who's involved.",
      "The interesting constraint in a digital twin isn't rendering the city, it's deciding what fidelity actually earns its cost. Modelling every vehicle precisely is neither feasible nor useful; the value sits in the layer where aggregate movement patterns become legible enough to act on — which is a judgement call about abstraction rather than a rendering problem.",
    ],
    highlights: [
      "Urban digital twin of Chennai built on live bus GPS telemetry",
      "Six-person team, seven-day sprint for Smart India Hackathon 2026",
      "Owned the incidents and ANPR track: number plate recognition and road-hazard detection",
    ],
    technologies: ["Next.js", "TypeScript", "Python", "Computer Vision", "ANPR"],
    links: [
      { kind: "demo", href: "https://sih-drishti.vercel.app" },
      { kind: "github", href: "https://github.com/Harshil-Malisetty/sih_drishti" },
    ],
    media: [],
    motif: "transit",
    accent: "#7fd6c0",
  },
];

/** The name as it fits a selector entry or a title plate. */
export const shortName = (project: Project) => project.name.split(":")[0];

export function projectById(id: string | null | undefined) {
  return PROJECTS.find((project) => project.id === id) ?? null;
}

/** Metadata line: event and result, or the authorship note. */
export function projectMeta(project: Project) {
  return [project.context, project.recognition ?? project.role].filter(Boolean).join(" · ");
}

const LINK_LABELS: Record<ProjectLinkKind, string> = { demo: "Live demo", github: "View on GitHub", paper: "Read the paper", "case-study": "Case study" };
export const linkLabel = (kind: ProjectLinkKind) => LINK_LABELS[kind];

/** Only absolute http(s) URLs are ever rendered as links. */
export function isValidLink(href: string) {
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
