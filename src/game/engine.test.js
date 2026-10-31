import { describe, expect, it } from 'vitest';
import {
  FLEET,
  canPlace,
  chooseAIShot,
  coordinate,
  emptyBoard,
  fire,
  gameReducer,
  hasLost,
  initialGame,
  isSunk,
  neighbors,
  placeShip,
  placementCells,
  randomBoard,
  remainingShips,
} from './engine.js';

function fixedBoard() {
  return FLEET.reduce(
    (board, ship, i) => placeShip(board, ship.id, i * 20, 'horizontal'),
    emptyBoard(),
  );
}
function battle() {
  return gameReducer(
    { ...initialGame(), player: fixedBoard() },
    { type: 'START', board: fixedBoard() },
  );
}
function almostSunk(board) {
  return {
    ...board,
    shots: Object.fromEntries(
      board.ships
        .flatMap((ship) => ship.cells)
        .slice(0, -1)
        .map((cell) => [cell, 'hit']),
    ),
  };
}
function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

describe('placement and boundaries', () => {
  it('uses standard fleet lengths and coordinates', () => {
    expect(FLEET.map((ship) => ship.length)).toEqual([5, 4, 3, 3, 2]);
    expect([coordinate(0), coordinate(9), coordinate(90), coordinate(99)]).toEqual([
      'A1',
      'A10',
      'J1',
      'J10',
    ]);
  });
  it.each([
    [0, 5, 'horizontal', [0, 1, 2, 3, 4]],
    [59, 5, 'vertical', [59, 69, 79, 89, 99]],
    [95, 5, 'horizontal', [95, 96, 97, 98, 99]],
    [6, 5, 'horizontal', null],
    [60, 5, 'vertical', null],
    [-1, 2, 'horizontal', null],
    [100, 2, 'vertical', null],
    [1.5, 2, 'horizontal', null],
    [0, 2, 'diagonal', null],
    [0, 0, 'horizontal', null],
    [0, 1.5, 'horizontal', null],
  ])('computes cells for %s, length %s, %s', (start, length, direction, expected) => {
    expect(placementCells(start, length, direction)).toEqual(expected);
  });
  it('prevents overlapping ships without mutating the board', () => {
    const board = placeShip(emptyBoard(), 'carrier', 0, 'horizontal');
    expect(canPlace(board, 'battleship', 2, 'vertical')).toBe(false);
    expect(placeShip(board, 'battleship', 2, 'vertical')).toBe(board);
    expect(board.ships).toHaveLength(1);
  });
  it('allows touching ships and moving a ship over its own old cells', () => {
    let board = placeShip(emptyBoard(), 'carrier', 0, 'horizontal');
    expect(canPlace(board, 'battleship', 10, 'horizontal')).toBe(true);
    board = placeShip(board, 'carrier', 1, 'horizontal');
    expect(board.ships).toHaveLength(1);
    expect(board.ships[0].cells).toEqual([1, 2, 3, 4, 5]);
  });
  it('rejects unknown ships and placement after shots have been fired', () => {
    const board = fixedBoard();
    expect(placeShip(board, 'invalid', 0, 'horizontal')).toBe(board);
    const shotBoard = fire(board, 99).board;
    expect(placeShip(shotBoard, 'carrier', 1, 'horizontal')).toBe(shotBoard);
  });
  it.each([0, 0.5, 0.9999])('random placement terminates with constant RNG %s', (value) => {
    const board = randomBoard(() => value);
    expect(board.ships).toHaveLength(5);
    expect(new Set(board.ships.flatMap((ship) => ship.cells)).size).toBe(17);
  });
  it('generates 300 valid non-overlapping fleets', () => {
    const rng = seededRandom(1234);
    for (let i = 0; i < 300; i++) {
      const board = randomBoard(rng);
      expect(board.ships.map((ship) => ship.length)).toEqual([5, 4, 3, 3, 2]);
      const cells = board.ships.flatMap((ship) => ship.cells);
      expect(new Set(cells).size).toBe(17);
      expect(cells.every((cell) => cell >= 0 && cell < 100)).toBe(true);
    }
  });
});

