// The island, without a screen: its ground (a grid of 2 px cells: sea, sand, grass, path), what stands on it (trees,
// bushes, houses, a fountain), what lies about to eat (mice, beetles, worms) and the fish in the sea. Units: art pixels.
export const W = 2048, H = 1536, CELL = 2;
export const DEEP = 0, WATER = 1, SAND = 2, GRASS = 3, PATH = 4;
const GW = W / CELL, GH = H / CELL;

export function rng(seed) { // (mulberry32: the same island every time)
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), seed | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash = (x, y, s = 0) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function noise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => noise(x, y, s) * 0.55 + noise(x * 2.1, y * 2.1, s + 1) * 0.3 + noise(x * 4.3, y * 4.3, s + 2) * 0.15;
// height above the sea (below 0: sea): noise, falling off towards the map's edges
const elevationAt = (x, y, s) => { const nx = (x / W) * 2 - 1, ny = (y / H) * 2 - 1; return fbm(x / 280, y / 280, s) - 0.1 - Math.hypot(nx, ny * 1.05) * 0.62; };

export function makeWorld(seed = 7) {
  const rand = rng(seed), elev = new Float32Array(GW * GH), ground = new Uint8Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const e = elevationAt(i * CELL, j * CELL, seed), k = j * GW + i;
    elev[k] = e; ground[k] = e < -0.07 ? DEEP : e < 0 ? WATER : e < 0.035 ? SAND : GRASS;
  }
  const w = { seed, rand, elev, ground, objects: [], food: [], fish: [], buckets: new Map(), time: 0 };
  const at = (x, y) => terrain(w, x, y);
  // the village: a street of paths through the grass nearest the middle, houses along it, a fountain on it
  let vx = W / 2, vy = H / 2;
  for (let r = 0; r < 600 && !(at(vx - 140, vy) === GRASS && at(vx + 140, vy) === GRASS && at(vx, vy - 70) === GRASS && at(vx, vy + 70) === GRASS); r += 8) {
    const a = r * 0.37; vx = W / 2 + Math.cos(a) * r; vy = H / 2 + Math.sin(a) * r;
  }
  vx = Math.round(vx); vy = Math.round(vy);
  paint(w, vx - 150, vy - 6, 300, 14, PATH);
  for (let n = -2; n <= 2; n++) { // (a house each side of the street, every 56 px; the middle one the fountain)
    const x = vx + n * 56;
    if (n === 0) { add(w, { art: 'fountain', x, y: vy + 20, block: { w: 26, d: 10 } }); paint(w, x - 18, vy + 6, 36, 18, PATH); continue; }
    add(w, house(x, vy - 8, rand));
    if (n !== 1) add(w, house(x, vy + 52, rand)), paint(w, x - 3, vy + 8, 6, 44 - 8, PATH);
  }
  w.village = { x: vx, y: vy };
  // farms here and there; woods where a second noise says so, a tree or bush now and then elsewhere
  for (let n = 0; n < 6; n++) {
    const x = 80 + rand() * (W - 160), y = 80 + rand() * (H - 160);
    if (clearFor(w, x, y, 46) && at(x, y + 20) === GRASS) add(w, house(x, y, rand));
  }
  for (let y = 12; y < H; y += 13) for (let x = 12; x < W; x += 13) {
    const px = x + (rand() - 0.5) * 10, py = y + (rand() - 0.5) * 10;
    if (at(px, py) !== GRASS || at(px, py - 14) !== GRASS || !clearFor(w, px, py, 14)) continue;
    const wood = fbm(px / 160, py / 160, seed + 9) > 0.62, r = rand();
    if (wood ? r < 0.75 : r < 0.025) add(w, { art: rand() < 0.5 ? 'pine' : 'pine2', x: Math.round(px), y: Math.round(py), block: { r: 3 } });
    else if (r > 0.985) add(w, { art: ['bush', 'bush2', 'bush3'][Math.floor(rand() * 3)], x: Math.round(px), y: Math.round(py), block: { r: 4 } });
  }
  for (let n = 0; n < 160; n++) w.food.push(placeFood(w, { gone: 0 }));
  for (let n = 0; n < 70; n++) { const f = { a: rand() * 6.3, t: 0 }; spot(w, f, (t) => t === WATER || t === DEEP); w.fish.push(f); }
  return w;
}

