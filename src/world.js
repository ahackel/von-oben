// The island, without a screen: its ground (a grid of 2 px cells: sea, sand, grass, path), what stands on it (trees,
// bushes, houses, a fountain), what lies about to eat (mice, beetles, worms) and the fish in the sea. Units: art pixels.
export const W = 2560, H = 1920, CELL = 2, SEA = 1200; // (the island's map; the sea goes on SEA px beyond it all round)
export const DEEP = 0, WATER = 1, SAND = 2, GRASS = 3, PATH = 4, ROCK = 5, SNOW = 6, FLOOR = 7, WALL = 8, CAVE = 9; // (FLOOR: a barn's straw; CAVE: a cave's floor; WALL: their walls)
export const PERCH = 38; // (how high the top of the nest's rock is)

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
// each island its own shape, by its seed: how fast the land falls away to the edges, how much of it is above the sea
const shapeOf = (s) => (s === 7 ? { fall: 0.62, lift: 0.1, sq: 1.05 } : { fall: 0.5 + hash(s, 1, 3) * 0.3, lift: (0.05 + hash(s, 2, 3) * 0.11) * (featureOf(s) === 'caves' ? 0.3 : 1), sq: 0.8 + hash(s, 3, 3) * 0.5 }); // (a cave island: high, mountains to dig into)
const elevationAt = (x, y, s, p) => { const nx = (x / W) * 2 - 1, ny = (y / H) * 2 - 1; return fbm(x / 350, y / 350, s) - p.lift - Math.hypot(nx, ny * p.sq) * p.fall; };
// the islands, one after another as eagles find them (k: 0 the first), each the same for everyone; each new one its
// surprise, in turn: caves all over, a wreck on the beach (treasure round it), a farm island (barns), a lighthouse to
// rest on, a scatter of small islands
export const FEATURES = ['caves', 'wreck', 'farm', 'tower', 'isles'];
export const seedOf = (k) => (k === 0 ? 7 : (1 + Math.floor(hash(k, 5, 99) * 2e7)) * FEATURES.length + ((k - 1) % FEATURES.length));
export const featureOf = (seed) => (seed === 7 ? null : FEATURES[seed % FEATURES.length]);
export const islandSeed = (gx, gy) => (gx === 0 && gy === 0 ? 7 : 1 + Math.floor(hash(gx, gy, 99) * 1e9)); // (as they were once, on a grid: for games kept from then)
const SYL = [['MÖWEN', 'FELSEN', 'ADLER', 'WIND', 'MOOS', 'NEBEL', 'KIEFERN', 'STURM', 'SONNEN', 'KRÄHEN', 'BIRKEN', 'MUSCHEL'], ['HOLM', 'OOG', 'AU', 'SAND', 'WERDER', 'KLIPP', 'INSEL', 'RIFF']];
export const islandName = (seed) => (seed === 7 ? 'FELSENHOLM' : SYL[0][Math.floor(hash(seed, 1, 41) * 12)] + SYL[1][Math.floor(hash(seed, 2, 42) * 8)]);
const GW = W / CELL, GH = H / CELL;
const ROCK_ARTS = ['rock0', 'rock1', 'rock2', 'rock4', 'rock5', 'rock6', 'rock7'], CRAGS = ['crag', 'crag1', 'crag2']; // (see art/island.js)