describe('shots, sinking, and fleet health', () => {
  it('distinguishes a hit and a miss without mutating the original', () => {
    const board = fixedBoard();
    expect(fire(board, 0).result).toBe('hit');
    expect(fire(board, 99).result).toBe('miss');
    expect(board.shots).toEqual({});
  });
  it.each([-1, 100, 0.5, NaN, undefined])('rejects invalid shot %s', (cell) => {
    expect(fire(fixedBoard(), cell)).toBeNull();
  });
  it('rejects duplicate hits and misses', () => {
    const board = fire(fire(fixedBoard(), 0).board, 99).board;
    expect(fire(board, 0)).toBeNull();
    expect(fire(board, 99)).toBeNull();
  });
  it('sinks a ship only after every cell is hit', () => {
    let board = fixedBoard();
    const destroyer = board.ships[4];
    const first = fire(board, 80);
    expect(first.sunk).toBeNull();
    expect(isSunk(first.board, destroyer)).toBe(false);
    const second = fire(first.board, 81);
    board = second.board;
    expect(second.sunk.id).toBe('destroyer');
    expect(isSunk(board, destroyer)).toBe(true);
    expect(remainingShips(board)).toBe(4);
    expect(hasLost(board)).toBe(false);
  });
  it('does not consider an empty fleet defeated', () => {
    expect(hasLost(emptyBoard())).toBe(false);
  });
  it('detects fleet destruction on the seventeenth ship cell', () => {
    const board = almostSunk(fixedBoard());
    expect(hasLost(board)).toBe(false);
    expect(hasLost(fire(board, 81).board)).toBe(true);
  });
});

describe('AI hunt and target behavior', () => {
  it('targets only orthogonal adjacent squares after a hit', () => {
    for (let seed = 0; seed < 30; seed++) {
      expect([34, 43, 45, 54]).toContain(chooseAIShot({ 44: 'hit' }, [44], seededRandom(seed)));
    }
  });
  it('prioritizes extending a confirmed horizontal line', () => {
    expect(chooseAIShot({ 44: 'hit', 45: 'hit' }, [44, 45], () => 0)).toBe(43);
    expect(chooseAIShot({ 44: 'hit', 45: 'hit', 43: 'miss' }, [44, 45], () => 0)).toBe(46);
  });
  it('prioritizes extending a confirmed vertical line', () => {
    expect(chooseAIShot({ 44: 'hit', 54: 'hit' }, [44, 54], () => 0)).toBe(34);
  });
  it('never wraps a horizontal target across a board boundary', () => {
    expect(neighbors(9)).toEqual([8, 19]);
    expect(neighbors(90)).toEqual([91, 80]);
    expect(chooseAIShot({ 8: 'hit', 9: 'hit', 7: 'miss' }, [8, 9], () => 0)).not.toBe(10);
    expect(chooseAIShot({ 9: 'hit', 10: 'hit' }, [9, 10], () => 0)).not.toBe(11);
  });
  it('returns to hunting when all neighbors of old hits are exhausted', () => {
    const shots = { 0: 'hit', 1: 'miss', 10: 'miss' };
    expect(chooseAIShot(shots, [0], () => 0)).toBe(2);
  });
  it('exhausts every cell without repeating and returns null on a full board', () => {
    const shots = {};
    const rng = seededRandom(5);
    for (let i = 0; i < 100; i++) {
      const cell = chooseAIShot(shots, [], rng);
      expect(shots).not.toHaveProperty(String(cell));
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThan(100);
      shots[cell] = 'miss';
    }
    expect(chooseAIShot(shots)).toBeNull();
  });
});

