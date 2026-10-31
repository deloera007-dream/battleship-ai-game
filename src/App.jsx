import { useEffect, useId, useReducer, useRef, useState } from 'react';
import {
  Anchor,
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Crosshair,
  Flag,
  Radar,
  RotateCw,
  Ship,
  Shuffle,
  Waves,
  X,
} from 'lucide-react';
import {
  FLEET,
  SIZE,
  canPlace,
  chooseAIShot,
  coordinate,
  gameReducer,
  initialGame,
  isSunk,
  placementCells,
  randomBoard,
  remainingShips,
} from './game/engine.js';

function ShipSilhouette({ length = 5, sunk = false }) {
  return (
    <span className={`ship-silhouette ${sunk ? 'is-sunk' : ''}`} aria-hidden="true">
      {Array.from({ length }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

function Board({ board, enemy = false, phase, turn, selected, direction, onPlace, onFire }) {
  const [hovered, setHovered] = useState(null);
  const [focus, setFocus] = useState(0);
  const cellRefs = useRef([]);
  const setup = phase === 'setup';
  const selectedShip = FLEET.find((ship) => ship.id === selected);
  const preview =
    !enemy && setup && hovered !== null
      ? placementCells(hovered, selectedShip.length, direction)
      : null;
  const previewValid = preview && canPlace(board, selected, hovered, direction);
  const available = enemy ? phase === 'battle' && turn === 'player' : setup;
  const shots = Object.keys(board.shots).length;
  const hits = Object.values(board.shots).filter((shot) => shot === 'hit').length;

  function navigate(event, cell) {
    const steps = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: SIZE,
      ArrowUp: -SIZE,
      Home: -(cell % SIZE),
      End: SIZE - 1 - (cell % SIZE),
    };
    if (!(event.key in steps)) return;
    event.preventDefault();
    const next = cell + steps[event.key];
    if (
      next < 0 ||
      next >= SIZE * SIZE ||
      (['ArrowRight', 'ArrowLeft'].includes(event.key) &&
        Math.floor(next / SIZE) !== Math.floor(cell / SIZE))
    )
      return;
    setFocus(next);
    cellRefs.current[next]?.focus();
  }

  return (
    <section
      className={`board-card ${enemy ? 'enemy-board' : 'player-board'}`}
      aria-label={enemy ? 'Enemy waters' : 'Your waters'}
    >
      <div className="board-heading">
        <div className="board-title">
          <span className={`icon-tile ${enemy ? 'coral' : ''}`}>
            {enemy ? <Crosshair size={20} /> : <Anchor size={20} />}
          </span>
          <div>
            <h2>{enemy ? 'Enemy waters' : 'Your waters'}</h2>
            <p>{enemy ? 'UNKNOWN TERRITORY' : 'HOME FLEET'}</p>
          </div>
        </div>
        <span className={`tag ${enemy && available ? 'tag-live' : ''}`}>
          {setup
            ? enemy
              ? 'STANDING BY'
              : 'DEPLOYMENT'
            : phase === 'finished'
              ? 'MISSION ENDED'
              : enemy && available
                ? 'FIRE AT WILL'
                : enemy
                  ? 'SCANNING'
                  : 'DEFEND'}
        </span>
      </div>
      <div className="board-area">
        <div
          className="board-grid"
          role="group"
          aria-label={`${enemy ? 'Enemy' : 'Your'} 10 by 10 board`}
          onMouseLeave={() => setHovered(null)}
        >
          <span className="axis-corner" aria-hidden="true">
            ⌖
          </span>
          {Array.from({ length: SIZE }, (_, i) => (
            <span className="axis" aria-hidden="true" key={`col-${i}`}>
              {i + 1}
            </span>
          ))}
          {Array.from({ length: SIZE }, (_, row) => (
            <div className="board-row" key={row}>
              <span className="axis" aria-hidden="true">
                {String.fromCharCode(65 + row)}
              </span>
              {Array.from({ length: SIZE }, (_, col) => {
                const cell = row * SIZE + col;
                const shot = board.shots[cell];
                const ship = board.ships.find((item) => item.cells.includes(cell));
                const sunk = ship && isSunk(board, ship);
                const visibleShip = ship && (!enemy || sunk || phase === 'finished');
                const inPreview = preview?.includes(cell);
                const status = sunk ? 'sunk' : shot || (visibleShip ? 'ship' : 'water');
                return (
                  <button
                    type="button"
                    key={cell}
                    ref={(node) => {
                      cellRefs.current[cell] = node;
                    }}
                    className={`cell ${status} ${visibleShip ? 'occupied' : ''} ${inPreview ? (previewValid ? 'preview-valid' : 'preview-invalid') : ''} ${!enemy && selected === ship?.id && setup ? 'selected-ship' : ''}`}
                    aria-label={`${enemy ? 'Enemy' : 'Your'} ${coordinate(cell)}: ${sunk ? `${ship.name} sunk` : shot || (visibleShip ? ship.name : 'water')}`}
                    aria-disabled={!available || Boolean(shot)}
                    tabIndex={focus === cell ? 0 : -1}
                    onFocus={() => {
                      setFocus(cell);
                      setHovered(cell);
                    }}
                    onMouseEnter={() => setHovered(cell)}
                    onKeyDown={(event) => navigate(event, cell)}
                    onClick={() => {
                      if (available && !shot) (enemy ? onFire : onPlace)(cell);
                    }}
                  >
                    {shot === 'miss' ? (
                      <span className="miss-mark" />
                    ) : shot === 'hit' ? (
                      <X className="hit-mark" size={19} strokeWidth={2.8} />
                    ) : visibleShip ? (
                      <span className="ship-core" />
                    ) : (
                      <span className="water-point" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {enemy && setup && (
          <div className="radar-overlay">
            <span className="radar-graphic">
              <Radar size={45} strokeWidth={1} />
            </span>
            <h3>
              The horizon is quiet.
              <br />
              For now.
            </h3>
            <p>
              Deploy your fleet to reveal
              <br />
              the battlefield.
            </p>
            <span className="radar-coordinate">SECTOR 07 / NORTH ATLANTIC</span>
          </div>
        )}
      </div>
      <div className="board-footer">
        <span>
          <i className="tiny-dot" />
          {setup
            ? enemy
              ? 'Enemy fleet concealed'
              : `${board.ships.length} of 5 ships deployed`
            : `${remainingShips(board)} ships afloat`}
        </span>
        <span>{setup ? '10 × 10 GRID' : `${hits} HITS / ${shots} SHOTS`}</span>
      </div>
    </section>
  );
}

function Modal({ title, children, onClose, className = '' }) {
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element.showModal();
    return () => {
      element.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className={`modal ${className}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button type="button" className="close-button" aria-label="Close dialog" onClick={onClose}>
        <X size={20} />
      </button>
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}

export default function App() {
  const [game, dispatch] = useReducer(gameReducer, undefined, initialGame);
  const [selected, setSelected] = useState(FLEET[0].id);
  const [direction, setDirection] = useState('horizontal');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(null);
  const setup = game.phase === 'setup';
  const finished = game.phase === 'finished';
  const ready = game.player.ships.length === FLEET.length;
  const isPlayerTurn = game.turn === 'player';

  useEffect(() => {
    if (game.phase !== 'battle' || game.turn !== 'ai') return;
    const timer = setTimeout(() => {
      const cell = chooseAIShot(game.player.shots, game.aiHits);
      if (cell !== null) dispatch({ type: 'AI_FIRE', cell });
    }, 650);
    return () => clearTimeout(timer);
  }, [game]);

  useEffect(() => {
    function rotate(event) {
      if (
        event.key.toLowerCase() === 'r' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        setup &&
        !modal &&
        !['INPUT', 'TEXTAREA'].includes(event.target.tagName)
      ) {
        event.preventDefault();
        setDirection((value) => (value === 'horizontal' ? 'vertical' : 'horizontal'));
      }
    }
    window.addEventListener('keydown', rotate);
    return () => window.removeEventListener('keydown', rotate);
  }, [setup, modal]);

  function place(cell) {
    if (!canPlace(game.player, selected, cell, direction)) {
      setNotice('That ship won’t fit. Keep it inside the grid and clear of other ships.');
      return;
    }
    dispatch({ type: 'PLACE', shipId: selected, cell, direction });
    setNotice(
      `${FLEET.find((ship) => ship.id === selected).name} deployed at ${coordinate(cell)}.`,
    );
    const next = FLEET.find(
      (ship) => ship.id !== selected && !game.player.ships.some((placed) => placed.id === ship.id),
    );
    if (next) setSelected(next.id);
  }

  function newGame() {
    dispatch({ type: 'NEW_GAME' });
    setSelected(FLEET[0].id);
    setDirection('horizontal');
    setNotice('');
    setModal(null);
  }

  const headline = setup
    ? 'A little strategy. A lot at stake.'
    : finished
      ? game.winner === 'player'
        ? 'The ocean is yours.'
        : 'A battle lost. A lesson earned.'
      : 'Trust your instincts. Take your shot.';
  const statusTitle = setup
    ? ready
      ? 'Fleet ready for departure'
      : 'First, position your fleet'
    : finished
      ? game.winner === 'player'
        ? 'Victory — enemy fleet destroyed'
        : 'Defeat — your fleet has been sunk'
      : isPlayerTurn
        ? 'Your turn. Pick a target.'
        : 'Opponent is plotting a course…';

  return (
    <>
      <header className="site-header">
        <a className="brand" href="./" aria-label="Fleet Command home">
          <span className="brand-icon">
            <Ship size={25} />
          </span>
          <span>
            FLEET<span className="brand-light">COMMAND</span>
            <small>THE CLASSIC. RECHARTED.</small>
          </span>
        </a>
        <div className="header-actions">
          <span className="offline-label">
            <i /> SOLO VS. AI
          </span>
          <button className="text-button" onClick={() => setModal('help')}>
            <CircleHelp size={17} />
            <span>How to play</span>
          </button>
        </div>
      </header>
      <main>
        <div className="intro">
          <div>
            <p className="eyebrow">
              <span /> NAVAL STRATEGY / EST. 1931
            </p>
            <h1>
              Outthink. <span>Outmaneuver.</span>
            </h1>
            <p className="intro-description">{headline}</p>
          </div>
          <button
            className="secondary-button new-game"
            onClick={() =>
              (setup && game.player.ships.length === 0) || finished
                ? newGame()
                : setModal('restart')
            }
          >
            <RotateCw size={16} />
            New game
          </button>
        </div>

        <div
          className={`mission-bar ${finished ? (game.winner === 'player' ? 'victory-bar' : 'defeat-bar') : ''}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="mission-icon">
            {setup ? (
              <Anchor size={22} />
            ) : finished ? (
              <Flag size={22} />
            ) : (
              <Crosshair size={22} className={!isPlayerTurn ? 'scanning-icon' : ''} />
            )}
          </div>
          <div className="mission-copy">
            <h2>{statusTitle}</h2>
            <p>
              {setup
                ? 'Select a ship, then click your waters to place it. Or let chance chart your course.'
                : finished
                  ? 'All ships revealed. Start a new game and chart a different course.'
                  : 'One shot per turn, hit or miss. Sink all five enemy ships to win.'}
            </p>
          </div>
          <div className="mission-step">
            {setup ? (
              <>
                <span className="step-number">01</span>
                <span>
                  DEPLOY
                  <br />
                  <b>YOUR FLEET</b>
                </span>
              </>
            ) : finished ? (
              <span>MISSION COMPLETE</span>
            ) : (
              <>
                <span className="step-number">{String(game.round).padStart(2, '0')}</span>
                <span>
                  ROUND
                  <br />
                  <b>{isPlayerTurn ? 'YOUR MOVE' : 'AI THINKING'}</b>
                </span>
              </>
            )}
          </div>
        </div>

        <div className="boards">
          <Board
            board={game.player}
            phase={game.phase}
            turn={game.turn}
            selected={selected}
            direction={direction}
            onPlace={place}
          />
          <Board
            board={game.enemy}
            enemy
            phase={game.phase}
            turn={game.turn}
            selected={selected}
            direction={direction}
            onFire={(cell) => dispatch({ type: 'PLAYER_FIRE', cell })}
          />
        </div>

        {setup ? (
          <section className="deployment-panel" aria-label="Fleet deployment">
            <div className="deployment-top">
              <div>
                <h2>
                  Your fleet <span>05 VESSELS</span>
                </h2>
                <p>
                  {ready
                    ? 'Select a deployed ship to reposition it.'
                    : 'Choose your ship. Find its place.'}
                </p>
              </div>
              <div className="placement-actions">
                <button
                  className="text-button"
                  onClick={() => {
                    dispatch({ type: 'CLEAR' });
                    setSelected(FLEET[0].id);
                    setNotice('Fleet cleared.');
                  }}
                >
                  Clear
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setDirection((value) => (value === 'horizontal' ? 'vertical' : 'horizontal'));
                    setNotice('');
                  }}
                >
                  <RotateCw size={15} />
                  {direction === 'horizontal' ? 'Horizontal' : 'Vertical'}
                  <kbd>R</kbd>
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    dispatch({ type: 'RANDOMIZE', board: randomBoard() });
                    setNotice('Fleet randomly deployed. Ready when you are.');
                  }}
                >
                  <Shuffle size={15} />
                  Randomize
                </button>
              </div>
            </div>
            <div className="fleet-selection">
              {FLEET.map((ship) => {
                const placed = game.player.ships.some((item) => item.id === ship.id);
                return (
                  <button
                    key={ship.id}
                    className={`ship-choice ${selected === ship.id ? 'chosen' : ''} ${placed ? 'deployed' : ''}`}
                    aria-pressed={selected === ship.id}
                    onClick={() => {
                      setSelected(ship.id);
                      setNotice('');
                    }}
                  >
                    <span className="ship-choice-top">
                      <span>{ship.name}</span>
                      <span>
                        {placed ? (
                          <Check size={14} aria-label="Deployed" />
                        ) : (
                          `${ship.length} cells`
                        )}
                      </span>
                    </span>
                    <ShipSilhouette length={ship.length} />
                  </button>
                );
              })}
            </div>
            <div className="deployment-bottom">
              <p
                className={notice.includes('won’t') ? 'notice error-notice' : 'notice'}
                role="status"
              >
                {notice || (
                  <>
                    <span className="tiny-dot" />
                    Ships may touch, but never overlap. Click a placed ship’s name to move it.
                  </>
                )}
              </p>
              <button
                className="primary-button"
                disabled={!ready}
                onClick={() => {
                  dispatch({ type: 'START', board: randomBoard() });
                  setNotice('');
                }}
              >
                Start battle
                <ArrowRight size={18} />
              </button>
            </div>
          </section>
        ) : (
          <section className="battle-panel" aria-label="Battle intelligence">
            <div className="fleet-status-panel">
              <h2>
                Fleet intelligence <span>YOU / ENEMY</span>
              </h2>
              <div className="fleet-status-list">
                {FLEET.map((ship) => {
                  const yours = game.player.ships.find((item) => item.id === ship.id);
                  const theirs = game.enemy.ships.find((item) => item.id === ship.id);
                  return (
                    <div className="fleet-status-row" key={ship.id}>
                      <span>
                        {ship.name}
                        <small>{ship.length}</small>
                      </span>
                      <ShipSilhouette length={ship.length} sunk={isSunk(game.player, yours)} />
                      <span
                        className={`fleet-dot ${isSunk(game.player, yours) ? 'lost' : ''}`}
                        aria-label={`Your ${ship.name}: ${isSunk(game.player, yours) ? 'sunk' : 'afloat'}`}
                      />
                      <span
                        className={`fleet-dot enemy-dot ${isSunk(game.enemy, theirs) ? 'lost' : ''}`}
                        aria-label={`Enemy ${ship.name}: ${isSunk(game.enemy, theirs) ? 'sunk' : 'afloat'}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="activity-panel">
              <h2>
                Captain’s log <span>LIVE FEED</span>
              </h2>
              <ol>
                {game.log.slice(0, 4).map((entry, i) => (
                  <li key={`${game.log.length}-${i}-${entry}`} className={i === 0 ? 'latest' : ''}>
                    <ChevronRight size={14} />
                    <span>{entry}</span>
                  </li>
                ))}
              </ol>
              <p className="activity-hint">
                {finished
                  ? 'Until the next voyage, Captain.'
                  : 'Patience is a weapon. Use it well.'}
              </p>
            </div>
          </section>
        )}

        <div className="legend">
          <div>
            <span>
              <i className="legend-ship" />
              Your ship
            </span>
            <span>
              <X size={14} className="legend-hit" />
              Hit
            </span>
            <span>
              <i className="legend-miss" />
              Miss
            </span>
            <span>
              <i className="legend-sunk" />
              Sunk
            </span>
          </div>
          <p>
            <Waves size={16} />
            Calm seas don’t make good captains.
          </p>
        </div>
      </main>
      <footer className="site-footer">
        <span>
          FLEET COMMAND <i>© {new Date().getFullYear()}</i>
        </span>
        <span>NO SIGN-UP. NO DISTRACTIONS. JUST STRATEGY.</span>
        <a
          href="https://github.com/deloera007-dream/battleship-ai-game"
          target="_blank"
          rel="noreferrer"
        >
          Open source
          <ArrowRight size={13} />
        </a>
      </footer>

      {modal === 'help' && (
        <Modal title="Welcome aboard, Captain." onClose={() => setModal(null)}>
          <p className="modal-intro">Two fleets. One ocean. Only one can remain.</p>
          <ol className="rules-list">
            <li>
              <b>Deploy your fleet</b>
              <p>
                Place five ships (5, 4, 3, 3, and 2 cells) in your waters. Select a ship and click
                its starting cell. Rotate with the button or R. Ships can touch but cannot overlap
                or leave the board. Randomize does it for you.
              </p>
            </li>
            <li>
              <b>Take your shot</b>
              <p>
                Start battle, then select a square in enemy waters. You and the AI alternate one
                shot per turn, even after a hit. A cross marks a hit; a dot marks a miss.
              </p>
            </li>
            <li>
              <b>Send them to the depths</b>
              <p>
                Hit every cell of a ship to sink it. Destroy all five enemy ships before they sink
                yours. The AI follows hits and never repeats a shot.
              </p>
            </li>
          </ol>
          <p className="keyboard-note">
            Keyboard: Tab to a board, arrow keys to navigate, Enter or Space to place / fire. Escape
            closes dialogs. Games stay in this tab; refreshing starts over.
          </p>
          <button className="primary-button" onClick={() => setModal(null)}>
            Ready, Captain
            <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {modal === 'restart' && (
        <Modal title="Chart a new course?" onClose={() => setModal(null)}>
          <p className="modal-intro">
            Your current game will be lost. Start fresh with an empty fleet?
          </p>
          <div className="modal-actions">
            <button className="secondary-button" onClick={() => setModal(null)}>
              Keep playing
            </button>
            <button className="primary-button" onClick={newGame}>
              New game
              <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