export function terrain(w, x, y) {
  const i = Math.floor(x / CELL), j = Math.floor(y / CELL);
  return i < 0 || j < 0 || i >= GW || j >= GH ? DEEP : w.ground[j * GW + i];
}
export const isWater = (w, x, y) => terrain(w, x, y) <= WATER;
export const elevation = (w, x, y) => { const i = Math.floor(x / CELL), j = Math.floor(y / CELL); return i < 0 || j < 0 || i >= GW || j >= GH ? -1 : w.elev[j * GW + i]; };

function paint(w, x, y, ww, hh, t) {
  for (let j = Math.floor(y / CELL); j < (y + hh) / CELL; j++) for (let i = Math.floor(x / CELL); i < (x + ww) / CELL; i++) if (i >= 0 && j >= 0 && i < GW && j < GH) w.ground[j * GW + i] = t;
}
// a house: its bottom middle at (x, y); it stands on a footprint 30 wide, 14 deep
const house = (x, y, rand) => ({ art: `house${Math.floor(rand() * 3)}`, x: Math.round(x), y: Math.round(y), block: { w: 32, d: 14 } });
const key = (bx, by) => bx * 4096 + by;
function add(w, o) {
  w.objects.push(o);
  const k = key(Math.floor(o.x / 64), Math.floor(o.y / 64));
  if (!w.buckets.has(k)) w.buckets.set(k, []);
  w.buckets.get(k).push(o);
}
function near(w, x, y, f) {
  const bx = Math.floor(x / 64), by = Math.floor(y / 64);
  for (let i = bx - 1; i <= bx + 1; i++) for (let j = by - 1; j <= by + 1; j++) for (const o of w.buckets.get(key(i, j)) || []) if (f(o)) return o;
  return null;
}
// is (x, y) in something that stands in the way (a tree's trunk, a house's walls)?
export function blocked(w, x, y) {
  return !!near(w, x, y, (o) => o.block.r ? Math.hypot(o.x - x, o.y - y) < o.block.r : Math.abs(o.x - x) < o.block.w / 2 && y < o.y + 1 && y > o.y - o.block.d);
}
const clearFor = (w, x, y, r) => !near(w, x, y, (o) => Math.hypot(o.x - x, o.y - y) < r + (o.block.w || 0) / 2);
// somewhere for it (x, y): random, on ground that suits it, clear of what stands there
function spot(w, it, ok) {
  for (let n = 0; n < 200; n++) {
    const x = 20 + w.rand() * (W - 40), y = 20 + w.rand() * (H - 40);
    if (ok(terrain(w, x, y)) && !blocked(w, x, y)) { it.x = x; it.y = y; return it; }
  }
  it.x = w.village?.x ?? W / 2; it.y = w.village?.y ?? H / 2; return it;
}
export const FOOD = { mouse: 14, beetle: 6, worm: 5 };
function placeFood(w, f) {
  const r = w.rand();
  f.kind = r < 0.3 ? 'mouse' : r < 0.65 ? 'beetle' : 'worm';
  f.gone = 0;
  return spot(w, f, (t) => t === GRASS || (f.kind === 'beetle' && t === SAND));
}
export function eat(w, f) { f.gone = 15 + w.rand() * 20; return FOOD[f.kind]; }

// time going by: eaten food comes back elsewhere, fish swim about (turning back at the shore)
export function update(w, dt) {
  w.time += dt;
  for (const f of w.food) if (f.gone > 0 && (f.gone -= dt) <= 0) placeFood(w, f);
  for (const f of w.fish) {
    if (f.t > 0) { if ((f.t -= dt) <= 0) spot(w, f, (t) => t === WATER || t === DEEP); continue; }
    f.a += (w.rand() - 0.5) * 2 * dt;
    const nx = f.x + Math.cos(f.a) * 10 * dt, ny = f.y + Math.sin(f.a) * 10 * dt;
    if (isWater(w, nx, ny)) { f.x = nx; f.y = ny; } else f.a += Math.PI * (0.6 + w.rand() * 0.8);
  }
}
