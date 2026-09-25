/** Publications: the one source of research content for the scene and the
 * interface. Titles, authors, venues and every figure are taken from the
 * published papers themselves (CEUR-WS Vol-4173 T6-4, and ACL Anthology
 * 2026.semeval-1.282), with the framing lines from the previous portfolio
 * (NEWPORTFOLIO/index.html, "Publications"). Nothing here is invented; where a
 * paper states no value, the field is left out.
 *
 * IDs are stable: they key the lab's stations and `?research=<id>` deep links. */

export type ResearchLinkKind = "paper" | "proceedings" | "anthology" | "code";
export type ResearchLink = { kind: ResearchLinkKind; href: string };
/** A processing stage, or several stages that run side by side. */
export type Stage = string | string[];
/** One pipeline as the paper draws it, input to output. */
export type Pipeline = { label?: string; stages: Stage[] };
export type Result = { label: string; value: string; note?: string };
/** The symbol a publication's lab station is built from. */
export type StationMotif = "token-graph" | "dual-encoder";

export type ResearchEntry = {
  id: string;
  /** Printed on the station's plate and the index. */
  shortName: string;
  title: string;
  /** The shared task and track, as the paper names them. */
  task: string;
  venue: string;
  year: number;
  /** In the paper's own order and spelling. */
  authors: string[];
  summary: string;
  problem: string[];
  data?: string;
  pipelines: Pipeline[];
  contributions: string[];
  results: Result[];
  /** Where the figures above were measured, as the paper states it. */
  resultsNote?: string;
  tools: string[];
  links: ResearchLink[];
  motif: StationMotif;
  accent: string;
};

