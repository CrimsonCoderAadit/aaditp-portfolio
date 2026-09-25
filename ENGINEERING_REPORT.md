# Studio engineering pass — 23 September 2026

The pass addresses startup, room-shell integrity and rendering resource use. The mural image files are byte-for-byte unchanged. City layout, Vader, Contact architecture, furniture transforms and portfolio content are unchanged.

## Measured startup

Local Chrome on this Mac, 1440 × 900, DPR 1 for startup measurements. A cold browser run uses a fresh browser process/context; the warm run reloads within that context. “Visible frame” is the next animation-frame opportunity after drawing to the default framebuffer, excluding offscreen environment/shadow draws. It is a presentation proxy, not a hardware GPU-present timestamp. These are individual observations, not statistical benchmarks; driver and filesystem caches affect results.

| Scenario | Before: visible frame | After: visible frame |
| --- | ---: | ---: |
| Clean Next dev compilation + browser navigation | 6.37 s | 3.30 s |
| Fresh browser, already compiled dev server | 13.17 s (cold shader outlier) | 2.04 s (earlier worker implementation) |
| Warm dev reload | 2.42 s | 1.68 s |
| Local production, fresh browser | 1.95 s | 1.75 s |
| Local production, warm reload | 1.74 s | 1.42 s |

The isolated cold dev route spent 3.6 s in Next.js compilation before the changes and 1.26 s after. Response-start times were 3.80 s and 1.40 s respectively. Warm dev responses were tens of milliseconds. Production response-start was about 30 ms cold and 3–4 ms warm; final production server readiness was 122 ms. The cold-compilation samples were from separate clean build directories, but not a cleared operating-system filesystem cache.

The final production run's largest main-thread task fell from 719 ms to 413 ms cold, and from 663 ms to 358 ms warm. Final hydration was observed at 95 ms cold / 31 ms warm; dynamic module completion at 208 / 41 ms. Worker texture preparation took about 340–346 ms off the main thread. Browser WebGL context creation itself took 4–6 ms. Asynchronous program preparation took 285–347 ms in the final sample. Geometry construction and texture uploads still produce shorter main-thread tasks.

Raw measurements are in `.playwright-mcp/engineering/`: `baseline-dev.json`, `baseline-production.json`, `after-dev-cold.json`, and `after-production.json`. The initial clean-dev baseline (6.37 s, including 3.8 s response start) was captured through browser instrumentation before the standalone probe was added.

## Bottlenecks and fixes

- Procedural room texture baking ran synchronously inside React render, with duplicate development work under StrictMode. The same deterministic pixel calculations now run once in a worker, started when the lazy scene module arrives. Pixel buffers transfer without copying. No resolution, material or artistic change was needed.
- Shader compilation/checks and uploads stalled first render. A sampled profile attributed about 466 ms to `getProgramInfoLog`, 366 ms to texture upload, and substantial time to procedural baking/geometry; one fresh-browser baseline blocked for 8.16 s during first render. The scene now calls `compileAsync` after lighting/environment setup and explicitly invalidates demand rendering when ready.
- HTML viewpoint navigation imported Three.js camera math before the lazy scene loaded. Camera math now lives in `viewpointPose.ts`, keeping the navigation/loader independent of the 3D import.
- Three rectangular contact-shadow components passed fresh scale arrays on navigation. Drei regenerated two render targets per component without disposing the previous targets. Scalar dimensions retain the identical shadow footprint. Memoizing the scene also prevents static environment/shadow recapture caused by parent navigation renders.
- Mural requests were sequential. The back mural still starts first; left and right start independently after the first visible frame. A stalled or failed wall request cannot hold up another wall or the scene.

There are no GLB/GLTF downloads or decoding steps. No hydration mismatch was found. Murals are outside Suspense. The new server-rendered loading panel reports actual module, surface, assembly and shader stages, without a fabricated percentage. It clears after a rendered frame, not after optional textures. Worker/module/render failures have a bounded error state and retry action.

## Room-shell repairs

- The right wall ended as an uncapped, zero-thickness plane at the front cutaway. Added a 0.27-unit plaster reveal, from floor 0.035 to ceiling 4.7, at the existing wall end. Its existing mural plane is untouched.
- The front wall started at world height zero rather than the room floor; its bounds now match floor and ceiling exactly.
- The front baseboard was missing. Added its full run with side runs butting against it. It follows the front wall's cutaway visibility, hiding from exterior cameras so it does not float across the floor.
- The left baseboard continued to `ROOM.back + 40`, far outside the room. It now ends at the front junction.

