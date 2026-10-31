# Fleet Command — Battleship

A responsive, single-player Battleship game built with **React, Vite, and JavaScript**. Deploy your fleet, read the ocean, and outmaneuver an AI captain. No accounts, API keys, tracking, or backend required. Fonts are bundled locally.

## Play

**Play now: https://deloera007-dream.github.io/battleship-ai-game/**

GitHub Pages is enabled and a complete game has been played on the public site without authentication. See [BUG_REPORT.md](./BUG_REPORT.md) for the release verification record and remaining coverage.

## Local development

Requires Node.js **22.12+** (Node **24 LTS** recommended) and npm. With nvm:

```sh
nvm install
nvm use
npm install
npm run dev
```

Open the local address printed by Vite. To serve the production build:

```sh
npm run build
npm run preview
```

## Rules and controls

- Place five ships of lengths **5, 4, 3, 3, and 2** on your 10×10 board.
- Select a ship, then click a starting square. Use **Horizontal / Vertical** or **R** to rotate. Select a deployed ship in the fleet panel to move it.
- Ships may touch, including at edges; they cannot overlap, wrap across rows, or leave the board.
- **Randomize** deploys a complete valid fleet; **Clear** removes all placements.
- **Start battle** unlocks only after all five ships are placed. You shoot first.
- Select an untried square in enemy waters. Both sides get **one shot per turn, even on a hit**.
- Crosses are hits; dots are misses. Fully hit ships turn rust red and are marked sunk in Fleet intelligence. Enemy positions remain hidden until sunk or the game ends.
- Sink the entire opposing fleet to win. After the result, both boards are locked and all ships are revealed.
- **New game** resets everything. An active game or existing deployment asks for confirmation first.
- **Keyboard:** Tab to a board; arrow keys move within it; Home / End move within a row; Enter / Space place or shoot. Escape dismisses dialogs.

## AI

The AI receives only its prior shots and unsunk hit coordinates—not unhit player ship locations. It hunts a checkerboard pattern, targets orthogonal neighbors after a hit, and prioritizes extending horizontal or vertical hit pairs. Sinking removes only that ship’s hit coordinates from its targeting memory, preserving unresolved hits on adjacent ships. Every candidate is in bounds and untried; if checkerboard cells are exhausted, it falls back to other untried cells. Random placement uses shuffled backtracking, so even a constant random source terminates.

## Architecture

```text
src/game/engine.js        Immutable board operations, AI targeting, game reducer
src/game/engine.test.js   Vitest engine and seeded simulation tests
src/App.jsx              React UI, placement controls, accessible board, dialogs
src/App.test.jsx         Component interaction and timer regression tests
src/styles.css           Responsive visual design and reduced-motion support
src/test/setup.js        DOM test environment
.github/workflows/       Automated checks and GitHub Pages deployment
```

The reducer is the authority for phase, turn, shots, winner, and restart. Invalid actions return the current state. The UI’s AI timer is cleaned up on turn changes, restart, and unmount to prevent delayed shots leaking into a new game. The browser contains no test-only routes or gameplay cheats.

## Quality checks

```sh
npm test                 # Vitest: engine + React interaction tests
npm run test:watch       # Watch mode
npm run lint             # ESLint and React hook rules
npm run format:check     # Prettier
npm run format           # Format source and documentation
npm audit                # Dependency security advisories
npm run build            # Production bundle
```

Tests cover boundaries, overlap, movement, hits, misses, duplicates, sinking, turn order, AI targeting, win/loss, restart, AI timer cancellation, keyboard navigation, **300 seeded random fleets**, and **100 complete seeded AI-vs-AI games**. Final executed counts and browser findings are recorded in [BUG_REPORT.md](./BUG_REPORT.md); that file distinguishes failures in test code from application defects.

## Deployment

### GitHub Pages (included)

1. In the repository’s **Settings → Pages**, choose **GitHub Actions** as the publishing source. This requires repository administration rights; the connected integration may not have them.
2. Push to the repository’s default branch, or run **Verify and deploy** from the Actions tab on that branch.
3. The workflow installs the lockfile, runs lint, formatting, tests, audit, and build, then uploads `dist/` and deploys it to the `github-pages` environment. Any configured environment approval must be granted by an authorized person.
4. Check the workflow’s deployment URL and play a game in a signed-out browser before treating the deployment as verified.

Vite uses a relative asset base (`./`), so the production output works under the repository subpath without custom routing. Never publish source files or `node_modules` as the site artifact.

### Vercel / Netlify / another static host

Import this repository, choose **Vite**, set install to `npm ci`, build to `npm run build`, and output to `dist`. No environment variables are needed. Deployment accounts are only for the site owner; visitors never need them. No SPA rewrite rules are needed because this game has no client-side routes.

## Scope and limitations

- Solo play against one AI difficulty; no multiplayer or cloud saves.
- Game state lives in memory. Reloading or closing the tab starts over; New game resets in place.
- Fair-play secrecy is visual, not cryptographic: a determined user can inspect a client-only game’s memory. This is not a competitive anti-cheat service.
- Modern browsers required (native `<dialog>`, CSS grid, ES modules). Mobile browsers use a stacked layout.
- No audio, ads, login, analytics, cookies, or paid services.
- JavaScript project: static checks are ESLint, not a TypeScript type-check step.

## License

MIT — see [LICENSE](./LICENSE).
