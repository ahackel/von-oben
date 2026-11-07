// Outside, bought for the garden (see OBJECTS): pines, bushes (some with berries), sunflowers, drawn pixel by pixel (see pixels.js), lit from
// the top left. Each stands on its bottom row
import { sprite } from '../pixels.js';

const LEAF = { N: 'lightGreen', G: 'green', g: 'green.shade', E: 'darkGreen', F: 'deepGreen', D: 'brown', d: 'brown.shade', R: 'red', r: 'red.light' };
const PLANTS = {
  pine: { keys: LEAF, rows: [
    '......N.......',
    '.....NGg......',
    '....NGGgE.....',
    '...NGGGGgE....',
    '....NGGgE.....',
    '...NGGGGgE....',
    '..NGGGGGGgE...',
    '.NGGGGGGGGgE..',
    '...NGGGGGgE...',
    '..NGGGGGGGgE..',
    '.NGGGGGGGGGgE.',
    'NGGGGGGGGGGGgE',
    '.EEgEEEgEEEEF.',
    '.....DDd......',
    '.....DDd......',
    '.....ddd......',
  ] },
  pine2: { keys: LEAF, rows: [
    '.....N......',
    '....NGg.....',
    '...NGGgE....',
    '....NGgE....',
    '...NGGGgE...',
    '..NGGGGGgE..',
    '...NGGGgE...',
    '..NGGGGGgE..',
    '.NGGGGGGGgE.',
    '..NGGGGGgE..',
    '.NGGGGGGGgE.',
    'NGGGGGGGGGgE',
    '.EEgEEEgEEF.',
    '....DDd.....',
    '....ddd.....',
  ] },
  bush: { keys: LEAF, rows: [
    '....NNN.......',
    '..NNGGGN.NN...',
    '.NGGGGGGNGGN..',
    'NGGGNGGGGGGGg.',
    'GGGGGGGGGGgGGg',
    'GGGgGGGGGgGGgg',
    'gGGGGgGGGGGggE',
    '.ggEggggEggEE.',
    '..EEEEEEEEEE..',
  ] },
  bush2: { keys: LEAF, rows: [
    '.....NNN......',
    '...NNGGGNNN...',
    '..NGGrGGGGGN..',
    '.NGGGRGGGrGGg.',
    'NGGrGGGGGRGGGg',
    'GGGRGGrGGGGgGg',
    'gGGGGGRGGgGrgE',
    '.ggEggggEggREE',
    '..EEEEEEEEEEE.',
  ] },
  bush3: { keys: LEAF, rows: [
    '...NNN....',
    '.NNGGGNN..',
    'NGGGGGGGg.',
    'GGGNGGGgGg',
    'gGGGGGgGgE',
    '.gEggEggE.',
    '..EEEEEE..',
  ] },
  sunflower: { keys: { ...LEAF, Y: 'yellow.light', y: 'yellow', o: 'yellow.shade', B: 'brown', b: 'darkBrown' }, rows: [
    '...Y.Y...',
    '.YYYYYyy.',
    'YYYBBBYyo',
    '.YBBbBBy.',
    'YYBbBbByo',
    '.YBBbBBy.',
    'YyyBBByyo',
    '.yyyyyyo.',
    '...o.o...',
    '....G....',
    '....GNN..',
    '.NN.GGGg.',
    '.GGgG....',
    '....G....',
    '....G....',
    '....g....',
  ] },
  sunflower2: { keys: { ...LEAF, Y: 'yellow.light', y: 'yellow', o: 'yellow.shade', B: 'brown', b: 'darkBrown' }, rows: [
    '..Y.Y..',
    '.YYYYy.',
    'YYBBByo',
    'YBbBbBo',
    'yyBBByo',
    '.yyyyo.',
    '..o.o..',
    '...G...',
    '.NNGNN.',
    '.GgGGg.',
    '...G...',
    '...g...',
  ] },
  // a fountain (2x2 tiles): a stone basin of water, a bowl on a pillar in it, a jet of water falling over its edge
  fountain: { keys: { L: 'lightGrey.light', S: 'lightGrey', s: 'lightGrey.shade', w: 'blue', W: 'blue.light', V: 'white' }, rows: [
    '..............VV..............',
    '.............VVVV.............',
    '............V.WW.V............',
    '...........V..WW..V...........',
    '..........V...WW...V..........',
    '..............WW..............',
    '...........LwwwwwwL...........',
    '.........LLLwwwwwwLLL.........',
    '........W..LLLLLLLL..W........',
    '.......W...ssssssss...W.......',
    '.......W.....SSss.....W.......',
    '......W......SSss......W......',
    '......W......SSss......W......',
    '......W..LLLLSSssLLLL..W......',
    '.....WLLLLLLLSSssLLLLLLLW.....',
    '....LLLwwwwwwSSsswwwwwwLLL....',
    '..LLLwwwwwwwwSSsswwwwwwwwLLL..',
    '..LLwwwwwwwWwSSsswwwWwwwwwLL..',
    '.LLwwwwwwWwwwwwwwwWwwwwwwwwLL.',
    '.SLLwwwWwwwwwwwwWwwwwwwwwWLLS.',
    '.SLLLWwwwwwwwwWwwwwwwwwWwLLLS.',
    '.SSSLLLwwwwwWwwwwwwwwWwLLLSSS.',
    '.SSSSSLLLLLLLLLLLLLLLLLLSSSSS.',
    '.SSSSSSSSLLLLLLLLLLLLSSSSSSSS.',
    '.SSSSSSSSSSSSSSSSSSSSSSSSSSSS.',
    '..ssssssssssssssssssssssssss..',
    '....ssssssssssssssssssssss....',
    '........ssssssssssssss........',
  ] },
};
// the fountain's water running, in three frames (fountain0-2): ripples drifting across the basin, glints falling down the
// streams and rising up the jet, its spray flickering
const flowing = (rows, f) => rows.map((r, y) => [...r].map((ch, x) => {
  const jet = x === 14 || x === 15, down = (((y - f) % 3) + 3) % 3;
  if (y >= 15 && (ch === 'w' || ch === 'W')) return (x + 2 * y + 3 * f) % 9 ? 'w' : 'W';
  if (ch === 'W' && y >= 8 && (x < 12 || x > 17)) return down ? 'W' : 'V';
  if (ch === 'W' && jet && y <= 5) return (y + f) % 3 ? 'W' : 'V';
  if (ch === 'V' && !jet && y <= 4) return (y + f) % 3 ? 'V' : '.';
  return ch;
}).join(''));
for (let f = 0; f < 3; f++) PLANTS[`fountain${f}`] = { ...PLANTS.fountain, rows: flowing(PLANTS.fountain.rows, f) };
export const GARDEN = Object.fromEntries(Object.entries(PLANTS).map(([k, d]) => [k, sprite({ name: k, ...d })]));
export const sheet = (check) => { for (const [k, d] of Object.entries(PLANTS)) check(k, d); return [Object.values(GARDEN)]; };
