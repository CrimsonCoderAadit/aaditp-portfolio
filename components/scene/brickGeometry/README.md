# Shared brick geometry

The grid module is `0.15`; intentional half-grid offsets are `0.075`.

- `createMoldedBoxGeometry()` shares one rounded topology across all box sizes. `withMoldedEdges()` reconstructs its physical edge radius from the instance/model matrix, and corrects normals before Three's normal transform. Radius is `0.003`, capped at 12% of the thinnest dimension. Existing material response is untouched. District finishes already apply this hook; studs and other shapes have a zero attribute fallback and are unchanged.
- `BrickInstances` attaches the matching depth material automatically. A standalone shadow-casting box must also use `customDepthMaterial={geometry.userData.moldedDepth}`. The existing invisible hit proxies remain the interaction geometry. Conservative bounds enclose the corrected shape. This supports rigid rotation and scale, not shear or skinned geometry.
- `createPartLibrary()` caches original slope, offset plate, folded edge panel, stepped arch and open technical beam geometries by form/dimensions. Dimensions are the complete physical envelope, centered on the origin. Render these at unit scale; rotate to mount sideways. The slope has no rounded edges and may also be scaled as a crisp wedge. No branded part geometry or modeling dependency is used.
- Offset plates have a centered attachment stud on an even-width base. `halfModuleOffset()` supplies intentional half-grid placement independently of the mesh.
- `builtWindow()` returns frame and glass parts, facing local +Z, inside the requested envelope. Feed both into the same existing assembly batch. Glazing has nonzero thickness and is behind the jamb/head/sill front plane. The wall must contain an opening; do not bury the pane in a solid backing block. Use the approved `translucentPlastic` finish; keep indicator lighting separate.

Ownership: kits dispose their box/stud geometry and material resources. Box disposal also disposes its depth material. Dispose a part-library cache once with its kit, or dispose every returned geometry with the kit's existing geometry collection (as Projects does). Never create geometries during `useFrame`.

Verification: `node --experimental-strip-types --test scripts/verify-brick-geometry.mjs` checks physical edge equivalence, shader composition, bounds, caching, open apertures, half-grid offsets and recessed windows.
