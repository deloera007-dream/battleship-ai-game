# Bug report and release verification

This file records observed problems only. A passing unit test is not evidence of browser testing or a successful public deployment.

## B-001 — Vulnerable development-tool dependency tree

- **Discovered:** Running `npm audit` immediately after the initial dependency installation reported **9 vulnerabilities: 7 moderate and 2 critical**.
- **Reproduction:** Install the original toolchain from the first source commit and run `npm audit`. The report names `vitest`, `tinypool`, `@vitest/mocker`, and `minimatch`, with vulnerabilities propagated into the lint dependency tree.
- **Root cause:** The initially selected older Vitest and lint toolchain pulled versions with published worker-option prototype-pollution / RCE, mock path-traversal / injection, and glob denial-of-service advisories. These are build/development dependencies, not shipped gameplay APIs; they are still inappropriate for a production project's toolchain.
- **Fix:** Upgrade Vitest to the patched 5.0.5 release line and use compatible current Vite, React plugin, ESLint, hook plugin, and related tooling. Override transitive `minimatch` to patched `^11.0.1` because the lint dependency range still admitted vulnerable versions. Reinstall the lockfile and exercise lint, tests, and build with that override.
- **Regression protection:** CI runs `npm audit --audit-level=moderate` and stops before deployment on an advisory failure. The final local audit currently reports **0 vulnerabilities**.
- **References:** [Tinypool worker options](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3), [Vitest mock traversal](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), [minimatch amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249).

## B-002 — Dialogs lacked accessible names

- **Discovered:** Accessibility review of the implemented dialog showed that its visible heading was not programmatically associated with the native `dialog` element.
- **Reproduction:** Open How to play or New game confirmation and inspect the dialog's accessible name. Before the fix it was empty despite a visible heading.
- **Root cause:** A heading alone does not label its containing dialog in the accessibility tree.
- **Fix:** Generate a unique heading ID with React `useId` and reference it through `aria-labelledby` on the dialog.
- **Regression tests:** Component tests query the dialogs by the accessible names `Welcome aboard, Captain.` and `Chart a new course?`.

## Test-harness failures (not game bugs)

The first Vitest run exposed two overly broad queries in the new component tests. `/Carrier/` matched both the fleet selector and five occupied grid cells. `New game` matched both the page action and confirmation action because jsdom's dialog stub does not implement browser modal inertness. The queries were corrected to anchor the fleet selector and scope the confirmation action to its dialog. These failures did not demonstrate broken gameplay and are not counted as game defects.

## Automated checks executed

- **Vitest:** 53 tests passed across two files in the latest completed run. Coverage includes placement boundaries, overlap, touching ships, repositioning, hits/misses, invalid/duplicate shots, sinking, turn order, targeting and edge handling, victory/defeat, post-game locking, restart, AI timer cancellation, keyboard controls, 300 generated fleets, and 100 complete seeded simulations.
- **ESLint:** Passed.
- **Prettier:** Passed.
- **Production build:** Passed.
- **Dependency audit:** 0 vulnerabilities after remediation.

## Browser verification

Pending. Complete browser games and responsive checks have not yet been run. This section will be replaced with observed results after the browser test pass.

## Deployment verification

- Public repository creation and source push succeeded.
- GitHub rejected the integration's request to enable Pages with **HTTP 403: Resource not accessible by integration**.
- A GitHub Pages workflow is included. Repository owner action is needed in **Settings → Pages → Source → GitHub Actions** before deployment can be treated as complete.
- Public website availability and signed-out gameplay are **not yet verified**.

## Known remaining issues / scope

- No known gameplay defects from automated checks so far; browser verification is still pending.
- Deployment is pending repository-owner Pages authorization, not a gameplay fix.
- This is a client-only, single-player game. Refreshing discards the current match. There is no multiplayer, saved progress, or configurable difficulty.
- Browser support requires modern native dialogs, CSS grid, and JavaScript modules. Cross-browser / real-device coverage has not yet been performed.