Existing inward-facing normals are correct and intentionally allow exterior cutaway cameras. No double-sided opaque wall was added in front of useful camera views. The existing overscan floor/wall treatment remains. Mural world-coordinate UVs are unchanged: runtime verification checks all 32 mapped vertices, with maximum normalized UV error approximately 1.06e-7.

## Sharpness and memory

The back mural remains 3840 × 1298, left 4096 × 2066; compact variants remain 1920 × 649 and 2048 × 1033. The deliberate pixel artwork remains 496 × 250 with nearest magnification, mipmapped linear minification and up to 8× anisotropy. Full desktop mural downloads total about 908 KB including response overhead; compact murals about 362 KB. Full mural GPU storage is approximately 69 MiB including mipmaps; actual driver allocation is not exposed by the browser. No scene-wide blur/postprocessing was added or reduced.

All ten desktop/mobile viewpoint captures retained DPR 2. The city still renders approximately 1.185 million triangles / 429 main-pass calls in the desktop hero. The scene uses 187 material objects, with 31–44 cached shader programs depending on the exercised variants. In the repeated development navigation test, GPU resources stayed at 48 textures / 223 geometries for three complete cycles. Before the fix they rose from 48 / 223 to 516 / 442. After forced garbage collection, development heap remained about 83–84 MiB. The final production interaction suite also ended at 48 textures / 223 geometries, with about 89 MiB heap before forced collection. See `memory-fixed-dev.json` and the repeatable memory probe.

Across 3,057 motion frames at DPR 2, animation-frame intervals were 16.7 ms median and 33.3 ms p95. Instrumented `gl.render` wall time was 2.0 ms median / 6.6 ms p95 (5,146 calls, including auxiliary passes); that is CPU submission time, not a GPU timer. This is generally smooth motion with occasional slower frames, not a claim of a locked 60 fps.

## Verification and remaining limits

TypeScript, ESLint, production build and all ten existing geometry/city-plan checks pass. Browser verification artifacts and screenshots are in `.playwright-mcp/engineering/`; `verification.json` records viewport, interaction, UV, rendering and injected-failure results. The final automated suite passed all five curated views at 1440 × 900 and 390 × 844, all four districts' keyboard focus/Back and actual pointer hover/click/Back, background drag without accidental activation, wheel dolly and UV assertions. With the back mural aborted and left mural deliberately held pending, the right mural and scene completed independently and navigation remained usable. A rejected worker produced the retry action. Normal application console errors: zero; the two recorded network errors were deliberately injected. The memory regression repeats every view and focus/Back sequence three times.

Some geometry construction and GPU upload work remains synchronous (up to 413 ms in the final cold production sample). GPU shader caches and platform drivers can still change cold-start duration. Verification uses desktop Chrome with mobile viewport emulation, not physical mobile devices or Safari/Firefox. Test runners emit an existing Node module-type warning; application console validation excludes only deliberate failure injection. No artwork redesign or new portfolio feature was implemented.

## Files changed

Existing: `app/globals.css`; `components/scene/SceneLoader.tsx`, `PortfolioScene.tsx`, `CameraRig.tsx`, `viewpoints.ts`, `RoomShell.tsx`, `RoomFurniture.tsx`; `components/scene/roomAssets/RoomSurfaces.tsx`, `surfaces.ts`, `murals.ts`, `architecture.ts`.

Added: `components/scene/SceneStartup.tsx`, `startup.ts`, `viewpointPose.ts`, `roomAssets/surfaces.worker.ts`; `scripts/profile-startup.mjs`, `verify-studio.mjs`, `verify-studio-memory.mjs`; this report. Generated test artifacts are under `.playwright-mcp/engineering/`.

Reproduce with a locally available Playwright installation:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/profile-startup.mjs http://localhost:3018 output.json
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/verify-studio.mjs http://localhost:3018
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/verify-studio-memory.mjs http://localhost:3018
```

The original development server remains on port 3002. The final local production build is available on port 3018. Temporary comparison servers were stopped; the original-source snapshot remains in `/private/tmp/portfolio-baseline.V3ZndQ` because this workspace has no Git repository.
