export const SIZE = 10;
export const FLEET = Object.freeze([
  { id: 'carrier', name: 'Carrier', length: 5 },
  { id: 'battleship', name: 'Battleship', length: 4 },
  { id: 'cruiser', name: 'Cruiser', length: 3 },
  { id: 'submarine', name: 'Submarine', length: 3 },
  { id: 'destroyer', name: 'Destroyer', length: 2 },
]);

export const coordinate = (cell) =>
  `${String.fromCharCode(65 + Math.floor(cell / SIZE))}${(cell % SIZE) + 1}`;
export const validCell = (cell) => Number.isInteger(cell) && cell >= 0 && cell < SIZE * SIZE;
export const emptyBoard = () => ({ ships: [], shots: {} });

export function placementCells(start, length, direction) {
  if (
    !validCell(start) ||
    !Number.isInteger(length) ||
    length < 1 ||
    !['horizontal', 'vertical'].includes(direction)
  )
    return null;
  const row = Math.floor(start / SIZE);
  const col = start % SIZE;
  if ((direction === 'horizontal' ? col : row) + length > SIZE) return null;
  return Array.from({ length }, (_, i) => start + i * (direction === 'horizontal' ? 1 : SIZE));
}

export function canPlace(board, shipId, start, direction) {
  const ship = FLEET.find((item) => item.id === shipId);
  if (!ship) return false;
  const cells = placementCells(start, ship.length, direction);
  return (
    cells !== null &&
    !board.ships.some(
      (other) => other.id !== shipId && other.cells.some((cell) => cells.includes(cell)),
    )
  );
}

export function placeShip(board, shipId, start, direction) {
  if (Object.keys(board.shots).length || !canPlace(board, shipId, start, direction)) return board;
  const ship = FLEET.find((item) => item.id === shipId);
  return {
    ...board,
    ships: [
      ...board.ships.filter((item) => item.id !== shipId),
      { ...ship, cells: placementCells(start, ship.length, direction) },
    ],
  };
}

function shuffled(items, rng) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function randomBoard(rng = Math.random) {
  // Shuffled backtracking guarantees termination even with a constant RNG.
  function fill(board, index) {
    if (index === FLEET.length) return board;
    const placements = Array.from({ length: SIZE * SIZE * 2 }, (_, i) => ({
      start: i % 100,
      direction: i < 100 ? 'horizontal' : 'vertical',
    }));
    for (const { start, direction } of shuffled(placements, rng)) {
      if (!canPlace(board, FLEET[index].id, start, direction)) continue;
      const result = fill(placeShip(board, FLEET[index].id, start, direction), index + 1);
      if (result) return result;
    }
    return null;
  }
  return fill(emptyBoard(), 0);
}

export const isSunk = (board, ship) => ship.cells.every((cell) => board.shots[cell] === 'hit');
export const remainingShips = (board) => board.ships.filter((ship) => !isSunk(board, ship)).length;
export const hasLost = (board) =>
  board.ships.length === FLEET.length && remainingShips(board) === 0;

export function fire(board, cell) {
  if (!validCell(cell) || Object.hasOwn(board.shots, cell)) return null;
  const ship = board.ships.find((item) => item.cells.includes(cell));
  const result = ship ? 'hit' : 'miss';
  const next = { ...board, shots: { ...board.shots, [cell]: result } };
  const sunk = ship && isSunk(next, ship) ? ship : null;
  return { board: next, result, sunk };
}

export function neighbors(cell) {
  if (!validCell(cell)) return [];
  return [
    cell % SIZE > 0 ? cell - 1 : -1,
    cell % SIZE < SIZE - 1 ? cell + 1 : -1,
    cell - SIZE,
    cell + SIZE,
  ].filter(validCell);
}

export function chooseAIShot(shots, unresolvedHits = [], rng = Math.random) {
  const available = (cell) => validCell(cell) && !Object.hasOwn(shots, cell);
  const hits = unresolvedHits.filter((cell) => shots[cell] === 'hit');
  const aligned = [];
  for (const cell of hits) {
    for (const other of hits) {
      if (other === cell + 1 && Math.floor(cell / SIZE) === Math.floor(other / SIZE)) {
        if (cell % SIZE > 0) aligned.push(cell - 1);
        if (other % SIZE < SIZE - 1) aligned.push(other + 1);
      }
      if (other === cell + SIZE) aligned.push(cell - SIZE, other + SIZE);
    }
  }
  const targets = [...new Set(aligned.filter(available))];
  const adjacent = [...new Set(hits.flatMap(neighbors).filter(available))];
  const unshot = Array.from({ length: SIZE * SIZE }, (_, cell) => cell).filter(available);
  const parity = unshot.filter((cell) => (Math.floor(cell / SIZE) + (cell % SIZE)) % 2 === 0);
  const pool = targets.length
    ? targets
    : adjacent.length
      ? adjacent
      : parity.length
        ? parity
        : unshot;
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
}

export const initialGame = () => ({
  phase: 'setup',
  turn: 'player',
  player: emptyBoard(),
  enemy: emptyBoard(),
  aiHits: [],
  winner: null,
  log: [],
  round: 1,
  lastShot: null,
});

function shotMessage(who, cell, result, sunk) {
  return `${who} → ${coordinate(cell)}. ${sunk ? `${sunk.name} sunk!` : result === 'hit' ? 'Direct hit!' : 'Miss.'}`;
}

export function gameReducer(state, action) {
  if (action.type === 'NEW_GAME') return initialGame();
  if (state.phase === 'setup') {
    if (action.type === 'PLACE')
      return {
        ...state,
        player: placeShip(state.player, action.shipId, action.cell, action.direction),
      };
    if (action.type === 'RANDOMIZE') return { ...state, player: action.board ?? randomBoard() };
    if (action.type === 'CLEAR') return { ...state, player: emptyBoard() };
    if (action.type === 'START' && state.player.ships.length === FLEET.length) {
      return {
        ...state,
        phase: 'battle',
        enemy: action.board ?? randomBoard(),
        log: ['All stations ready. You have the first shot.'],
      };
    }
    return state;
  }
  if (state.phase !== 'battle') return state;
  const playerTurn = state.turn === 'player';
  if (action.type !== (playerTurn ? 'PLAYER_FIRE' : 'AI_FIRE')) return state;
  const target = playerTurn ? 'enemy' : 'player';
  const shot = fire(state[target], action.cell);
  if (!shot) return state;
  const won = hasLost(shot.board);
  const aiHits = playerTurn
    ? state.aiHits
    : shot.sunk
      ? state.aiHits.filter((cell) => !shot.sunk.cells.includes(cell))
      : shot.result === 'hit'
        ? [...state.aiHits, action.cell]
        : state.aiHits;
  return {
    ...state,
    [target]: shot.board,
    aiHits,
    phase: won ? 'finished' : 'battle',
    winner: won ? state.turn : null,
    turn: won ? state.turn : playerTurn ? 'ai' : 'player',
    round: state.round + (playerTurn ? 0 : 1),
    lastShot: { result: shot.result, sunk: Boolean(shot.sunk) },
    log: [
      shotMessage(playerTurn ? 'You' : 'Opponent', action.cell, shot.result, shot.sunk),
      ...state.log,
    ].slice(0, 50),
  };
}
