// The clinic's pixel art, drawn pixel by pixel (see art/): rows of characters, each a color of Lop Hop's palette (keys:
// 'tan', or in a tone, 'tan.shade'; one not in it: '#rrggbb'). The light comes from the top left: each part lit along
// its top (light), shaded along its bottom (shade, dark). Round it, outside it, an outline (but not where it has its
// own: outline false): each pixel of it in the line tone of the color it borders. Inside it: '.' or ' ' nothing; 'k' a
// line (in the line tone of the color most round it); 'e' an eye (found, so it can blink, shut, squint: see eyes). A
// sprite: { w, h, at (its points: its outline counted), draw(ctx, x, y, flip) }
import palette from '../lib/palette.js';

export const HEX = { ...palette.colors, ...Object.fromEntries(Object.entries(palette.roles).map(([k, v]) => [k, v.day])) };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hexOf = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => hexOf(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));
// a color's tones: lit (warmer, lighter), and Lop Hop's darker, cooler ones (see styled in lophop/art.js): its shade,
// darker yet, its line (an outline), far (a far leg)
const TONES = { shade: ['#4b5687', 0.24], dark: ['#3a3f6e', 0.4], line: ['#2b2541', 0.55], far: ['#6c7398', 0.38] };
const tones = new Map();
export function tone(hex, t) {
  const key = hex + t;
  if (!tones.has(key)) {
    if (t === 'light') tones.set(key, mix(hex, '#fffbe8', 0.38));
    else { const [tint, k] = TONES[t], f = rgb(tint).map((v) => 1 - k * (1 - v / 255)); tones.set(key, hexOf(rgb(hex).map((v, i) => v * f[i]))); }
  }
  return tones.get(key);
}

// rows laid over rows (from x, y): the top ones' characters over those under them, but '.' (nothing there: what is
// under shows) and '_' (rubbed out: nothing)
export function over(under, top, x = 0, y = 0) {
  const out = under.slice();
  top.forEach((row, j) => {
    let r = (out[y + j] || '').padEnd(x + row.length, '.');
    for (let i = 0; i < row.length; i++) if (row[i] !== '.' && row[i] !== ' ') r = r.slice(0, x + i) + (row[i] === '_' ? '.' : row[i]) + r.slice(x + i + 1);
    out[y + j] = r;
  });
  return out;
}
export const mirror = (rows) => { const w = Math.max(...rows.map((r) => r.length)); return rows.map((r) => [...r.padEnd(w, '.')].reverse().join('')); };

// a sprite's grid: each pixel its color (as drawn, toned) and its part's color (base: what lines and the outline take
// their tone from); its eyes (each: its pixels, left to right)
function grid(def) {
  const rows = def.rows, h = rows.length, w = Math.max(...rows.map((r) => r.length)), n = w * h;
  const color = new Array(n).fill(null), base = new Array(n).fill(null), eye = new Uint8Array(n), line = new Uint8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x], i = y * w + x;
    if (!ch || ch === '.' || ch === ' ') continue;
    if (ch === 'k') { line[i] = 1; continue; }
    if (ch === 'e') { eye[i] = 1; continue; }
    const spec = def.keys[ch];
    if (!spec) throw new Error(`${def.name}: no color for '${ch}'`);
    const [name, t] = spec.split('.'), hex = name[0] === '#' ? name : HEX[name];
    if (!hex) throw new Error(`${def.name}: no color '${name}'`);
    base[i] = hex; color[i] = t ? tone(hex, t) : hex;
  }
  const near = (x, y) => { // (the color most round a pixel: 4 round counting double, then the corners)
    const seen = new Map();
    for (const [dx, dy, wt] of [[-1, 0, 2], [1, 0, 2], [0, -1, 2], [0, 1, 2], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]]) {
      const X = x + dx, Y = y + dy, j = Y * w + X;
      if (X >= 0 && Y >= 0 && X < w && Y < h && base[j] && !line[j] && !eye[j]) seen.set(base[j], (seen.get(base[j]) || 0) + wt);
    }
    let best = null, most = 0;
    for (const [k, v] of seen) if (v > most) { best = k; most = v; }
    return best;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (line[i]) { base[i] = near(x, y) || HEX.outline; color[i] = tone(base[i], 'line'); }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { // (under an eye: the fur round it)
    const i = y * w + x;
    if (!eye[i]) continue;
    let j = -1;
    for (const dx of [-1, 1, -2, 2]) { const k = i + dx; if (x + dx >= 0 && x + dx < w && base[k] && !eye[k] && !line[k]) { j = k; break; } }
    base[i] = j >= 0 ? base[j] : HEX.white; color[i] = j >= 0 ? color[j] : HEX.white;
  }
  const eyes = [], taken = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!eye[i] || taken[i]) continue;
    const px = [], q = [i]; taken[i] = 1;
    while (q.length) { const j = q.pop(); px.push(j); for (const d of [1, -1, w, -w]) { const k = j + d; if (k >= 0 && k < n && eye[k] && !taken[k] && Math.abs((k % w) - (j % w)) <= 1) { taken[k] = 1; q.push(k); } } }
    eyes.push({ x: Math.min(...px.map((j) => j % w)), y: Math.min(...px.map((j) => Math.floor(j / w))), px });
  }
  eyes.sort((a, b) => a.x - b.x);
  return { w, h, color, base, eyes };
}

