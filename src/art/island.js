// What stands and lies about on the island, drawn pixel by pixel (see pixels.js), lit from the top left: houses (a
// roof seen from above and the front, the wall below with windows and a door), trees (pines and round leafy ones, in
// rows made here, as big beside the eagle as trees should be), the nest, the eagle's food and the fish.
import { sprite } from '../pixels.js';
import { GARDEN } from './garden.js';
import { PERCH } from '../world.js';

const HW = 54, ROOF = 22, WALL = 22; // (a house: its width, its roof's height, its wall's)
// its windows (x, y, w, h: in the wall), lit at night
const WINDOWS = [[6, 6, 8, 7], [HW - 14, 6, 8, 7]];
// a house's rows: its roof (the ridge lit, shingles in rows, the eaves shaded, a chimney), its wall
function houseRows() {
  const rows = [];
  for (let y = 0; y < ROOF; y++) {
    const inset = Math.max(0, 2 - y);
    let r = '';
    for (let x = 0; x < HW; x++) r += x < inset || x >= HW - inset ? '.' : y < 3 ? 'L' : y >= ROOF - 2 ? 'r' : y % 4 === 2 || (y % 4 === 0 && (x + (y % 8 ? 0 : 3)) % 6 === 0) ? 'r' : 'R';
    rows.push(r);
  }
  for (let y = 1; y < 8; y++) rows[y] = rows[y].slice(0, HW - 16) + (y < 3 ? 'cc' : 'Cc') + 'c' + rows[y].slice(HW - 13); // chimney
  const door = HW / 2 - 4;
  for (let y = 0; y < WALL; y++) {
    let r = '';
    for (let x = 0; x < HW; x++) {
      const win = WINDOWS.find(([wx, wy, ww, wh]) => x >= wx && x < wx + ww && y >= wy && y < wy + wh);
      const dr = y >= 9 && x >= door && x < door + 8;
      r += x === 0 || x === HW - 1 || y === 0 || y === WALL - 1 ? 'w' : dr ? (y === 9 || x === door ? 'd' : y === 15 && x === door + 6 ? 'K' : 'D')
        : win ? (x === win[0] + 3 || y === win[1] + 3 ? 'k' : y === win[1] || x === win[0] ? 'b' : 'B') : y < 3 ? 'w' : 'W';
    }
    rows.push(r);
  }
  return rows;
}
// where its windows are in the house's picture (its outline: 1 px round it)
export const HOUSE_LIGHTS = WINDOWS.map(([x, y, w, h]) => [x + 1, ROOF + y + 1, w, h]);
const WALLS = { W: 'cream', w: 'cream.shade', B: 'blue', b: 'blue.light', D: 'brown', d: 'brown.shade', K: 'yellow', C: 'grey', c: 'grey.shade' };
const HOUSES = {
  house0: { keys: { ...WALLS, L: 'red.light', R: 'red', r: 'red.shade' }, rows: houseRows() },
  house1: { keys: { ...WALLS, L: 'rust.light', R: 'rust', r: 'rust.shade', W: 'beige', w: 'beige.shade' }, rows: houseRows() },
  house2: { keys: { ...WALLS, L: 'slate.light', R: 'slate', r: 'slate.shade', W: 'sand.light', w: 'sand' }, rows: houseRows() },
};

// trees: the light from the top left, by how a pixel's spot on the crown faces it
const LEAF = { N: 'lightGreen', G: 'green', g: 'green.shade', E: 'darkGreen', F: 'deepGreen', D: 'brown', d: 'brown.shade' };
const shade = (l) => (l > 0.45 ? 'N' : l > -0.1 ? 'G' : l > -0.55 ? 'g' : 'E');
const speck = (x, y, s) => ((x * 7 + y * 13 + s * 5) % 11) / 11; // (leaves, here and there a tone off)
const trunk = (rows, w, h, tw) => { const x0 = Math.floor(w / 2 - tw / 2); for (let y = 0; y < h; y++) rows.push('.'.repeat(x0) + 'D'.repeat(tw - 1) + 'd' + '.'.repeat(w - x0 - tw)); };
// a pine: tiers, each a cone wider than the one above, its bottom edge shaded
function pineRows(h, w, s) {
  const rows = [], c = (w - 1) / 2, tiers = 3, th = h / tiers;
  for (let y = 0; y < h; y++) {
    const k = Math.floor(y / th), f = (y - k * th) / th, hw = 1.5 + (w / 2 - 1.5) * ((k + f * 1.4) / (tiers + 0.4));
    let r = '';
    for (let x = 0; x < w; x++) {
      const dx = (x - c) / Math.max(1, hw);
      if (Math.abs(dx) > 1) { r += '.'; continue; }
      const edge = f > 0.82 || Math.abs(dx) > 0.86, l = -dx * 0.8 + (0.4 - f) * 0.9 + (speck(x, y, s) - 0.5) * 0.5;
      r += edge && dx > -0.4 ? 'E' : shade(l);
    }
    rows.push(r);
  }
  trunk(rows, w, 5, 4);
  return rows;
}
// a leafy tree: a round crown, a little lumpy at its edge, on a trunk
function oakRows(rad, s) {
  const w = rad * 2 + 3, ch = Math.round(rad * 1.8) + 2, c = (w - 1) / 2, cy = ch / 2, rows = [];
  for (let y = 0; y < ch; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      const dx = (x - c) / rad, dy = (y - cy) / (rad * 0.9), a = Math.atan2(dy, dx), d = Math.hypot(dx, dy) - Math.sin(a * 5 + s) * 0.07;
      if (d > 1) { r += '.'; continue; }
      const l = (-dx * 0.55 - dy * 0.8) + (speck(x, y, s) - 0.5) * 0.45;
      r += d > 0.9 && l < 0 ? 'E' : shade(l);
    }
    rows.push(r);
  }
  trunk(rows, w, 7, 4);
  return rows;
}
const TREES = {};
[[32, 17], [38, 19], [28, 15]].forEach(([h, w], i) => { TREES[`pine${i}`] = { keys: LEAF, rows: pineRows(h, w, i) }; });
[13, 15, 11].forEach((r, i) => { TREES[`oak${i}`] = { keys: LEAF, rows: oakRows(r, i) }; });

