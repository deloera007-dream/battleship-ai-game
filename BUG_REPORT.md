# Bug report and release verification

This file records observed problems only. A passing unit test is not evidence of browser testing or a successful public deployment.

## Follow-up bug hunt

Two additional defects were reproduced on the public site and clean local build. Their fixes are in this follow-up branch; the published site remains unchanged until the PR is merged and deployed.

| ID    | Confirmed bug                                                 | Fix                                                                 |
| ----- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| B-005 | Clicking interior dialog padding dismisses Help/restart       | Dismiss only when pointer coordinates are outside the dialog bounds |
| B-006 | Interrupted audio stays silent after another shot or unmuting | Resume both suspended and interrupted audio contexts                |

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

## B-005 — Interior dialog padding was treated as backdrop

- **Discovered:** Targeted browser testing reproduced accidental dismissal in all eight combinations of Help/restart, public/local, and 1280px/390px viewports.
- **Reproduction:** Open Help, or Randomize followed by New game. Click blank padding about 8px inside the dialog's left edge, halfway down. The dialog closes even though the pointer is inside it. Restart dismissal preserves the fleet; it does not reset destructively.
- **Root cause:** Native backdrop clicks target the dialog, but clicks on the dialog's own padding do too. The handler only checked `event.target === event.currentTarget`.
- **Fix:** Ignore child-content clicks, then check the click's client coordinates against the dialog's bounding rectangle. Only coordinates outside that rectangle dismiss it.
- **Regression tests:** Two component cases (Help/restart) failed before the fix. They now require interior padding to remain open and an outside click to dismiss. The existing backdrop-focus test now supplies realistic geometry, since jsdom has no layout.
- **Browser retest:** Passed against the built production output at 1280px, 390px, and 320px for both dialogs. Interior padding/title/content clicks stay open; outside-backdrop, Escape, close-button, and action-button dismissal restore trigger focus. Cancellation preserves the fleet; confirmation resets it. This verifies the local fix, not a new public deployment.

## B-006 — Interrupted audio could not recover

- **Discovered:** Browser fault injection around a real native AudioContext reproduced silence on public/local builds. This simulates a documented lifecycle state; no physical iOS Safari result is claimed.
- **Reproduction:** Start a battle, suspend the underlying native context, and expose its state as `interrupted` until `resume()` is called. Fire normally until a visible hit, then mute/unmute. The old implementation makes zero native resume calls and starts zero oscillators. Captured interrupted-hit RMS was 0.00000; a suspended-state control resumed and produced RMS 0.01360.
- **Root cause:** `unlock()` resumed only `suspended` contexts. Safari may report `interrupted` after leaving a page, switching tabs, or locking the screen; later interactions never attempted recovery from that state.
- **Fix:** Call `resume()` for either `suspended` or `interrupted`, using the existing user-gesture activation, queued playback, rejection handling, and mute/reset cancellation.
- **Regression tests:** Parameterize the deferred-resume test for both states. The new interrupted case failed before the fix and passes afterward; existing rejection, mute, stop, and disposal tests remain in place.
- **Reference:** [MDN BaseAudioContext.state — resuming interrupted audio in iOS Safari](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state).
- **Browser retest:** Passed against the built production output. Injected interruption recovered through the next valid shot and mute/unmute; native resume counts increased and exposed/native states became running. The suspended-state control also passed. Captured hit RMS was about 0.01756 after each recovery path; unmute-without-replay windows were zero. Muting 94ms after a sinking shot stopped its tail; muted-AI and later unmute windows were zero. Physical Safari lifecycle behavior remains untested.

## Test-harness failures (not game bugs)

The first Vitest run exposed two overly broad queries in the new component tests. `/Carrier/` matched both the fleet selector and five occupied grid cells. `New game` matched both the page action and confirmation action because jsdom's dialog stub does not implement browser modal inertness. The queries were corrected to anchor the fleet selector and scope the confirmation action to its dialog. These failures did not demonstrate broken gameplay and are not counted as game defects.

## Follow-up automated checks executed

- **Vitest:** 74 tests passed across three files. The three new cases failed before the fixes (two dialog cases and interrupted resume); the suspended-resume control passed before and afterward.
- **ESLint, Prettier, production build:** Passed.
- **Dependency audit:** 0 vulnerabilities.
- **Browser retesting:** Passed on the built production output (`index-C3BL7hb7.js`). B-005/B-006 checks are detailed above. At 320px, keyboard navigation/rotation/placement, modal shortcut isolation, turn locks, duplicate rejection, and layout passed. Restart confirmed 384ms after firing prevented a pending AI shot. Missing and throwing Web Audio fallbacks remained playable without page errors/unhandled rejections. Complete games and a full uninterrupted sinking sequence were not repeated in this focused follow-up; previous release evidence is retained below.

## Original release automated checks

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
- Final signed-out smoke of the renamed deployment passed **Captain Ignacio** heading/region and board group at desktop, 390px, and 320px, plus deployment/start/fire/AI response/duplicate rejection/reset. Both 100-cell boards remained playable with no horizontal overflow.
- Active mute passed with actual PCM output: mute was activated 71ms after a sinking shot; impact RMS was 0.02538, while the remaining tail, muted-AI, and unmute-without-replay windows were zero. A separate restart confirmed in 246ms canceled pending AI.
- Unavailable-audio fallback passed using browser fault injection: disabling both `AudioContext` constructors before initialization still allowed a hit, AI response, Help, Sound controls, and reset without page errors. No production test-only code was added.

## Original release deployment verification

- Public repository creation and source push succeeded.
- GitHub initially rejected the integration's request to enable Pages with **HTTP 403: Resource not accessible by integration**. The subsequent GitHub Actions deployment succeeded, and Pages now reports a workflow publishing source. No further owner action is needed.
- The public [game URL](https://deloera007-dream.github.io/battleship-ai-game/) and its production assets returned HTTP 200, without authentication. A complete signed-out browser victory was verified there.
- The B-003/B-004 fixes, sound effects, and Captain Ignacio rename were deployed and passed signed-out browser retesting. Final application assets were `index-p3JcWVrg.js` and `index-4cQhA7BI.css`; both verification and deployment jobs passed.

## Known remaining issues / scope

- B-005/B-006 are fixed in this follow-up branch but remain in the published site until merge and deployment. The original four application/tooling findings were fixed and regression checked in the previous release.
- This is a client-only, single-player game. Refreshing discards the current match. There is no multiplayer, saved progress, or configurable difficulty.
- Browser support requires modern native dialogs, CSS grid, JavaScript modules, and Web Audio for sound. Testing used Chromium desktop and mobile emulation; physical devices and other browsers were not tested.
- Browser-specific autoplay blocking was not tested on physical devices or other browsers. Rejected audio activation is covered by automated tests; browsers without Web Audio were exercised with fault injection. Actual-output capture verified audio signals, not a physical device's speaker volume or silent-mode behavior.
