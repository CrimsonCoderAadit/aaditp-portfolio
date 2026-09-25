# Engineer’s Workbench — Stage 1

An empty engineering workbench in a dark studio. Next.js App Router, TypeScript, React Three Fiber, and Drei. No models, downloaded textures, post-processing, or external services.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000. Node.js 20.9 or newer is required.

## Check

```sh
npm run lint
npm run typecheck
npm run build
```

`npm start` serves the production build.

Scene components live in `components/scene/`. The viewport uses a capped DPR of 1.5 and renders on demand. A constrained, damped pointer camera respects reduced motion; touch keeps the composed camera stationary. Environment reflections and contact shadows bake once; only one light casts a realtime shadow. The surface finish is procedural and the studio requires WebGL.
