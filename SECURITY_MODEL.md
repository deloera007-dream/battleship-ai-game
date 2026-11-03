# Fleet Command — Battleship: threat model

## Scope and evidence

- Repository: `deloera007-dream/battleship-ai-game`, whole repository. Review this model when architecture, data handling, dependencies or deployment boundaries change.
- Sources: `README.md` (Architecture, Deployment, Scope and limitations), `src/main.jsx`, `src/App.jsx`, `src/game/engine.js`, `src/game/audio.js`, `package.json`, `package-lock.json`, `vite.config.js`, and `.github/workflows/verify.yml`.
- The owner confirmed there is no additional infrastructure repository and that the included GitHub Pages workflow is the infrastructure scope. Hosting/account settings outside the repository have not been verified.
- Distinguish documented project facts and owner-confirmed priorities from inferred assumptions. Unverified assumptions are not approval to lower finding priorities.

## System and components

A public single-player browser game, documented as requiring no accounts, API keys, tracking, or backend. React renders the application, the in-memory reducer owns match state, and Web Audio synthesizes sounds locally. Node/npm builds static output that GitHub Actions publishes to GitHub Pages.

| Stable component       | Code covered                                                                                        | Responsibility and boundary                                                                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Web Client             | `index.html`, `src/main.jsx`, `src/App.jsx`, `src/styles.css`, `public/`                            | Public document, assets, UI events and DOM rendering; downloaded code runs in a visitor's browser origin.                                                                      |
| Game Runtime           | `src/game/engine.js`, `src/game/audio.js`                                                           | In-memory rules/AI and local audio. This shares the Web Client's browser trust boundary, not a separate trusted server.                                                        |
| Build and Supply Chain | `package.json`, `package-lock.json`, `vite.config.js`, `eslint.config.js`, test/configuration files | npm packages, toolchain and executable build/test scripts run on developer machines or CI; dependencies and contributions cross into build execution and the delivered bundle. |
| Static Delivery        | `.github/workflows/verify.yml`, deployment guidance in `README.md`                                  | CI artifact publication and Pages deployment cross from repository/build output to the public site. Platform settings and account controls are outside available code.         |

## Entry points and reachability

- Anyone can load the documented public Pages site and interact through placement, firing, keyboard controls, dialogs and audio toggles. No application server, authentication service, multiplayer API, cloud save, or user-upload feature is documented.
- Local browser actions and developer tools can inspect or modify that player's own state; the browser is not a confidentiality boundary against its owner.
- Contributors can submit pull requests; pushes, pull requests and manual workflow dispatch trigger verification. Dependency installation and third-party Actions execute in CI.
- Vite development/preview scripts bind to `0.0.0.0`. They are development tools, not the documented production hosting architecture; actual network exposure is unknown.

## Assets and sensitivity

- Visitor browser/origin integrity and delivery of uncompromised executable assets; malicious releases could affect visitors even without account data.
- Repository, build artifacts, deployment identity and release integrity. CI/deployment credentials are security-sensitive if reachable through an actual finding; no values are recorded here.
- Developer/CI environments executing npm packages and build scripts.
- Match state, fleet positions and mute setting are transient local data. README states no accounts, cookies, analytics or persistent/cloud player saves. No regulated or high-sensitivity player dataset is identified; that is not proof that every future input is harmless.

## Relevant attackers

- Public unauthenticated visitors attempting to affect other visitors or delivered content.
- Malicious contributors/pull-request authors and compromised dependency or Action maintainers attempting build/release compromise.
- Attackers with access to exposed development tooling, if the finding establishes that exposure.
- A player inspecting or changing their own local match, distinguished from a cross-user or supply-chain compromise.
- Compromised maintainer/platform accounts are possible contextual actors; platform protection and credential policies are unknown, not assumed absent or accepted as risk.

## Existing controls observed in code/docs

- React declarative rendering and bounded board/reducer operations; invalid actions are rejected. These are application controls, not server-side authorization.
- The AI interface takes prior shots and unresolved hits rather than unhit fleet coordinates; this supports normal fair play, not cryptographic secrecy.
- Audio and fonts are local; README documents no remote audio or analytics service.
- CI uses `npm ci`, lint, formatting, tests, `npm audit --audit-level=moderate`, and production build before artifact publication. Passing checks is not evidence that dependencies are vulnerability-free.
- Workflow defaults to `contents: read`; the deploy job alone requests `pages: write` and `id-token: write`. Publication/deployment is limited in the YAML to non-PR runs on the default branch; deployment requires successful verification and uses the `github-pages` environment. Actual environment approvals, branch protections and repository settings are unverified.
- Only `dist/` is configured as the Pages artifact. Vite uses a relative asset base.

## Accepted risk and prioritization provenance

- Project-authored `README.md`, Scope and limitations, explicitly says fleet secrecy is visual rather than cryptographic and that this is not a competitive anti-cheat service. A finding limited to a player inspecting their own in-memory fleet/state may therefore be accepted risk. This does not cover script execution affecting other users, malicious releases, or credential compromise.
- README documents intentional single-player, in-memory gameplay; lack of multiplayer authentication or persistent saves is not by itself a missing control for an existing backend.
- Owner-confirmed priority: protect visitors and release integrity, with no additional critical assets or accepted risks. This does not by itself raise findings: the scanner's assessment stands unless a specific confirmed threat-model fact warrants a change. Inferences in this document alone must not change scanner severity.
- Start with the scanner's exploitability and impact assessment. Change priority only for an explicit user statement, a selected profile's policy, or the project's own documented security assumptions. Hard-to-exploit/unverified findings are never raised merely for asset importance.

## Finding tags

- `Component`: one of Web Client, Game Runtime, Build and Supply Chain, Static Delivery, determined from the finding's root-cause location.
- `CVE`: an exact published CVE identifier only when applicable; never invent one.
- The owner selected Component and CVE, when applicable. Do not fabricate an owner or regulatory obligation.

## Open questions and limits

The owner confirmed the priorities above: protect visitors and release integrity; no additional critical assets or accepted risks; no additional infrastructure repository; Component and CVE tags only.

GitHub account security, branch/environment protection, host response headers and actual dev-server network exposure are not established by repository configuration. Treat them as unknown rather than assuming an exploitable deployment or a mitigating control. Preserve scanner severity when no user-provided fact supports a change.
