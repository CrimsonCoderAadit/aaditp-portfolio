/** Observable milestones, also available through the browser Performance API. */
export type StartupStage = "module" | "surfaces" | "ready" | "error";
export function startup(stage: StartupStage) {
  performance.mark(`studio:${stage}`);
  window.dispatchEvent(new CustomEvent("studio-stage", { detail: stage }));
}
