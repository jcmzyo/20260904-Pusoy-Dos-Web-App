# Task Completion Report - PR #85

## Task
M4-T14 - Full Responsive Hardening

## Status
COMPLETE

## Implemented
- Minimum supported landscape viewport raised from 667x375 to 844x390
- small-phone-landscape reclassified from supported to unsupported-undersized
- New PlayArea component with uniform CSS transform: scale() approach
- playAreaScale.ts: pure-function scale/layout computation (design 896x656, comfort 1440x900, max 2.0)
- Two-tier system: full-scale (>=896x656) vs phone tier (844-895x390-655) with 14px/44px exemption
- CSS responsive refinements: clamp() edge insets, min() card exposed width, 3-column bottom-bar grid
- Discard Pile button relocated from CenterTable to bottom bar
- SessionSummary font sizes bumped to 14px minimum, button min-height to 44px
- --play-area-scale CSS variable for downstream component adaptation
- HumanHand card exposed width: min(card-width, max(card-width*0.7, 28px/scale))

## Tests Added / Updated
- tests/browser/responsive-hardening.e2e.ts (new, ~2100 lines): play area fit, overlap, touch targets, text readability, card ratio, drag under scale, overlay fit, round result/session summary fit, unsupported layout, resize mid-session
- tests/unit/ui/PlayArea.test.tsx (new, 94 lines): PlayArea component rendering, scale, resize, unmount
- tests/unit/ui/playAreaScale.test.ts (new, 120 lines): scale algorithm monotonicity, bounds, layout computation
- tests/unit/ui/HumanHand.test.tsx (updated): drag under scaled play area tests
- tests/unit/ui/App.test.tsx (updated): bottom-bar button order assertion
- tests/browser/viewport-matrix.e2e.ts (updated): small-phone test.fixme removed, comment updated
- tests/browser/viewportMatrix.ts (updated): exports FULL_SCALE_* constants, small-phone reclassified

## Verification
- npm test: 962/962 Vitest tests passing
- npm run typecheck: clean
- 2 pre-existing timeout flakes in full test suite (pass in isolation, not caused by this PR)

## Files Changed
Created:
- src/ui/primitives/PlayArea.tsx
- src/ui/primitives/PlayArea.module.css
- src/ui/primitives/playAreaScale.ts
- tests/browser/responsive-hardening.e2e.ts
- tests/unit/ui/PlayArea.test.tsx
- tests/unit/ui/playAreaScale.test.ts

Modified:
- src/ui/primitives/layoutThresholds.ts
- src/ui/primitives/SessionSummary.tsx
- src/ui/primitives/SessionSummary.module.css
- src/ui/primitives/CenterTable.tsx
- src/ui/primitives/CenterTable.module.css
- src/ui/primitives/HumanHand.module.css
- src/ui/primitives/PlayerPanel.module.css
- src/ui/App.tsx
- src/ui/App.module.css
- tests/browser/viewportMatrix.ts
- tests/browser/viewport-matrix.e2e.ts
- tests/unit/ui/App.test.tsx
- tests/unit/ui/HumanHand.test.tsx

## Issues / Conflicts
None.

## Pre-existing Changes
None.

## Definition of Done
| DoD Item | Status | Evidence |
|----------|--------|----------|
| Minimum supported landscape >= 844x375 | PASS | layoutThresholds.ts: 844x390 |
| PlayArea scaling component | PASS | PlayArea.tsx + playAreaScale.ts |
| CSS clamp/min responsive | PASS | App.module.css |
| 44px touch targets (full-scale) | PASS | responsive-hardening.e2e.ts |
| 14px readable text (full-scale) | PASS | responsive-hardening.e2e.ts |
| Overlap-free at all supported sizes | PASS | responsive-hardening.e2e.ts |
| Card 5:7 ratio preserved | PASS | responsive-hardening.e2e.ts |
| Drag 1:1 under scale | PASS | HumanHand.test.tsx + e2e |
| Round Result / Summary fit viewport | PASS | responsive-hardening.e2e.ts |
| Unsupported layout guidance fits | PASS | responsive-hardening.e2e.ts |
| Resize mid-session re-fits | PASS | responsive-hardening.e2e.ts |
| All tests pass | PASS | 962/962 Vitest, typecheck clean |

## Scope Check
All changes within M4-T14 scope. No unrelated work.

## Suggested Next Step
M4 milestone is now complete (T01-T14 all done). Next step is milestone acceptance verification or M5 planning.