export const RESEARCH: ResearchEntry[] = [
  {
    id: "fire-irse-2025",
    shortName: "FIRE · IRSE",
    title: "Identification of the Relevance of Comments in Codes Using Graph Neural Networks",
    task: "FIRE 2025 IRSE shared task · Information Retrieval in Software Engineering",
    venue: "FIRE 2025 Working Notes · CEUR Workshop Proceedings, Vol-4173",
    year: 2025,
    authors: ["Durairaj Thenmozhi", "Aadit P", "Adithya S", "Harshil Malisetty", "Rohan R"],
    summary: "A graph-oriented approach to deciding whether a comment in source code is genuinely helpful or redundant: each code–comment pair becomes a graph of tokens, classified by a compact Graph Neural Network with only 9,762 learnable parameters.",
    problem: [
      "The shared task asks a system to determine automatically whether a comment within source code is genuinely helpful or redundant.",
      "Most earlier approaches relied on bag-of-words features or large transformer-based models, treating source code purely as natural-language text without accounting for its structure.",
    ],
    data: "11,452 code–comment pairs in C, from open-source repositories such as glibc, ffmpeg and linux, each annotated by domain experts as useful or not useful (the FIRE 2022 IRSE dataset).",
    pipelines: [{
      stages: [
        "Code–comment pair",
        "Preprocessing: comment markers removed, indentation standardised, tokens lowercased",
        "Token graph: sequential, skip and bridge edges, plus self-loops",
        "53-dimensional pretrained node embeddings",
        "Two GCN layers (53 → 64 → 64), global mean pooling",
        "Fully connected 64 → 32 → 2",
        "Useful / not useful",
      ],
    }],
    contributions: [
      "A graph-based representation of each code–comment pair that explicitly connects tokens from both sides through multiple types of links",
      "A lightweight GNN classifier over 53-dimensional node features, with only 9,762 trainable parameters",
      "An evaluation of the model's generalisation on synthetically generated datasets of varying sizes",
    ],
    results: [
      { label: "Accuracy", value: "80.8%", note: "Original test set, 2,291 samples" },
      { label: "Weighted F1", value: "0.807", note: "Original test set" },
      { label: "Trainable parameters", value: "9,762" },
      { label: "Small synthetic set", value: "62.5%", note: "16 samples" },
      { label: "Large synthetic set", value: "83.0%", note: "100 samples" },
    ],
    resultsNote: "The final configuration: 53-dimensional features with upsampling of the not-useful class.",
    tools: ["Graph Convolutional Network", "NetworkX", "Adam optimiser"],
    links: [
      { kind: "paper", href: "https://ceur-ws.org/Vol-4173/T6-4.pdf" },
      { kind: "proceedings", href: "https://ceur-ws.org/Vol-4173/" },
    ],
    motif: "token-graph",
    accent: "#7fd6e6",
  },
  {
    id: "semeval-2026-task-13",
    shortName: "SEMEVAL · T13",
    title: "Bitzkrieg at SemEval-2026 Task 13: Calibration-Aware Dual CodeBERT for Multilingual Machine-Generated Code Detection",
    task: "SemEval-2026 Task 13 · detection and attribution of machine-generated code",
    venue: "Proceedings of the 20th International Workshop on Semantic Evaluation (SemEval-2026) · ACL Anthology",
    year: 2026,
    authors: ["Thenmozhi D", "Adithya S", "Harshil Malisetty", "Aadit P", "Rohan R"],
    summary: "A submission to all three subtasks of SemEval-2026 Task 13. For binary detection, two CodeBERT models trained with complementary sampling strategies are combined and calibrated after training with percentile-based thresholds, raising Macro-F1 from 0.47 to 0.56 without additional training.",
    problem: [
      "Subtask A: decide whether code is human-written or machine-generated. Training covers C++, Python and Java from competitive programming; evaluation adds unseen languages (Go, PHP, C, C#, JavaScript) and unseen completions.",
      "Subtask B: attribute code to a human or to one of 10 LLM families, on an 11-class dataset skewed 88% toward the human class.",
      "Subtask C: classify code as human, fully machine-generated, hybrid or adversarial.",
    ],
    data: "500,000 training examples for Subtasks A and B; every subtask is evaluated on programming languages and domains not seen in training.",
    pipelines: [
      { label: "Subtask A · binary detection", stages: ["Code snippet", ["Brain A: balanced polyglot", "Brain B: full-data specialist"], "Hard ensemble", "Percentile calibration", "Human / machine"] },
      { label: "Subtask B · generator attribution", stages: ["Code snippet", ["TF-IDF n-grams", "Frozen CodeBERT embeddings", "Language one-hot"], "XGBoost with class weights", "11 classes"] },
      { label: "Subtask C · authorship spectrum", stages: ["Code snippet", "Fine-tuned CodeBERT", "Four-class head", "Human / machine / hybrid / adversarial"] },
    ],
    contributions: [
      "Two CodeBERT models trained with complementary sampling strategies: one capped at 8,000 samples per language, one on the full unbalanced data",
      "Post-hoc percentile calibration in place of the standard 0.5 decision boundary, with no additional training",
      "Synthetic augmentation and class weighting against an 11-class dataset skewed 88% toward human code",
    ],
    results: [
      { label: "Subtask A · Macro-F1", value: "0.47 → 0.56", note: "Hard ensemble, then percentile calibration" },
      { label: "Subtask B · Macro-F1", value: "0.289", note: "Validation set" },
      { label: "Subtask C · Macro-F1", value: "0.49" },
    ],
    tools: ["CodeBERT (microsoft/codebert-base)", "HuggingFace Transformers", "XGBoost", "TF-IDF", "AdamW"],
    links: [
      { kind: "paper", href: "https://aclanthology.org/2026.semeval-1.282.pdf" },
      { kind: "anthology", href: "https://aclanthology.org/2026.semeval-1.282/" },
    ],
    motif: "dual-encoder",
    accent: "#9cc8ff",
  },
];

export function researchById(id: string | null | undefined) {
  return RESEARCH.find((entry) => entry.id === id) ?? null;
}

const LINK_LABELS: Record<ResearchLinkKind, string> = { paper: "Read the paper", proceedings: "CEUR proceedings", anthology: "ACL Anthology", code: "GitHub" };
export const researchLinkLabel = (kind: ResearchLinkKind) => LINK_LABELS[kind];