// its eyes: open (as drawn: a glint at the top, on dark fur), blinking, shut (asleep), happy (^ ^), hurt (> <); one
// eye (from the side): its back that way (side: 1, the left)
const EYES = {
  blink: (x, y) => [[x, y + 1]],
  shut: (x, y, s) => [[x - s, y + 1], [x, y + 1]],
  happy: (x, y) => [[x - 1, y + 1], [x, y], [x + 1, y + 1]],
  hurt: (x, y, s) => [[x - s, y - 1], [x, y], [x - s, y + 1]],
};
function withEyes(g, def, look) {
  const ink = HEX[def.eye || 'black'];
  for (const [n, e] of g.eyes.entries()) {
    const s = g.eyes.length === 1 ? def.side || 1 : n === 0 ? 1 : -1;
    if (look === 'open' || !EYES[look]) { for (const j of e.px) g.color[j] = def.glint && Math.floor(j / g.w) === e.y && e.px.length > 1 ? HEX.white : ink; continue; }
    for (const [x, y] of EYES[look](e.x, e.y, s)) if (x >= 0 && y >= 0 && x < g.w && y < g.h && g.base[y * g.w + x]) g.color[y * g.w + x] = ink;
  }
}

// a sprite of rows (def: { name, rows, keys, outline (false: none), at: its points, eye (their color), glint, side }),
// its eyes so (see EYES)
export function sprite(def, look = 'open') {
  const g = grid(def);
  withEyes(g, def, look);
  const pad = def.outline === false ? 0 : 1, W = g.w + pad * 2, H = g.h + pad * 2;
  const px = new Array(W * H).fill(null), inside = (x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h && g.base[y * g.w + x];
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.color[y * g.w + x]) px[(y + pad) * W + x + pad] = g.color[y * g.w + x];
  if (pad) for (let y = -1; y <= g.h; y++) for (let x = -1; x <= g.w; x++) {
    if (inside(x, y)) continue;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) if (inside(x + dx, y + dy)) { px[(y + 1) * W + x + 1] = tone(g.base[(y + dy) * g.w + x + dx], 'line'); break; }
  }
  const at = Object.fromEntries(Object.entries(def.at || {}).map(([k, [x, y]]) => [k, [x + pad, y + pad]]));
  const canvases = [];
  const canvas = (flip) => {
    if (canvases[+flip]) return canvases[+flip];
    const c = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
    const cx = c.getContext('2d');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = px[y * W + x]; if (v) { cx.fillStyle = v; cx.fillRect(flip ? W - 1 - x : x, y, 1, 1); } }
    return (canvases[+flip] = c);
  };
  return { w: W, h: H, at, name: def.name, draw(ctx, x, y, flip = false) { ctx.drawImage(canvas(flip), Math.round(x), Math.round(y)); } };
}
// sprites of a def, made once each look
const made = new Map();
export function cached(key, def, look = 'open') {
  const k = key + ' ' + look;
  if (!made.has(k)) made.set(k, sprite(typeof def === 'function' ? def() : def, look));
  return made.get(k);
}
