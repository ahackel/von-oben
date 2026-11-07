// The island, without a screen: its ground (a grid of 2 px cells: sea, sand, grass, path), what stands on it (trees,
// bushes, houses, a fountain), what lies about to eat (mice, beetles, worms) and the fish in the sea. Units: art pixels.
export const W = 2560, H = 1920, CELL = 2, SEA = 1200; // (the island's map; the sea goes on SEA px beyond it all round)
export const DEEP = 0, WATER = 1, SAND = 2, GRASS = 3, PATH = 4, ROCK = 5, SNOW = 6;
export const PERCH = 38; // (how high the top of the nest's rock is)
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
export const MOUNT = 0.3; // (from this height: the mountains, bare rock, snow on top)
const elevationAt = (x, y, s) => { const nx = (x / W) * 2 - 1, ny = (y / H) * 2 - 1; return fbm(x / 350, y / 350, s) - 0.1 - Math.hypot(nx, ny * 1.05) * 0.62; };

export function makeWorld(seed = 7) {
  const rand = rng(seed), elev = new Float32Array(GW * GH), ground = new Uint8Array(GW * GH);
  // small islands out in the sea: a hill each, raised from the sea floor (the highest bare rock on top)
  const isles = [];
  for (let n = 0; n < 500 && isles.length < 8; n++) {
    const r = 40 + rand() * 75, x = r + 30 + rand() * (W - 2 * r - 60), y = r + 30 + rand() * (H - 2 * r - 60), base = elevationAt(x, y, seed);
    if (base < -0.14 && isles.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + r + 120)) isles.push({ x, y, r, top: 0.05 + rand() * 0.3 - base });
  }
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const x = i * CELL, y = j * CELL, k = j * GW + i;
    let e = elevationAt(x, y, seed);
    for (const o of isles) if (Math.abs(x - o.x) < o.r * 1.3 && Math.abs(y - o.y) < o.r * 1.3) {
      const d = Math.hypot(x - o.x, y - o.y) / (o.r * (0.75 + noise(x / 30, y / 30, seed + 5) * 0.5));
      if (d < 1) e += o.top * (1 - d * d) ** 1.5;
    }
    elev[k] = e; ground[k] = e < -0.07 ? DEEP : e < 0 ? WATER : e < 0.035 ? SAND : e < MOUNT ? GRASS : e < MOUNT + 0.12 ? ROCK : SNOW;
  }
  const w = { seed, rand, elev, ground, objects: [], food: [], fish: [], buckets: new Map(), time: 0 };
  const at = (x, y) => terrain(w, x, y);
  // the village: a street of paths through the grass nearest the middle, houses along it, a fountain on it
  let vx = W / 2, vy = H / 2;
  for (let r = 0; r < 700 && !(at(vx - 240, vy) === GRASS && at(vx + 240, vy) === GRASS && at(vx, vy - 110) === GRASS && at(vx, vy + 120) === GRASS); r += 8) {
    const a = r * 0.37; vx = W / 2 + Math.cos(a) * r; vy = H / 2 + Math.sin(a) * r;
  }
  vx = Math.round(vx); vy = Math.round(vy);
  paint(w, vx - 250, vy - 9, 500, 18, PATH);
  for (let n = -2; n <= 2; n++) { // (a house each side of the street, every 86 px; in the middle the fountain)
    const x = vx + n * 86;
    if (n === 0) { add(w, { art: 'fountain', x, y: vy + 30, block: { w: 26, d: 10 } }); paint(w, x - 20, vy + 9, 40, 24, PATH); continue; }
    add(w, house(x, vy - 12, rand));
    if (n !== 1) add(w, house(x, vy + 82, rand)), paint(w, x - 4, vy + 9, 8, 74, PATH);
  }
  w.village = { x: vx, y: vy };
  // the eagle's nest, on a rock: the mountains' edge nearest the village
  const nest = { x: vx, y: vy };
  let best = Infinity;
  for (let y = 40; y < H - 40; y += 16) for (let x = 40; x < W - 40; x += 16) {
    const d = Math.hypot(x - vx, y - vy);
    if (d > 220 && d < best && at(x, y) === ROCK && at(x, y + 24) <= ROCK && at(x, y + 24) >= GRASS) { best = d; nest.x = x; nest.y = y; }
  }
  if (best === Infinity) { nest.x = vx + 260; nest.y = vy - 160; }
  add(w, { art: 'crag', x: nest.x, y: nest.y, block: { r: 16 }, nest: true, perch: true });
  w.nest = nest;
  // lone rocks in the sea, near the island and far out: places to land and rest a while (not to sleep)
  for (let n = 0, made = 0; n < 800 && made < 12; n++) {
    const x = Math.round(-SEA * 0.8 + rand() * (W + SEA * 1.6)), y = Math.round(-SEA * 0.8 + rand() * (H + SEA * 1.6));
    const open = [0, 1, 2, 3, 4, 5].every((k) => terrain(w, x + Math.cos(k * 1.05) * 30, y + Math.sin(k * 1.05) * 30) === DEEP);
    if (open && Math.hypot(x - W / 2, y - H / 2) < W * 0.85 && w.objects.every((o) => !o.perch || Math.hypot(o.x - x, o.y - y) > 380)) { add(w, { art: 'crag', x, y, block: { r: 16 }, perch: true }); made++; }
  }
  // farms here and there; woods where a second noise says so, a tree or bush now and then elsewhere
  for (let n = 0; n < 8; n++) {
    const x = 80 + rand() * (W - 160), y = 80 + rand() * (H - 160);
    if (clearFor(w, x, y, 80) && Math.hypot(x - nest.x, y - nest.y) > 80 && at(x - 26, y + 6) === GRASS && at(x + 26, y + 6) === GRASS) add(w, house(x, y, rand));
  }
  for (let y = 16; y < H; y += 20) for (let x = 16; x < W; x += 20) {
    const px = x + (rand() - 0.5) * 14, py = y + (rand() - 0.5) * 14;
    if (!clearFor(w, px, py, 18) || Math.hypot(px - nest.x, py - nest.y) < 40) continue;
    const here = at(px, py);
    if (here >= ROCK || ((here === GRASS || here === SAND) && rand() < 0.012)) { // (rocks: all over the mountains, a few elsewhere)
      if (here === SNOW || rand() < (here === ROCK ? 0.45 : 1)) add(w, { art: here === SNOW ? 'rock3' : `rock${Math.floor(rand() * 3)}`, x: Math.round(px), y: Math.round(py), block: { r: 6 } });
      continue;
    }
    if (here !== GRASS || at(px, py - 24) !== GRASS) continue;
    const wood = fbm(px / 200, py / 200, seed + 9) > 0.62, r = rand(), at2 = { x: Math.round(px), y: Math.round(py) };
    if (wood ? r < 0.8 : r < 0.04) add(w, { art: `${rand() < 0.55 ? 'pine' : 'oak'}${Math.floor(rand() * 3)}`, ...at2, block: { r: 4 } });
    else if (r > 0.975) add(w, { art: ['bush', 'bush2', 'bush3'][Math.floor(rand() * 3)], ...at2, block: { r: 4 } });
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
// a house: its bottom middle at (x, y); it stands on a footprint 52 wide, 22 deep
const house = (x, y, rand) => ({ art: `house${Math.floor(rand() * 3)}`, x: Math.round(x), y: Math.round(y), block: { w: 52, d: 22 } });
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
export const FOOD = { mouse: 25, beetle: 12, worm: 10, fish: 35 }; // (energy, eaten)
const SPEED = { mouse: 34, beetle: 14, worm: 4 }; // (running away)
const fits = (kind) => (t) => t === GRASS || (kind === 'beetle' && (t === SAND || t === ROCK));
function placeFood(w, f) {
  const r = w.rand();
  f.kind = r < 0.3 ? 'mouse' : r < 0.65 ? 'beetle' : 'worm';
  f.gone = 0; f.a = w.rand() * 6.3; f.run = 0; f.scare = 0;
  return spot(w, f, fits(f.kind));
}
// a perch (a rock's flat top) within r of (x, y)
export const perchNear = (w, x, y, r) => near(w, x, y, (o) => o.perch && Math.hypot(o.x - x, o.y - y) < r);
// snatching what is within r of (x, y): a mouse, beetle, worm or a fish (gone for a while, elsewhere); what it was
export function snatch(w, x, y, r) {
  const f = w.food.find((f) => alive(f) && Math.hypot(f.x - x, f.y - y) < r) || w.fish.find((f) => alive(f) && Math.hypot(f.x - x, f.y - y) < r);
  return f ? take(w, f) : null;
}
export const alive = (f) => (f.kind ? f.gone <= 0 : f.t <= 0); // (a mouse, beetle, worm (kind) or a fish: there to catch?)
export function take(w, f) { if (f.kind) { f.gone = 15 + w.rand() * 20; return f.kind; } f.t = 20; return 'fish'; }
// the nearest prey to (x, y) within r (the land's or the sea's)
export function nearestPrey(w, x, y, r) {
  let best = null, d = r;
  for (const f of w.food) if (alive(f) && Math.hypot(f.x - x, f.y - y) < d) { best = f; d = Math.hypot(f.x - x, f.y - y); }
  for (const f of w.fish) if (alive(f) && Math.hypot(f.x - x, f.y - y) < d) { best = f; d = Math.hypot(f.x - x, f.y - y); }
  return best;
}

// time going by: the eagle (b) near and low, what lies about startles and runs off; caught, it comes back elsewhere;
// fish swim about (turning back at the shore)
export function update(w, dt, b) {
  w.time += dt;
  for (const f of w.food) {
    if (f.gone > 0) { if ((f.gone -= dt) <= 0) placeFood(w, f); continue; }
    if (b && f.run <= 0 && f.scare <= 0 && b.z < 30 && Math.hypot(f.x - b.x, f.y - b.y) < 55) f.scare = 0.25;
    if (f.scare > 0 && (f.scare -= dt) <= 0 && b) { f.run = 1.5; f.a = Math.atan2(f.y - b.y, f.x - b.x) + (w.rand() - 0.5); }
    const v = f.run > 0 ? SPEED[f.kind] : f.kind === 'worm' ? 0.5 : 2;
    if (f.run > 0) f.run -= dt;
    f.a += (w.rand() - 0.5) * (f.run > 0 ? 3 : 5) * dt;
    const nx = f.x + Math.cos(f.a) * v * dt, ny = f.y + Math.sin(f.a) * v * dt;
    if (fits(f.kind)(terrain(w, nx, ny)) && !blocked(w, nx, ny)) { f.x = nx; f.y = ny; } else f.a += Math.PI * (0.5 + w.rand());
  }
  for (const f of w.fish) {
    if (f.t > 0) { if ((f.t -= dt) <= 0) spot(w, f, (t) => t === WATER || t === DEEP); continue; }
    f.a += (w.rand() - 0.5) * 2 * dt;
    const nx = f.x + Math.cos(f.a) * 10 * dt, ny = f.y + Math.sin(f.a) * 10 * dt;
    if (isWater(w, nx, ny)) { f.x = nx; f.y = ny; } else f.a += Math.PI * (0.6 + w.rand() * 0.8);
  }
}