export function makeWorld(seed = 7) {
  const rand = rng(seed), elev = new Float32Array(GW * GH), ground = new Uint8Array(GW * GH), shape = shapeOf(seed), feature = featureOf(seed);
  // small islands out in the sea: a hill each, raised from the sea floor (the highest bare rock on top)
  const isles = [];
  for (let n = 0; n < 2000 && isles.length < (feature === 'isles' ? 26 : 8); n++) {
    const r = 40 + rand() * 75, x = r + 30 + rand() * (W - 2 * r - 60), y = r + 30 + rand() * (H - 2 * r - 60), base = elevationAt(x, y, seed, shape);
    if (base < -0.14 && isles.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + r + 120)) isles.push({ x, y, r, top: 0.05 + rand() * 0.3 - base });
  }
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const x = i * CELL, y = j * CELL, k = j * GW + i;
    let e = elevationAt(x, y, seed, shape);
    for (const o of isles) if (Math.abs(x - o.x) < o.r * 1.3 && Math.abs(y - o.y) < o.r * 1.3) {
      const d = Math.hypot(x - o.x, y - o.y) / (o.r * (0.75 + noise(x / 30, y / 30, seed + 5) * 0.5));
      if (d < 1) e += o.top * (1 - d * d) ** 1.5;
    }
    elev[k] = e; ground[k] = e < -0.07 ? DEEP : e < 0 ? WATER : e < 0.035 ? SAND : e < MOUNT ? GRASS : e < MOUNT + 0.12 ? ROCK : SNOW;
  }
  const w = { seed, feature, rand, elev, ground, W, H, gw: GW, gh: GH, out: DEEP, objects: [], food: [], fish: [], gems: [], buckets: new Map(), time: 0, weather: 'sun', wind: { x: 0, y: 0 }, floes: [], ice: 0 };
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
    if (open && Math.hypot(x - W / 2, y - H / 2) < W * 0.85 && w.objects.every((o) => !o.perch || Math.hypot(o.x - x, o.y - y) > 380)) { add(w, { art: CRAGS[Math.floor(rand() * 3)], x, y, block: { r: 16 }, perch: true }); made++; }
  }
  // farms here and there; woods where a second noise says so, a tree or bush now and then elsewhere
  for (let n = 0; n < 8; n++) {
    const x = 80 + rand() * (W - 160), y = 80 + rand() * (H - 160);
    if (clearFor(w, x, y, 80) && Math.hypot(x - nest.x, y - nest.y) > 80 && at(x - 26, y + 6) === GRASS && at(x + 26, y + 6) === GRASS) add(w, house(x, y, rand));
  }
  // barns in the fields (their door open, at the front), caves in the mountains' rock faces
  for (let n = 0, made = 0; n < 900 && made < (feature === 'farm' ? 6 : 3); n++) {
    const x = Math.round(100 + rand() * (W - 200)), y = Math.round(100 + rand() * (H - 200));
    if (clearFor(w, x, y, 70) && [-34, 0, 34].every((d) => at(x + d, y + 8) === GRASS && at(x + d, y - 30) === GRASS)) add(w, { art: 'barn', x, y, block: { w: 64, d: 26 }, door: true, room: `barn${made++}` });
  }
  const many = feature === 'caves', caves = many ? 5 : 2;
  for (let y = 40, made = 0; y < H - 40 && made < caves; y += 24) for (let x = 40; x < W - 40 && made < caves; x += 24) {
    if (at(x, y) === ROCK && at(x, y + 16) >= GRASS && at(x, y + 16) <= ROCK && at(x, y - 20) >= ROCK && Math.hypot(x - nest.x, y - nest.y) > 200 && clearFor(w, x, y, 30)
      && w.objects.every((o) => !o.cave || Math.hypot(o.x - x, o.y - y) > (many ? 260 : 500)) && hash(x, y, seed) < (many ? 0.6 : 0.3)) add(w, { art: 'cave', x, y, block: { r: 1 }, cave: true, room: `cave${made++}` });
  }
  // a wreck on a beach, treasure washed up round it; a lighthouse on the shore
  const shore = (x, y) => [0, 1, 2, 3, 4, 5, 6, 7].some((k) => isWater(w, x + Math.cos(k * 0.785) * 40, y + Math.sin(k * 0.785) * 40));
  for (let n = 0; n < 4000 && feature === 'wreck' && !w.objects.some((o) => o.art === 'wreck'); n++) {
    const x = Math.round(60 + rand() * (W - 120)), y = Math.round(60 + rand() * (H - 120));
    if (at(x, y) !== SAND || at(x - 22, y) !== SAND || at(x + 22, y) !== SAND || !shore(x, y) || !clearFor(w, x, y, 40)) continue;
    add(w, { art: 'wreck', x, y, block: { w: 44, d: 10 } });
    for (let k = 0, id = 0; k < 300 && id < 6; k++) {
      const a = rand() * Math.PI * 2, r = 30 + rand() * 70, gx = x + Math.cos(a) * r, gy = y + Math.sin(a) * r * 0.7;
      if ((at(gx, gy) === SAND || at(gx, gy) === GRASS) && !blocked(w, gx, gy)) w.gems.push({ id: id++, x: gx, y: gy });
    }
  }
  for (let n = 0; n < 4000 && feature === 'tower' && !w.objects.some((o) => o.tower); n++) {
    const x = Math.round(60 + rand() * (W - 120)), y = Math.round(60 + rand() * (H - 120));
    if ((at(x, y) === GRASS || at(x, y) === SAND) && shore(x, y) && clearFor(w, x, y, 40) && Math.hypot(x - nest.x, y - nest.y) > 300) add(w, { art: 'tower', x, y, block: { r: 9 }, perch: true, tower: true });
  }
  for (let y = 16; y < H; y += 20) for (let x = 16; x < W; x += 20) {
    const px = x + (rand() - 0.5) * 14, py = y + (rand() - 0.5) * 14;
    if (!clearFor(w, px, py, 18) || Math.hypot(px - nest.x, py - nest.y) < 40) continue;
    const here = at(px, py);
    if (here >= ROCK || ((here === GRASS || here === SAND) && rand() < 0.012)) { // (rocks: all over the mountains, a few elsewhere)
      if (here === SNOW || rand() < (here === ROCK ? 0.45 : 1)) add(w, { art: here === SNOW ? (rand() < 0.5 ? 'rock3' : 'rock8') : ROCK_ARTS[Math.floor(rand() * ROCK_ARTS.length)], x: Math.round(px), y: Math.round(py), block: { r: 6 } });
      continue;
    }
    if (here !== GRASS || at(px, py - 24) !== GRASS) continue;
    const wood = fbm(px / 200, py / 200, seed + 9) > 0.62, r = rand(), at2 = { x: Math.round(px), y: Math.round(py) };
    if (wood ? r < 0.8 : r < 0.04) add(w, { art: `${rand() < 0.55 ? 'pine' : 'oak'}${Math.floor(rand() * 3)}`, ...at2, block: { r: 4 } });
    else if (r > 0.975) add(w, { art: ['bush', 'bush2', 'bush3'][Math.floor(rand() * 3)], ...at2, block: { r: 4 } });
  }
  // where ice floes drift when it has been cold a while: the sea near the shore (only as many as it is cold: see setIce)
  for (let n = 0; n < 4000 && w.floes.length < 90; n++) {
    const x = rand() * W, y = rand() * H, e = elevation(w, x, y), r = 9 + rand() * 18;
    if (e < -0.02 && e > -0.22 && w.floes.every((f) => Math.hypot(f.x - x, f.y - y) > f.r + r + 6)) w.floes.push({ x, y, r, s: rand() * 100 });
  }
  w.floes.sort((a, b) => elevation(w, b.x, b.y) - elevation(w, a.x, a.y)); // (the first to freeze: the nearest the shore)
  for (let n = 0; n < 160; n++) w.food.push(placeFood(w, { gone: 0 }));
  for (let n = 0; n < 180; n++) { const f = { a: rand() * 6.3, t: 0 }; spot(w, f, (t) => t === WATER || t === DEEP); w.fish.push(f); }
  return w;
}

