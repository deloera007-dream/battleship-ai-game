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

## B-003 — Dismissing a dialog lost keyboard focus

- **Discovered:** Public-site browser testing reproduced the Help dialog losing focus on Escape twice.
- **Reproduction:** Focus and activate **How to play**, then press Escape. The dialog disappears, but `document.activeElement` becomes `BODY` rather than the opening button. Regression tests also reproduced loss of focus after close-button/backdrop dismissal and restart confirmation.
- **Root cause:** The modal was conditionally unmounted while still open. Removing a native dialog is not equivalent to calling `close()`, so browser focus restoration did not run.
- **Fix:** Capture the opening focused element, close the native dialog during effect cleanup, and explicitly restore focus if the opening element is still connected.
- **Regression tests:** Four new component cases cover Escape's native cancel event, the close button, backdrop dismissal, and restart confirmation. All four failed before the fix and passed afterward. Public-site Chromium retesting passed for Help and New game on Escape, close button, backdrop, and action-button dismissal.

## B-004 — Icon-only mobile Help button lacked an accessible name

- **Discovered:** At a 390px viewport, the public-site browser test could not find the Help control by its accessible name.
- **Reproduction:** Open the site below the mobile breakpoint and inspect the header's Help button. Its visible text is hidden, and the remaining decorative icon does not name the button.
- **Root cause:** The mobile stylesheet uses `display: none` on the button's text span; no persistent programmatic label was provided.
- **Fix:** Add `aria-label="How to play"` directly to the button so it stays named at every viewport width.
- **Regression tests:** A component assertion requires the explicit label; it failed before the fix and passed afterward. Public-browser retesting passed at both 390px and 320px, including accessible naming and dismissal focus.

## Test-harness failures (not game bugs)

The first Vitest run exposed two overly broad queries in the new component tests. `/Carrier/` matched both the fleet selector and five occupied grid cells. `New game` matched both the page action and confirmation action because jsdom's dialog stub does not implement browser modal inertness. The queries were corrected to anchor the fleet selector and scope the confirmation action to its dialog. These failures did not demonstrate broken gameplay and are not counted as game defects.

## Automated checks executed

- **Vitest:** 71 tests passed across three files in the latest completed run. Coverage includes placement boundaries, overlap, touching ships, repositioning, hits/misses, invalid/duplicate shots, sinking, turn order, targeting and edge handling, victory/defeat, post-game locking, restart, AI timer cancellation, keyboard controls, dialog focus restoration, mobile Help labeling, 300 generated fleets, and 100 complete seeded simulations.
- **Sound coverage:** Reducer events and React integration verify player/AI hit and sink notifications, no duplicate/out-of-turn event, and mute controls. Web Audio tests cover short hit/long sinking envelopes, silent misses, lazy context creation, resume, immediate mute, cleanup, restart cancellation, and unavailable/blocked audio. These use mocks; actual browser output was separately captured and checked below.
- **ESLint:** Passed.
- **Prettier:** Passed.
- **Production build:** Passed.
- **Dependency audit:** 0 vulnerabilities after remediation.

## Browser verification

The first Chromium pass exercised the public GitHub Pages site without authentication through visible UI clicks, using normal random placement and visible hit/miss feedback, not hidden ship locations:

- Complete victory: 17 hits in 32 shots. The AI fired 31 unique shots; 12 non-sinking hits alternated turns correctly and eight adjacent-targeting checks passed.
- Manual 5/4/3/3/2 deployment, rotation by R/button, boundary/overlap rejection, repositioning, clear, randomize, and gated Start passed.
- Concealed enemy fleet, rapid extra-shot rejection, duplicate-shot rejection, sinking/fleet counts, terminal board locking, and finished-game reset passed.
- Arrow navigation and row-boundary handling passed. Dialog names and initial focus passed, but Escape exposed B-003 above.
- Retesting after the focus fix passed Help/New game focus restoration, restart cancellation/confirmation, and a restart completed before the 650ms AI timer. No pending shot leaked into the new match after 900ms.
- A second complete normal-random game reached defeat: the AI registered 17 hits across 40 unique shots, the player fleet reached zero afloat, and terminal boards locked.
- Mobile Chrome emulation at both 390px and 320px passed: named Help and sound controls, dismissal focus, header targets at least 40px, horizontal/vertical manual placement, clear/randomize, a complete player/AI turn, duplicate rejection, restart cancellation/confirmation, and no horizontal overflow.
- A full game with sound reached defeat after 43 turns. Seventeen adjacent-targeting checks passed; AI shots remained unique, fleets sank, and the terminal board locked.
- Actual system audio output was captured during that game: player 11 ordinary hits / 4 sinks, AI 12 ordinary hits / 5 sinks. Isolated samples distinguished short impacts from longer sinking sequences. All 84 isolated shot-signal checks matched audible hit/sink or silent miss expectations; two AI misses overlapping the prior sinking tail were excluded from silence checks.
- Duplicate-shot, muted-hit, and unmute-without-replay windows had zero captured signal. Restart confirmed 462ms after a sinking shot cut its remaining sound tail, canceled pending AI, and reset to empty setup while preserving the sound setting.
- The requested **Captain Ignacio** board rename still needs deployment and a final browser smoke. Gameplay and audio behavior are unchanged by that text-only edit.

## Deployment verification

- Public repository creation and source push succeeded.
- GitHub initially rejected the integration's request to enable Pages with **HTTP 403: Resource not accessible by integration**. The subsequent GitHub Actions deployment succeeded, and Pages now reports a workflow publishing source. No further owner action is needed.
- The public [game URL](https://deloera007-dream.github.io/battleship-ai-game/) and its production assets returned HTTP 200, without authentication. A complete signed-out browser victory was verified there.
- The B-003/B-004 fixes and sound effects were deployed and passed signed-out browser retesting. The Captain Ignacio rename is awaiting deployment verification.

## Known remaining issues / scope

- No known gameplay or sound defects from completed automated and browser checks. Final renamed-deployment smoke is pending.
- This is a client-only, single-player game. Refreshing discards the current match. There is no multiplayer, saved progress, or configurable difficulty.
- Browser support requires modern native dialogs, CSS grid, JavaScript modules, and Web Audio for sound. Testing used Chromium desktop and mobile emulation; physical devices and other browsers were not tested.
- Browser tests did not exercise muting during an actively playing clip or unavailable/blocked Web Audio. Immediate mute and graceful audio fallback are covered by automated tests.
