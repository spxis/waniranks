# Manual Behavior Matrix Pass - 2026-04-13

Scope:
- Post-refactor behavior verification for leaderboard and user explorer flows.
- Environment: local dev server on Node v24.14.1.
- Nickname used for checks: johnmorrisdotca.

Legend:
- PASS (Automated): verified by deterministic local route/API checks.
- NEEDS MANUAL: requires interactive browser behavior that cannot be proven via static HTTP checks.
- EXPECTED AUTH: protected endpoint returned 401 as designed.

## Matrix Results

| Area | Scenario | Expected Result | Result | Notes |
| --- | --- | --- | --- | --- |
| Level Explorer URL | Open deep link with tab, levels, subject, srs, type, jlpt, review, sticky | Route resolves and loads explorer shell | PASS (Automated) | GET /users/johnmorrisdotca?tab=level&levels=17&srs=guru&type=kanji&jlpt=n3&review=next24h&sticky=1&subject=389 returned 200 |
| Level Explorer History | Change filters, then browser Back/Forward | State restores in sequence | NEEDS MANUAL | Browser history stack behavior is interactive-only |
| Level Explorer Persistence | Set filters, reload page | Persisted filters rehydrate unless URL overrides | NEEDS MANUAL | localStorage rehydration is client-runtime behavior |
| Level Explorer Search | Trigger search from shared bar, clear query | Results and selection update consistently | NEEDS MANUAL | Requires event dispatch + UI updates in browser runtime |
| Level Detail Placement | Select cards across responsive columns | Detail panel inserts at correct row boundary | NEEDS MANUAL | Requires card selection and viewport resizing |
| Related Navigation | Jump via related links | Target level/item selected and visible | NEEDS MANUAL | Requires interactive click and selection state |
| JLPT URL | Open deep link with tab/findJlpt/jlptKanji | Route resolves and loads user page | PASS (Automated) | GET /users/johnmorrisdotca?tab=jlpt&findJlpt=%E6%9C%88&jlptKanji=123 returned 200 |
| JLPT Search Events | Switch tabs with active query | Correct scope receives event | NEEDS MANUAL | Requires cross-tab client event flow |
| Leaderboard Expansion | Expand/collapse rows, refresh page | Expanded state persists for valid rows | NEEDS MANUAL | Requires row interaction and persisted UI state check |
| Leaderboard Panels | Toggle spread/progress panels | Open/closed state persists | NEEDS MANUAL | Requires interactive toggles and reload verification |
| Leaderboard Mobile/Desktop | Validate same account on both widths | Data parity across layouts | NEEDS MANUAL | Requires interactive viewport rendering checks |

## Supporting Automated Checks

Routes:
- GET / => 200
- GET /users/johnmorrisdotca => 200
- GET level deep link => 200
- GET jlpt deep link => 200

APIs:
- GET /api/leaderboard => 200
- GET /api/accounts/cmnk100xl0000ie04n3bfbgy8/levels/17 => 200
- GET /api/accounts => 401 (EXPECTED AUTH)
- GET /api/accounts/cmnk100xl0000ie04n3bfbgy8/live => 401 (EXPECTED AUTH)

Auth expectation sources:
- src/app/api/accounts/route.ts
- src/app/api/accounts/[id]/live/route.ts

## Conclusion

Safe non-interactive pass is complete and shows no route-level regressions in the verified paths.
A full manual behavior matrix pass still requires one interactive browser session to validate stateful UI behaviors (history, localStorage hydration, cross-tab events, responsive insertion, and persistence toggles).
