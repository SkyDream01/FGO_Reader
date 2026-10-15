# atlasacademy/apps

The story-script parser refactor was informed by the Atlas Academy Apps
implementation and its documented handling of FGO script syntax.

- Upstream: https://github.com/atlasacademy/apps
- Pinned revision: `2756808cfbf00aa4915b454650e27b4c3475dedb`
- Primary reference: `packages/db/src/Component/Script.tsx`
- Consumer reference: `packages/db/src/Component/ScriptTable.tsx`
- API schema reference: `packages/api-connector/src/Schema/Script.ts`

Composition was also checked against revision
`a596decc0a0f8cb4556dcf7fc59fa53e3916faa1`, especially
`packages/db/src/Component/Scene.tsx` and `Scene.css`: wide backgrounds use the
`_1344_626` asset, and figure placement preserves the source bitmap's transparent
margins and applies `svtScript.offsetY`. The regression fixture covers these
geometry rules and the moved background in JP script `9415900210`.

The `9415900310` audit also checks the image directory layout, the cinema
frame's `_fs` variant and padded bitmap geometry, and the application of
`offsetX` to both the figure wrapper and bitmap. Its opaque black/white sub-camera
textures are sampled as luminance masks. An actual-game cut-in reference further
checks their centered half-width sample, independent vertical content pan, black
outline, and the bitmap origin used when scaling portraits.

The follow-up normal-clock audit replays both chapters (99 and 82 dialogue
entries) and checks intermediate cut-in fades, figure alpha fades, camera moves,
and directional wipes. See `docs/atlas-composition-audit.md` for the scope and
remaining approximate effects.

The local implementation separates syntax parsing from projection into reader
frames and does not depend on Atlas Academy runtime code. The upstream project
is licensed under the MIT License; a copy is included in `LICENSE`.