// the nest: a ring of twigs, its hollow darker
function nestRows() {
  const w = 34, h = 16, rows = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      const dx = (x - (w - 1) / 2) / 16.5, dy = (y - (h - 1) / 2) / 7.5, d = Math.hypot(dx, dy), hollow = Math.hypot(dx / 0.68, (dy + 0.12) / 0.6);
      r += d > 1 ? '.' : hollow < 1 ? (hollow < 0.7 ? 'h' : 'H') : (x * 3 + y * 5) % 7 === 0 ? 'T' : (x + y * 2) % 5 === 0 ? 't' : dy < -0.3 || dx < -0.6 ? 'L' : 'B';
    }
    rows.push(r);
  }
  return rows;
}
const NEST = { nest: { keys: { B: 'ochre', L: 'ochre.light', T: 'brown', t: 'camel.light', H: 'darkBrown', h: 'deepBrown' }, rows: nestRows() } };

// rocks: lumps of stone, in facets (the light by which way each faces, in steps), cracked here and there
const STONE = { N: 'lightGrey', G: 'blueGrey', g: 'slate', E: 'charcoal', S: 'white' };
function rockRows(w, h, s, snow) {
  const rows = [], c = (w - 1) / 2;
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      const dx = (x - c) / (w / 2), dy = (y - h * 0.62) / (h * 0.62), a = Math.atan2(dy, dx);
      if (Math.hypot(dx, dy * (dy > 0 ? 1.6 : 1)) - Math.sin(a * 3 + s) * 0.1 > 1 || y > h - 1) { r += '.'; continue; }
      const facet = Math.round(a / (Math.PI / 3)) * (Math.PI / 3), l = -Math.cos(facet) * 0.6 - Math.sin(facet) * 0.8;
      r += (x * 5 + y * 3 + s) % 13 === 0 && dy > -0.3 ? 'k' : snow && dy < -0.35 ? 'S' : l > 0.5 ? 'N' : l > -0.1 ? 'G' : l > -0.6 ? 'g' : 'E';
    }
    rows.push(r);
  }
  return rows;
}
const ROCKS = {};
[[14, 10], [20, 13], [11, 8], [26, 18]].forEach(([w, h], i) => { ROCKS[`rock${i}`] = { keys: STONE, rows: rockRows(w, h, i, i === 3) }; });
// the nest's rock: a pillar, its flat top (lit) PERCH px up from its foot, its faces shaded by which way they look, cracks down them
function cragRows(w = 44, top = 14) {
  const h = PERCH + top / 2, rows = [], c = (w - 1) / 2;
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      const dx = (x - c) / (w / 2), ty = (y - top / 2) / (top / 2), onTop = Math.hypot(dx * 1.05, ty) < 1;
      const half = 0.95 + Math.sin(y * 0.7 + x) * 0.04 + (y / h) * 0.05;
      if (onTop) r += Math.hypot(dx * 1.05, ty) > 0.88 && ty > 0 ? 'g' : (x + y * 3) % 9 === 0 ? 'G' : 'N';
      else if (y < top / 2 || Math.abs(dx) > half) r += '.';
      else r += (x % 7 === 3 && (y * 2 + x) % 9 < 5) ? 'k' : y > h - 3 ? 'E' : dx < -0.45 ? 'G' : dx < 0.35 ? 'g' : 'E';
    }
    rows.push(r);
  }
  return rows;
}
ROCKS.crag = { keys: STONE, rows: cragRows() };

const SMALL = {
  mouse: { keys: { G: 'grey.light', g: 'grey', s: 'grey.shade', p: 'pink' }, rows: ['.GG......', 'GGGGGG...', 'peGGGGGg.', '.gggggggp', '..s...s..'] }, // (facing left: an ear up, the legs down, its tail out behind)
  lizard: { keys: { G: 'lightGreen', g: 'green', s: 'green.shade' }, rows: ['.GGG.......', 'GeGGGGgg...', '.s..s..gggg', '..........g'] }, // (facing left: its legs out, a long tail)
  frog: { keys: { G: 'green', g: 'green.shade', L: 'lightGreen' }, rows: ['.L.L.', 'GeGeG', 'LGGGL', 'ggggg', 'g...g'] },
  beetle: { keys: { G: 'darkGreen.light', g: 'darkGreen', b: 'black' }, rows: ['b.b', 'GGg', 'ggg', 'b.b'] },
  worm: { keys: { P: 'lightPink', p: 'pink', r: 'rose' }, rows: ['.PP..', 'p..pp', '.....'] },
  fish: { keys: { S: 'blueGrey.light', s: 'blueGrey', d: 'blueGrey.shade' }, rows: ['.SSS..S', 'SeSssSs', '.ddd..d'] },
};
const make = (defs) => Object.fromEntries(Object.entries(defs).map(([k, d]) => [k, sprite({ name: k, ...d })]));
export const ART = { ...GARDEN, ...make(HOUSES), ...make(TREES), ...make(NEST), ...make(ROCKS), ...make(SMALL) };