export function terrain(w, x, y) {
  const i = Math.floor(x / CELL), j = Math.floor(y / CELL);
  return i < 0 || j < 0 || i >= w.gw || j >= w.gh ? w.out : w.ground[j * w.gw + i];
}
export const isWater = (w, x, y) => terrain(w, x, y) <= WATER;
// the floes frozen now (of all the places for them: as many as ice says, 0 .. 1)
export const floesOf = (w) => (w.floes || []).slice(0, Math.round((w.ice || 0) * (w.floes?.length || 0)));
export const onIce = (w, x, y) => floesOf(w).some((f) => Math.hypot(f.x - x, (f.y - y) * 1.6) < f.r);
export const wet = (w, x, y) => isWater(w, x, y) && !onIce(w, x, y); // (in the sea, not on a floe)
export const elevation = (w, x, y) => { const i = Math.floor(x / CELL), j = Math.floor(y / CELL); return !w.elev || i < 0 || j < 0 || i >= w.gw || j >= w.gh ? -1 : w.elev[j * w.gw + i]; };

function paint(w, x, y, ww, hh, t) {
  for (let j = Math.floor(y / CELL); j < (y + hh) / CELL; j++) for (let i = Math.floor(x / CELL); i < (x + ww) / CELL; i++) if (i >= 0 && j >= 0 && i < w.gw && j < w.gh) w.ground[j * w.gw + i] = t;
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
  return terrain(w, x, y) === WALL || !!near(w, x, y, (o) => o.block.r ? Math.hypot(o.x - x, o.y - y) < o.block.r : Math.abs(o.x - x) < o.block.w / 2 && y < o.y + 1 && y > o.y - o.block.d && !(o.door && Math.abs(o.x - x) < 8));
}
// the door of a barn (x, y) has gone in at, or the mouth of a cave flown or walked into (low)
export const doorAt = (w, x, y, z) => near(w, x, y, (o) => (o.door && z === 0 && Math.abs(o.x - x) < 8 && y < o.y - 2 && y > o.y - o.block.d) || (o.cave && z < 25 && Math.hypot(o.x - x, (o.y - y) * 1.5) < 16));
const clearFor = (w, x, y, r) => !near(w, x, y, (o) => Math.hypot(o.x - x, o.y - y) < r + (o.block.w || 0) / 2);
// somewhere for it (x, y): random, on ground that suits it, clear of what stands there
function spot(w, it, ok) {
  for (let n = 0; n < 200; n++) {
    const x = 20 + w.rand() * (w.W - 40), y = 20 + w.rand() * (w.H - 40);
    if (ok(terrain(w, x, y)) && !blocked(w, x, y)) { it.x = x; it.y = y; return it; }
  }
  it.x = w.village?.x ?? W / 2; it.y = w.village?.y ?? H / 2; return it;
}
export const FOOD = { mouse: 25, beetle: 12, worm: 10, lizard: 18, frog: 20, bat: 22, fish: 35 }; // (energy, eaten)
const SPEED = { mouse: 34, beetle: 14, worm: 4, lizard: 42, frog: 24, bat: 55 }; // (running away)
const fits = (kind) => (t) => t === GRASS || t === FLOOR || t === CAVE || ((kind === 'beetle' || kind === 'lizard') && (t === SAND || t === ROCK)) || (kind === 'frog' && t === SAND);
// the weather, a day each: which animals it brings out (how many of each, of all there are)
export const WEATHER = {
  sun: { mouse: 0.3, beetle: 0.25, lizard: 0.45 },
  rain: { worm: 0.5, frog: 0.35, beetle: 0.15 },
  fog: { mouse: 0.6, worm: 0.2, beetle: 0.2 },
  wind: { mouse: 0.35, beetle: 0.4, worm: 0.25 },
  snow: { mouse: 0.75, beetle: 0.25 },
  storm: { frog: 0.5, worm: 0.5 },
  cave: { bat: 0.65, beetle: 0.35 }, barn: { mouse: 1 }, // (inside: always the same)
};
// a new day's weather: what lies about now (most of it) hides, other animals come out; the wind (px/s) blowing
export function setWeather(w, kind) {
  w.weather = kind;
  const a = w.rand() * Math.PI * 2;
  const s = kind === 'wind' ? 22 : kind === 'storm' ? 30 : 0;
  w.wind = { x: Math.cos(a) * s, y: Math.sin(a) * s };
  for (const f of w.food) if (f.gone <= 0 && !(WEATHER[kind][f.kind] > w.rand())) f.gone = 1 + w.rand() * 8;
}
function placeFood(w, f) {
  let r = w.rand();
  f.kind = 'mouse';
  for (const [k, p] of Object.entries(WEATHER[w.weather])) { f.kind = k; if ((r -= p) < 0) break; }
  f.gone = 0; f.a = w.rand() * 6.3; f.run = 0; f.scare = 0;
  return spot(w, f, fits(f.kind));
}
// what a nest is built of, to be had at (x, y) on foot: a twig by a tree, straw by a bale of hay (in a barn)
export function gatherAt(w, x, y) {
  const o = near(w, x, y, (o) => (/^(pine|oak)/.test(o.art) && Math.hypot(o.x - x, o.y - y) < 10) || (o.art === 'hay' && Math.abs(o.x - x) < 18 && y < o.y + 7 && y > o.y - 18));
  return o ? (o.art === 'hay' ? 'straw' : 'twig') : null;
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
    const v = f.run > 0 ? SPEED[f.kind] : f.kind === 'worm' ? 0.5 : f.kind === 'bat' ? 26 : 2; // (bats: always flitting about)
    if (f.run > 0) f.run -= dt;
    f.a += (w.rand() - 0.5) * (f.run > 0 ? 3 : f.kind === 'bat' ? 14 : 5) * dt;
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

// the open sea between two islands (r: across, east-west or not; d: which way, 1 or -1; lat: where it came out, across
// the way): LONG px of it, as wide as an island and its sea; rocks along the way to rest on, wandering from side to
// side round where it came out; fish
export const LONG = 3600;
export function makeSea(r) {
  const rand = rng(r.seed), wide = (r.across ? H : W) + 2 * SEA;
  const w = { seed: r.seed, rand, elev: null, ground: new Uint8Array(0), W: r.across ? LONG : wide, H: r.across ? wide : LONG, gw: 0, gh: 0, out: DEEP, objects: [], food: [], fish: [], gems: [],
    buckets: new Map(), time: 0, weather: 'sun', wind: { x: 0, y: 0 }, room: 'sea', floes: [], ice: 0 };
  let lat = r.lat;
  for (let p = 420 + rand() * 120; p < LONG - 300; p += 520 + rand() * 160) {
    lat = Math.max(200, Math.min(wide - 200, lat + (rand() - 0.5) * 360));
    const q = r.d > 0 ? p : LONG - p;
    add(w, { art: CRAGS[Math.floor(rand() * 3)], x: Math.round(r.across ? q : lat), y: Math.round(r.across ? lat : q), block: { r: 16 }, perch: true });
  }
  for (const o of [...w.objects]) for (let n = 0; n < 14; n++) { const a = rand() * 6.3, d = 40 + rand() * 260; w.fish.push({ x: o.x + Math.cos(a) * d, y: o.y + Math.sin(a) * d, a: rand() * 6.3, t: 0 }); } // (fish round the rocks)
  return w;
}

// inside: a cave (tunnels dug by a wandering walk from its mouth, dark, bats and beetles, treasure to find) or a barn
// (a room of straw, hay bales, beams up to sit on, mice everywhere). Low: the eagle flies no higher than its roof
export function makeRoom(kind, seed) {
  const cave = kind === 'cave', RW = cave ? 1000 : 340, RH = cave ? 760 : 230, gw = RW / CELL, gh = RH / CELL, rand = rng(seed);
  const w = { seed, rand, elev: null, ground: new Uint8Array(gw * gh).fill(WALL), W: RW, H: RH, gw, gh, out: WALL, objects: [], food: [], fish: [], gems: [], buckets: new Map(),
    time: 0, weather: kind, wind: { x: 0, y: 0 }, floes: [], ice: 0, room: kind, roof: cave ? 22 : PERCH + 12, exit: { x: RW / 2, y: RH - 14 } };
  const dig = (x, y, r) => { for (let j = Math.floor((y - r) / CELL); j <= (y + r) / CELL; j++) for (let i = Math.floor((x - r) / CELL); i <= (x + r) / CELL; i++) if (i > 3 && j > 3 && i < gw - 4 && j < gh - 1 && Math.hypot(i * CELL - x, j * CELL - y) < r) w.ground[j * gw + i] = cave ? CAVE : FLOOR; };
  if (cave) {
    const walk = (x, y, a, n) => {
      for (let k = 0; k < n; k++) {
        a += (rand() - 0.5) * 1.1; x += Math.cos(a) * 12; y += Math.sin(a) * 12;
        if (x < 60 || x > RW - 60) a = Math.PI - a; if (y < 60 || y > RH - 90) a = -a;
        x = Math.max(50, Math.min(RW - 50, x)); y = Math.max(50, Math.min(RH - 80, y));
        dig(x, y, 16 + rand() * 18);
        if (rand() < 0.03 && n > 30) walk(x, y, a + (rand() < 0.5 ? 1.4 : -1.4), Math.floor(n / 3));
      }
    };
    for (let y = RH; y > RH - 100; y -= 8) dig(RW / 2, y, 18); // (the way in, from the mouth)
    walk(RW / 2, RH - 100, -Math.PI / 2, 140);
  } else {
    for (let y = 16; y < RH - 14; y += 6) for (let x = 16; x < RW - 16; x += 6) dig(x, y, 6);
    for (let y = RH - 16; y < RH; y += 4) dig(RW / 2, y, 9); // (the door)
    for (const [x, y] of [[50, 70], [290, 70], [60, 170], [280, 165], [120, 60]]) add(w, { art: 'hay', x, y, block: { w: 28, d: 12 } });
    for (const x of [100, 170, 240]) add(w, { art: 'beam', x, y: 118, block: { r: 4 }, perch: true });
  }
  const floor = (t) => t === CAVE || t === FLOOR;
  for (let n = 0; n < (cave ? 24 : 16); n++) w.food.push(placeFood(w, { gone: 0 }));
  for (let n = 0; n < (cave ? 7 : 0); n++) { const g = spot(w, { id: n }, floor); if (Math.hypot(g.x - w.exit.x, g.y - w.exit.y) > 150) w.gems.push(g); }
  return w;
}
