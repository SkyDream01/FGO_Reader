# atlasacademy/apps

The story-script parser refactor was informed by the Atlas Academy Apps
implementation and its documented handling of FGO script syntax.

- Upstream: https://github.com/atlasacademy/apps
- Pinned revision: `2756808cfbf00aa4915b454650e27b4c3475dedb`
- Primary reference: `packages/db/src/Component/Script.tsx`
- Consumer reference: `packages/db/src/Component/ScriptTable.tsx`
- API schema reference: `packages/api-connector/src/Schema/Script.ts`

The local implementation separates syntax parsing from projection into reader
frames and does not depend on Atlas Academy runtime code. The upstream project
is licensed under the MIT License; a copy is included in `LICENSE`.
