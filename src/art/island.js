// What stands and lies about on the island, drawn pixel by pixel (see pixels.js), lit from the top left: houses (a
// roof seen from above and the front, the wall below with windows and a door), the eagle's food and the fish.
import { sprite } from '../pixels.js';
import { GARDEN } from './garden.js';

// a house's rows: its roof (the ridge lit, the slope facing us in its color, the eaves shaded, a chimney), its wall
function houseRows(w = 30, roof = 13, wall = 13) {
  const rows = [];
  for (let y = 0; y < roof; y++) {
    const inset = Math.max(0, 2 - y);
    let r = '';
    for (let x = 0; x < w; x++) r += x < inset || x >= w - inset ? '.' : y < 2 ? 'L' : y === roof - 1 ? 'r' : y % 3 === 1 && (x + y) % 4 === 0 ? 'r' : 'R';
    rows.push(r);
  }
  for (const [y, s] of [[1, 'cc'], [2, 'cc'], [3, 'Cc'], [4, 'Cc']]) rows[y] = rows[y].slice(0, 21) + s + rows[y].slice(23); // chimney
  const door = w / 2 - 2;
  for (let y = 0; y < wall; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      const win = (y >= 3 && y <= 6) && ((x >= 4 && x <= 8) || (x >= w - 9 && x <= w - 5));
      const dr = y >= 5 && x >= door && x < door + 5;
      r += x === 0 || x === w - 1 ? 'w' : y === 0 ? 'w' : dr ? (y === 5 || x === door ? 'd' : y === 9 && x === door + 3 ? 'K' : 'D')
        : win ? (x === 6 || x === w - 7 ? 'k' : y === 3 || ((x === 4 || x === w - 9) && y === 4) ? 'b' : 'B') : y === wall - 1 ? 'w' : 'W';
    }
    rows.push(r);
  }
  return rows;
}
const WALLS = { W: 'cream', w: 'cream.shade', B: 'blue', b: 'blue.light', D: 'brown', d: 'brown.shade', K: 'yellow', C: 'grey', c: 'grey.shade' };
const HOUSES = {
  house0: { keys: { ...WALLS, L: 'red.light', R: 'red', r: 'red.shade' }, rows: houseRows() },
  house1: { keys: { ...WALLS, L: 'rust.light', R: 'rust', r: 'rust.shade', W: 'beige', w: 'beige.shade' }, rows: houseRows() },
  house2: { keys: { ...WALLS, L: 'slate.light', R: 'slate', r: 'slate.shade', W: 'sand.light', w: 'sand' }, rows: houseRows() },
};
const SMALL = {
  mouse: { keys: { G: 'grey.light', g: 'grey', s: 'grey.shade', p: 'pink' }, rows: ['.p...p.', 'GGGGG..', 'gegggg.', '.sssss.p', '.......p'] },
  beetle: { keys: { G: 'darkGreen.light', g: 'darkGreen', b: 'black' }, rows: ['b.b', 'GGg', 'ggg', 'b.b'] },
  worm: { keys: { P: 'lightPink', p: 'pink', r: 'rose' }, rows: ['.PP..', 'p..pp', '.....'] },
  fish: { keys: { S: 'blueGrey.light', s: 'blueGrey', d: 'blueGrey.shade' }, rows: ['.SSS..S', 'SeSssSs', '.ddd..d'] },
};
const make = (defs) => Object.fromEntries(Object.entries(defs).map(([k, d]) => [k, sprite({ name: k, ...d })]));
export const ART = { ...GARDEN, ...make(HOUSES), ...make(SMALL) };