describe('turns, end conditions, and restart', () => {
  it('cannot start without the full player fleet', () => {
    const state = initialGame();
    expect(gameReducer(state, { type: 'START' })).toBe(state);
    expect(gameReducer(state, { type: 'PLAYER_FIRE', cell: 0 })).toBe(state);
  });
  it('lets the player start and alternates turns on hits and misses', () => {
    let state = battle();
    expect(state.turn).toBe('player');
    state = gameReducer(state, { type: 'PLAYER_FIRE', cell: 0 });
    expect(state.turn).toBe('ai');
    state = gameReducer(state, { type: 'AI_FIRE', cell: 99 });
    expect(state.turn).toBe('player');
    expect(state.round).toBe(2);
    state = gameReducer(state, { type: 'PLAYER_FIRE', cell: 99 });
    expect(state.turn).toBe('ai');
  });
  it('rejects out-of-turn and duplicate shots without consuming a turn', () => {
    let state = battle();
    expect(gameReducer(state, { type: 'AI_FIRE', cell: 1 })).toBe(state);
    state = gameReducer(state, { type: 'PLAYER_FIRE', cell: 0 });
    expect(gameReducer(state, { type: 'PLAYER_FIRE', cell: 1 })).toBe(state);
    state = gameReducer(state, { type: 'AI_FIRE', cell: 99 });
    expect(gameReducer(state, { type: 'PLAYER_FIRE', cell: 0 })).toBe(state);
  });
  it.each(['player', 'ai'])(
    'records %s hit, miss, and sinking events only for accepted shots',
    (who) => {
      const target = who === 'player' ? 'enemy' : 'player';
      const type = who === 'player' ? 'PLAYER_FIRE' : 'AI_FIRE';
      const state = { ...battle(), turn: who };
      const hit = gameReducer(state, { type, cell: 80 });
      expect(hit.lastShot).toEqual({ result: 'hit', sunk: false });
      expect(gameReducer(hit, { type, cell: 80 }).lastShot).toBe(hit.lastShot);
      const sunk = gameReducer({ ...hit, turn: who }, { type, cell: 81 });
      expect(sunk.lastShot).toEqual({ result: 'hit', sunk: true });
      expect(
        isSunk(
          sunk[target],
          sunk[target].ships.find((ship) => ship.id === 'destroyer'),
        ),
      ).toBe(true);
      expect(gameReducer(state, { type, cell: 99 }).lastShot).toEqual({
        result: 'miss',
        sunk: false,
      });
      expect(gameReducer(sunk, { type: 'NEW_GAME' }).lastShot).toBeNull();
    },
  );
  it('clears sunk AI target hits but preserves nearby hits from other ships', () => {
    const state = {
      ...battle(),
      turn: 'ai',
      player: { ...fixedBoard(), shots: { 80: 'hit', 60: 'hit' } },
      aiHits: [80, 60],
    };
    expect(gameReducer(state, { type: 'AI_FIRE', cell: 81 }).aiHits).toEqual([60]);
  });
  it.each(['player', 'ai'])('detects %s victory and prevents all further actions', (winner) => {
    const target = winner === 'player' ? 'enemy' : 'player';
    let state = { ...battle(), turn: winner, [target]: almostSunk(fixedBoard()) };
    state = gameReducer(state, { type: winner === 'player' ? 'PLAYER_FIRE' : 'AI_FIRE', cell: 81 });
    expect(state.phase).toBe('finished');
    expect(state.winner).toBe(winner);
    for (const type of ['PLAYER_FIRE', 'AI_FIRE', 'PLACE', 'CLEAR', 'START', 'RANDOMIZE']) {
      expect(gameReducer(state, { type, cell: 99 })).toBe(state);
    }
  });
  it.each(['setup', 'battle', 'finished'])(
    'restarts from %s with fresh independent state',
    (phase) => {
      const state = { ...battle(), phase, aiHits: [44], winner: 'player' };
      const next = gameReducer(state, { type: 'NEW_GAME' });
      expect(next).toEqual(initialGame());
      expect(next.player).not.toBe(state.player);
    },
  );
  it('clears and randomizes only during setup', () => {
    const setup = { ...initialGame(), player: fixedBoard() };
    expect(gameReducer(setup, { type: 'CLEAR' }).player.ships).toHaveLength(0);
    expect(
      gameReducer(initialGame(), { type: 'RANDOMIZE', board: fixedBoard() }).player.ships,
    ).toHaveLength(5);
    const state = battle();
    expect(gameReducer(state, { type: 'RANDOMIZE' })).toBe(state);
    expect(gameReducer(state, { type: 'CLEAR' })).toBe(state);
  });
  it('completes 100 seeded AI-vs-AI matches without duplicates or stuck turns', () => {
    for (let seed = 0; seed < 100; seed++) {
      const rng = seededRandom(seed);
      let state = gameReducer(
        { ...initialGame(), player: randomBoard(rng) },
        { type: 'START', board: randomBoard(rng) },
      );
      let playerHits = [];
      for (let i = 0; i < 200 && state.phase === 'battle'; i++) {
        const player = state.turn === 'player';
        const target = player ? 'enemy' : 'player';
        const cell = chooseAIShot(state[target].shots, player ? playerHits : state.aiHits, rng);
        expect(cell).not.toBeNull();
        expect(state[target].shots).not.toHaveProperty(String(cell));
        const shot = fire(state[target], cell);
        if (player)
          playerHits = shot.sunk
            ? playerHits.filter((hit) => !shot.sunk.cells.includes(hit))
            : shot.result === 'hit'
              ? [...playerHits, cell]
              : playerHits;
        state = gameReducer(state, { type: player ? 'PLAYER_FIRE' : 'AI_FIRE', cell });
      }
      expect(state.phase).toBe('finished');
      expect(['player', 'ai']).toContain(state.winner);
      expect(hasLost(state[state.winner === 'player' ? 'enemy' : 'player'])).toBe(true);
    }
  });
});
