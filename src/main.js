// Von Oben: the eagle in the middle of the screen, the island moving under it (never turning: the eagle turns). Close
// to it on the ground, farther away the higher it flies. Two sticks: the left turns it, the right sets its pace.
import { HEX, tone, mix } from './pixels.js';
import { text, textWidth } from '../lib/font.js';
import { makeWorld, makeRoom, makeSea, update, setWeather, terrain, elevation, hash, isWater, floesOf, doorAt, seedOf, islandName, W, H, SEA, LONG, DEEP, WATER, SAND, GRASS, PATH, ROCK, SNOW, FLOOR, WALL, CAVE, PERCH } from './world.js';
import { makeBird, step, CRUISE, HIGH, FLY_AT, REACH } from './bird.js';
import { eagle, poseOf, beak, lookOf } from './eagle.js';
import { ART, HOUSE_LIGHTS } from './art/island.js';
import * as fam from './family.js';
import * as ui from './menu.js';

const cv = document.getElementById('game'), ctx = cv.getContext('2d');
// the game: all the eagles (kept), the one played (me), its island, where it is (the island, or a cave or barn on it)
let save = fam.load(), fresh = !save, me = null, island = null, world = null, ground = null, bird = null, look = null;
if (!save) save = fam.newGame('', (island = makeWorld(seedOf(0))).nest);
let cw = 0, ch = 0, dpr = 1, zoom = 4, started = false, last = performance.now(), keyPush = 0, notice = null;
const particles = [], wake = [], keys = new Set(); // (wake: where it swam, the water's V spreading behind it)
// a day: DAY seconds (asleep: 12 times as fast). Through it, what the world is tinted with (multiplied: as Lop Hop's
// sunset and morning tint its palette) and how dark it is: day, a sunset, a purple dusk, the night, a pink morning
const DAY = 240, SKY = [[0, '#ffffff', 0], [0.42, '#ffffff', 0], [0.5, mix('#ffffff', '#ff8c5a', 0.55), 0.15], [0.56, '#a088c4', 0.6],
  [0.62, '#55609e', 1], [0.85, '#55609e', 1], [0.92, mix('#ffffff', '#ffb4c4', 0.5), 0.25], [1, '#ffffff', 0]];
let day = 0.08;
// the weather: each day (from the morning) another; what it is called, which animals it brings out
const WEATHERS = ['sun', 'rain', 'fog', 'wind', 'snow', 'storm'], SAY = { sun: ['SONNE', 'EIDECHSEN SONNEN SICH'], rain: ['REGEN', 'WÜRMER UND FRÖSCHE KOMMEN RAUS'],
  fog: ['NEBEL', 'DIE MÄUSE WAGEN SICH RAUS'], wind: ['WIND', 'KÄFER KRABBELN, DER WIND TREIBT DICH AB'],
  snow: ['SCHNEE', 'MÄUSE IM SCHNEE SIEHT MAN GUT'], storm: ['GEWITTER', 'FRÖSCHE UND WÜRMER, ABER STURM!'] };
let wfade = 1, banner = 0;
// a day's weather on an island: the first day sun, then spells of 2 to 4 days each the same (never the same spell
// twice running)
const pick = (k, seed) => WEATHERS[Math.floor(hash(k, seed % 100000, 9) * WEATHERS.length)];
function weatherOf(n, seed) {
  let k = 0, start = 2, was = 'sun';
  while (n >= start) { const len = 2 + Math.floor(hash(++k, seed % 100000, 8) * 3), p = pick(k, seed); was = p === was ? WEATHERS[(WEATHERS.indexOf(p) + 1) % WEATHERS.length] : p; start += len; }
  return was;
}
// how many days running it has snowed (to day n); from the second, the sea near the shore freezing, more each day
const coldRun = (n, seed) => { let k = 0; while (n - k > 1 && weatherOf(n - k, seed) === 'snow') k++; return k; };
function setDay(w, n) { setWeather(w, weatherOf(n, island.seed)); w.ice = Math.min(1, Math.max(0, coldRun(n, island.seed) - 1) / 3); }
let cover = 0; // (the snow lying on the land: 0 .. 1, growing while it snows, melting after)
function newDay() {
  const ev = fam.nextDay(me);
  setDay(island, me.dayN); wfade = 0; banner = 6;
  if (world.room === 'sea') setWeather(world, island.weather);
  if (ev === 'egg') say('EIN EI IM NEST!');
  if (ev === 'grown') say(`${me.brood.chick.name} IST GROSS! UNTER "ADLER": AUSFLIEGEN`);
  if (ev === 'hatch') ui.ask('EIN KÜKEN IST GESCHLÜPFT!', picture((g) => drawChick(g, 0, 0, 0, 'stand'), 40, 30, 4), 'WIE SOLL ES HEISSEN?').then((n) => { me.brood.chick.name = n; fam.store(save); });
  fam.store(save);
}
const say = (text) => { notice = { text, t: 7 }; };
function sky() {
  const i = SKY.findIndex(([at]) => at > day), [a0, c0, d0] = SKY[i - 1], [a1, c1, d1] = SKY[i], f = (day - a0) / (a1 - a0), e = f * f * (3 - 2 * f);
  return [mix(c0, c1, e), d0 + (d1 - d0) * e];
}
globalThis.vonOben = { get bird() { return bird; }, get world() { return world; }, get me() { return me; }, save, setDay: (d) => (day = d), newDay, play }; // (to look into, from the console)
const ZOOM_GROUND = 4, ZOOM_AIR = 1.5, VERSION = 'V17'; // (on the title: is the new code there?)

function resize() {
  dpr = window.devicePixelRatio || 1; cw = cv.width = Math.round(innerWidth * dpr); ch = cv.height = Math.round(innerHeight * dpr);
}
addEventListener('resize', resize); resize();

// the ground, drawn once, a pixel each: the sea darker the deeper, foam at the shore, sand, grass and paths speckled;
// the land lit by how it slopes (the light from the top left), the mountains most: bare rock, snow on the peaks.
// Inside: a cave's floor of dark stone, its walls black, lit at their foot; a barn's straw, its plank walls
function paintGround(world, snowy = false) { // (snowy: the land under snow, the sea as it is)
  const W = world.W, H = world.H, shallows = new Map(); // (64 px squares of the sea → the shallow spots in them: x, y, how deep)
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), px = new Uint32Array(img.data.buffer);
  const int = (h) => 0xff000000 | (parseInt(h.slice(5, 7), 16) << 16) | (parseInt(h.slice(3, 5), 16) << 8) | parseInt(h.slice(1, 3), 16);
  const deep = [0, 0.25, 0.5, 0.75, 1].map((t) => int(mix(tone(HEX.blue, 'shade'), tone(HEX.blue, 'dark'), t)));
  const shallow = [0, 0.25, 0.5, 0.75, 1].map((t) => int(mix(tone(HEX.blue, 'light'), HEX.blue, t)));
  const foam = int(mix(tone(HEX.blue, 'light'), HEX.white, 0.55));
  const C = {
    [SAND]: [int(HEX.sand), int(HEX.camel), int(tone(HEX.sand, 'light'))],
    [GRASS]: [int(HEX.green), int(HEX.lightGreen), int(HEX.darkGreen)],
    4: [int(HEX.camel), int(HEX.ochre), int(HEX.sand)],
  };
  const grass = [int(tone(HEX.green, 'shade')), int(HEX.green), int(mix(HEX.green, HEX.lightGreen, 0.45))];
  const rock = [int(tone(HEX.slate, 'shade')), int(HEX.slate), int(HEX.blueGrey), int(HEX.charcoal), int(HEX.lightGrey)];
  const snow = [int(mix(HEX.lightGrey, HEX.blueGrey, 0.3)), int(mix(HEX.white, HEX.lightGrey, 0.45)), int(HEX.white)];
  const cave = [int(tone(HEX.charcoal, 'shade')), int(HEX.charcoal), int(HEX.darkGrey), int(tone(HEX.slate, 'shade')), int(tone(HEX.black, 'line'))];
  const straw = [int(HEX.ochre), int(HEX.camel), int(tone(HEX.ochre, 'shade')), int(HEX.brown), int(tone(HEX.brown, 'shade')), int(tone(HEX.deepBrown, 'dark'))];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = terrain(world, x, y), e = elevation(world, x, y), h = hash(x, y, 1);
    let col;
    if (world.room) { // (a wall's face: just above the floor, 8 px of it; above that the dark)
      const face = t === WALL && terrain(world, x, y + 8) !== WALL;
      if (world.room === 'cave') col = t === CAVE ? cave[h < 0.08 ? 2 : h > 0.93 ? 0 : 1] : face ? cave[3] : cave[4];
      else col = t === FLOOR ? straw[h < 0.1 ? 1 : h > 0.9 ? 2 : 0] : face ? (x % 9 === 0 ? straw[4] : straw[3]) : straw[5];
    } else if (t === DEEP) col = deep[Math.min(4, Math.floor(((-e - 0.07) / 0.2) * 5))];
    else if (t === WATER) col = e > -0.006 ? foam : shallow[Math.min(4, Math.floor((-e / 0.07) * 5))];
    else {
      const lit = (elevation(world, x + 3, y + 3) - elevation(world, x - 3, y - 3)) * 70, l = lit > 0.35 ? 2 : lit < -0.35 ? 0 : 1;
      if (snowy && (t !== ROCK || hash(x >> 3, y >> 3, 2) > 0.3)) col = t === PATH ? snow[0] : h < 0.04 ? snow[0] : snow[l]; // (snow over it all, the rock showing through here and there)
      else if (t === ROCK) col = h < 0.05 ? rock[3] : h > 0.96 ? rock[4] : rock[l];
      else if (t === SNOW) col = snow[l];
      else if (t === GRASS) col = h < 0.06 ? C[t][1] : h > 0.95 ? C[t][2] : grass[l];
      else { const k = C[t]; col = h < 0.06 ? k[1] : h > 0.95 ? k[2] : k[0]; }
    }
    px[y * W + x] = col;
    if (t === WATER && e > -0.035 && !(x % 2) && !(y % 2)) { // (the shallows, for the waves: see draw)
      const k = Math.floor(x / 64) * 1000 + Math.floor(y / 64);
      if (!shallows.has(k)) shallows.set(k, []);
      shallows.get(k).push(x, y, e);
    }
  }
  g.putImageData(img, 0, 0);
  return { canvas: c, shallows };
}
// a picture (for the menu): drawn by f at scale k, w by h pixels
function picture(f, w, h, k) {
  const c = document.createElement('canvas'); c.width = w * k; c.height = h * k;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.scale(k, k); f(g); return c;
}
const portrait = (lk, k = 3) => picture((g) => { const p = eagle('stand', Math.PI * 0.35, lk); g.drawImage(p.canvas, 15 - p.ox, 26 - p.oy); }, 30, 30, k);
// a chick (by how grown) or what grew of it, in the nest at (x, y)
function drawChick(g, x, y, grown, pose, lk = lookOf(0, grown)) { const p = eagle(pose, Math.PI / 2 + Math.sin(world.time * 1.3) * 0.4, lk); g.drawImage(p.canvas, Math.round(x + 20 - p.ox), Math.round(y + 24 - p.oy)); }

// changing eagle, island, going in and out: the world it is in, its ground drawn (kept: in and out again quickly)
const grounds = new Map();
function groundOf(w, key, snowy) {
  if (!grounds.has(key)) { if (grounds.size > 2) grounds.delete([...grounds.keys()].find((k) => k !== 'island' && k !== 'snow')); grounds.set(key, paintGround(w, snowy)); }
  return grounds.get(key);
}
function toIsland(seed) {
  if (island?.seed !== seed) { island = makeWorld(seed); grounds.clear(); }
  setDay(island, me.dayN); wfade = 1; cover = island.weather === 'snow' ? 1 : 0;
  world = island; ground = groundOf(island, 'island');
}
const stash = () => { me.bird = { x: bird.x, y: bird.y, z: bird.z, a: bird.a, state: bird.state === 'dive' ? 'swim' : bird.state, energy: bird.energy, caught: bird.caught, prey: bird.prey }; me.day = day; };
function play(e) {
  if (me && bird) stash();
  me = e; save.current = e.id; look = lookOf(e.look);
  toIsland(e.isl);
  bird = Object.assign(makeBird(0, 0), e.bird, { events: [] }); day = e.day;
  if (e.room) goIn(e.room, true);
  particles.length = 0; wake.length = 0;
  say(`${e.name}: ${e.room?.kind === 'sea' ? 'ÜBERS MEER' : `INSEL ${islandName(e.isl)}`}`);
  fam.store(save);
}
// a barn's door, a cave's mouth (r: which, and where on the island): in; out, at its way out, before the door
function goIn(r, resume) {
  if (r.kind === 'sea') { world = makeSea(r); ground = SEA_GROUND; me.room = r; setWeather(world, island.weather); return; }
  world = makeRoom(r.kind, r.seed); ground = groundOf(world, r.key); me.room = r;
  if (!resume) Object.assign(bird, { x: world.exit.x, y: world.exit.y - 30, a: -Math.PI / 2, z: Math.min(bird.z, world.roof - 4), perch: null, target: null });
  say(r.kind === 'cave' ? 'EINE HÖHLE! IRGENDWO GLITZERT ES...' : 'EINE SCHEUNE VOLLER MÄUSE');
}
function goOut() {
  const r = me.room; me.room = null; world = island; ground = groundOf(island, 'island');
  Object.assign(bird, { x: r.x, y: r.y + (r.kind === 'cave' ? 22 : 12), a: Math.PI / 2, perch: null, target: null });
  if (bird.state === 'ground') bird.z = 0;
}
// out beyond the sea's edge: the open sea, a long way (rocks to rest on); at its far end the next island, at its near
// end back to this one
const SEA_GROUND = { canvas: null, shallows: new Map() };
function travel() {
  const ex = bird.x > W + SEA ? 1 : bird.x < -SEA ? -1 : 0, ey = ex ? 0 : bird.y > H + SEA ? 1 : bird.y < -SEA ? -1 : 0; // (at a corner: across)
  if (!ex && !ey) return;
  const across = !!ex, d = ex || ey, lat = (across ? bird.y : bird.x) + SEA;
  goIn({ kind: 'sea', across, d, lat, seed: (island.seed % 100000) * 8 + (across ? 0 : 2) + (d > 0 ? 1 : 0) }, true);
  if (across) { bird.x = d > 0 ? 30 : LONG - 30; bird.y = lat; } else { bird.y = d > 0 ? 30 : LONG - 30; bird.x = lat; }
  bird.perch = null; bird.target = null; wake.length = 0;
  say('DAS OFFENE MEER! EIN LANGER WEG\nRUH DICH AUF DEN FELSEN AUS');
  stash(); fam.store(save);
}
// how far over the open sea it has come (0 .. LONG)
const along = () => { const r = me.room; return r.across ? (r.d > 0 ? bird.x : LONG - bird.x) : (r.d > 0 ? bird.y : LONG - bird.y); };
function crossing() {
  const r = me.room, p = along();
  if (p > 0 && p < LONG) return;
  const on = p >= LONG, lat = (r.across ? bird.y : bird.x) - SEA, edge = (k) => (k > 0 ? -SEA + 30 : (r.across ? W : H) + SEA - 30); // (coming in at the edge on the side it comes from)
  me.room = null;
  if (on) me.isl = fam.onward(save, me);
  toIsland(me.isl);
  const at = on ? edge(r.d) : edge(-r.d);
  if (r.across) { bird.x = at; bird.y = lat; } else { bird.y = at; bird.x = lat; }
  bird.perch = null; bird.target = null; wake.length = 0;
  if (!on) { say(`ZURÜCK: INSEL ${islandName(me.isl)}`); stash(); fam.store(save); return; }
  const rs = fam.residentOf(save, me.isl);
  say(`INSEL ${islandName(me.isl)}${rs && rs !== me ? `\nHIER WOHNT ${rs.name}` : !me.home ? '\nNOCH FREI: BAU DIR HIER EIN NEST!' : ''}${island.feature ? `\n${SURPRISE[island.feature]}` : ''}`);
  stash(); fam.store(save);
}
const SURPRISE = { caves: 'VOLLER HÖHLEN!', wreck: 'EIN WRACK AM STRAND!', farm: 'EINE BAUERNINSEL!', tower: 'MIT LEUCHTTURM!', isles: 'VIELE KLEINE INSELN!' };
// the menu: every eagle, its egg or chick; to change to one (a grown chick: flying off)
function openMenu() {
  stash();
  const rows = [];
  for (const e of save.eagles) {
    rows.push({ picture: portrait(lookOf(e.look)), name: e.name || '?', now: e === me, action: e === me ? null : ['SPIELEN', () => play(e)],
      lines: [`INSEL ${islandName(e.isl)}, TAG ${e.dayN}`, fam.broodSay(e), `${e.bird.caught} BEUTE${e.gems ? `, ${e.gems} SCHÄTZE` : ''}`] });
    const c = e.brood.chick;
    if (e.brood.stage === 'egg') rows.push({ sub: true, picture: picture((g) => ART.egg.draw(g, 3, 2), 10, 9, 6), name: 'EIN EI', lines: ['SCHLÜPFT MORGEN'] });
    if (c) rows.push({ sub: true, picture: portrait(c.ready ? lookOf(c.look) : lookOf(0, fam.growth(c))), name: c.name || 'KÜKEN', lines: [c.ready ? 'IST GROSS UND KANN AUSFLIEGEN' : `WÄCHST: TAG ${c.grown + 1} VON ${fam.GROW_DAYS}`],
      action: c.ready ? ['AUSFLIEGEN', () => play(fam.fledge(save, e))] : null });
  }
  ui.menu(rows);
}
const menuBtn = document.getElementById('menuBtn');
menuBtn.onclick = () => { if (started && !ui.open()) openMenu(); };
let saveAt = 5;
addEventListener('pagehide', () => { if (bird) { stash(); fam.store(save); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && bird) { stash(); fam.store(save); } });

// the sticks: where a finger went down is the stick's middle (near its place: that place)
const sticks = { turn: { id: null, ox: 0, oy: 0, v: 0 }, push: { id: null, ox: 0, oy: 0, v: 0 } };
const R = () => Math.min(cw, ch) * 0.14;
const home = (s) => (s === sticks.turn ? [cw * 0.14, ch * 0.8] : [cw * 0.86, ch * 0.72]);
cv.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (!started) { started = true; menuBtn.style.display = 'block'; return; }
  const x = e.clientX * dpr, y = e.clientY * dpr, s = x < cw / 2 ? sticks.turn : sticks.push;
  if (s.id !== null) return;
  const [hx, hy] = home(s), close = Math.hypot(x - hx, y - hy) < R() * 1.6;
  s.id = e.pointerId; s.ox = close ? hx : x; s.oy = close ? hy : y;
  cv.setPointerCapture(e.pointerId); move(s, x, y);
});
const move = (s, x, y) => { s.v = Math.max(-1, Math.min(1, s === sticks.turn ? (x - s.ox) / R() : -(y - s.oy) / R())); };
cv.addEventListener('pointermove', (e) => { for (const s of Object.values(sticks)) if (s.id === e.pointerId) move(s, e.clientX * dpr, e.clientY * dpr); });
const up = (e) => { for (const s of Object.values(sticks)) if (s.id === e.pointerId) { s.id = null; s.v = 0; } };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
document.addEventListener('gesturestart', (e) => e.preventDefault());
addEventListener('keydown', (e) => { if (ui.open()) return; keys.add(e.key); if (!started) { started = true; menuBtn.style.display = 'block'; } });
addEventListener('keyup', (e) => keys.delete(e.key));
const held = (...k) => k.some((x) => keys.has(x));

function input(dt) { // (keys too: ←→ turn; ↑ held climbs the pace, slowly, to flying; ↓ dives)
  if (held('ArrowUp', 'w')) keyPush = Math.min(1, keyPush + dt * 0.7); else keyPush = held('ArrowDown', 's') ? -1 : 0;
  const kt = (held('ArrowRight', 'd') ? 1 : 0) - (held('ArrowLeft', 'a') ? 1 : 0);
  return { turn: sticks.turn.id !== null ? sticks.turn.v : kt, push: sticks.push.id !== null ? sticks.push.v : keyPush };
}

function frame(now) {
  requestAnimationFrame(frame); // (first: an error in one frame doesn't stop the game)
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; // (the first frame's time can be before the script ran)
  if (ui.open()) { draw(); return; } // (asking, the menu: it all waits)
  update(world, dt, started ? bird : null);
  if (started) {
    const home = !me.room && fam.residentOf(save, me.isl) === me;
    bird.nestOk = home; bird.feeds = home && fam.hungry(me); // (only its own nest to sleep in; a hungry chick there: fed)
    bird.wants = fam.needs(save, me); // (no nest here yet: twigs and straw for one)
    step(bird, input(dt), dt, world);
    if (me.room?.kind === 'sea') crossing();
    else if (!me.room) travel();
    if (!me.room) { const d = doorAt(world, bird.x, bird.y, bird.z); if (d) goIn({ kind: d.door ? 'barn' : 'cave', key: `${island.seed}:${d.room}`, seed: (island.seed % 100000) * 20 + Number(d.room.slice(-1)) + (d.door ? 0 : 10), x: d.x, y: d.y }); }
    else if (world.exit && bird.y > world.exit.y - 12 && Math.abs(bird.x - world.exit.x) < 22) goOut();
    for (const g of world.gems) { // (treasure: picked up, low, kept found)
      const k = `${world.seed}:${g.id}`;
      if (!save.gems[k] && bird.z < 12 && Math.hypot(g.x - bird.x, g.y - bird.y) < 10) { save.gems[k] = 1; me.gems++; particles.push({ type: 'gem', x: g.x, y: g.y, t: 0 }); fam.store(save); }
    }
    if ((saveAt -= dt) < 0) { saveAt = 5; stash(); fam.store(save); }
    const was = day;
    day = (day + (dt * (bird.asleep ? 12 : 1)) / DAY) % 1;
    if (was < 0.95 && day >= 0.95) newDay();
  }
  cover = Math.max(0, Math.min(1, cover + (island.weather === 'snow' ? dt / 40 : -dt / 60))); // (snowing: covered in 40 s; after: melted in a minute)
  wfade = Math.min(1, wfade + dt / 6); banner = Math.max(0, banner - dt); if (notice) notice.t -= dt;
  for (const e of bird.events.splice(0)) {
    if (e.type === 'feed') fam.feed(me);
    if (e.type === 'build') { const b = fam.build(save, me, e.kind, island.nest); if (b === 'done') say('DEIN NEST IST FERTIG!\nHIER WOHNST DU JETZT'); fam.store(save); }
    particles.push({ ...e, t: 0 });
    if (e.type === 'splash') for (let i = 0; i < 14; i++) { const a = Math.random() * Math.PI * 2, s = 10 + Math.random() * 25; particles.push({ type: 'drop', x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: 30 + Math.random() * 45, t: 0 }); }
  }
  if (bird.state === 'swim' && bird.v > 2 && (wake.at || 0) <= world.time) { wake.push({ x: bird.x, y: bird.y, a: bird.a, t: 0 }); wake.at = world.time + 0.12; }
  for (let i = wake.length - 1; i >= 0; i--) if ((wake[i].t += dt) > 2) wake.splice(i, 1);
  for (let i = particles.length - 1; i >= 0; i--) if ((particles[i].t += dt) > 1.2) particles.splice(i, 1);
  const up = bird.state === 'ground' ? 0 : bird.z; // (in its nest: as on the ground)
  const want = ZOOM_GROUND + (ZOOM_AIR - ZOOM_GROUND) * Math.min(1, up / CRUISE) - Math.max(0, (up - CRUISE) / (HIGH - CRUISE)) * 0.4; // (higher yet: farther out)
  zoom += (want - zoom) * Math.min(1, dt * 3);
  draw();
}

function draw() {
  const S = zoom * dpr, camx = bird.x, camy = bird.y - bird.z, t = world.time;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = world.room && world.room !== 'sea' ? '#120f1c' : tone(HEX.blue, 'dark'); ctx.fillRect(0, 0, cw, ch);
  ctx.setTransform(S, 0, 0, S, Math.round(cw / 2 - camx * S), Math.round(ch / 2 - camy * S));
  if (ground.canvas) ctx.drawImage(ground.canvas, 0, 0); // (the open sea: none, only the sea's color)
  if (!world.room && cover > 0.01) { ctx.globalAlpha = cover; ctx.drawImage(groundOf(island, 'snow', true).canvas, 0, 0); ctx.globalAlpha = 1; }
  const x0 = camx - cw / 2 / S - 40, x1 = camx + cw / 2 / S + 40, y0 = camy - ch / 2 / S - 20, y1 = camy + ch / 2 / S + 60;
  // the sea: wave crests coming and going (a little arc each), and waves running in to the shore: a line of foam where
  // the water is as shallow as each has got, fading as it reaches the sand; two at a time
  const wdx = world.wind.x * t * 0.9, wdy = world.wind.y * t * 0.9; // (the wind: the crests running along with it)
  const open = !world.room || world.room === 'sea'; // (outdoors: an island, the open sea)
  if (open) for (let j = Math.floor((y0 - wdy) / 14); j < (y1 - wdy) / 14; j++) for (let i = Math.floor((x0 - wdx) / 14); i < (x1 - wdx) / 14; i++) {
    const h = hash(i, j, 3), f = Math.sin(t * 0.9 + h * 40);
    if (f < 0.3) continue;
    const x = Math.round(i * 14 + h * 9 + wdx) + Math.floor(((t * 0.9 + h * 40) % (Math.PI * 2)) * 0.8), y = Math.round(j * 14 + hash(i, j, 4) * 11 + wdy);
    if (!isWater(world, x, y)) continue;
    ctx.fillStyle = `rgba(178,205,232,${Math.min(1, (f - 0.3) * 2.5)})`;
    ctx.fillRect(x, y, 4, 1); ctx.fillRect(x - 1, y + 1, 1, 1); ctx.fillRect(x + 4, y + 1, 1, 1);
  }
  for (let k = 0; k < 2; k++) {
    const p = (t * 0.2 + k * 0.5) % 1, level = -0.034 + p * 0.033;
    ctx.fillStyle = `rgba(253,251,246,${Math.sin(p * Math.PI) * 0.8})`;
    for (let bj = Math.floor(y0 / 64); bj <= y1 / 64; bj++) for (let bi = Math.floor(x0 / 64); bi <= x1 / 64; bi++) {
      const c = ground.shallows.get(bi * 1000 + bj);
      if (c) for (let n = 0; n < c.length; n += 3) if (Math.abs(c[n + 2] - level) < 0.0016) ctx.fillRect(c[n], c[n + 1], 2, 2);
    }
  }
  // the wake: two lines spreading out from where it swam, fading
  for (const k of wake) {
    const nx = -Math.sin(k.a), ny = Math.cos(k.a), d = 2 + k.t * 7;
    ctx.fillStyle = `rgba(253,251,246,${0.6 * (1 - k.t / 2)})`;
    ctx.fillRect(Math.round(k.x + nx * d), Math.round(k.y + ny * d * 0.6), 2, 1); ctx.fillRect(Math.round(k.x - nx * d), Math.round(k.y - ny * d * 0.6), 2, 1);
  }
  // fish: shadows under the water
  ctx.fillStyle = 'rgba(35,45,90,0.4)';
  for (const f of world.fish) if (f.t <= 0 && f.x > x0 && f.x < x1 && f.y > y0 && f.y < y1) {
    const across = Math.abs(Math.cos(f.a)) > Math.abs(Math.sin(f.a));
    ctx.fillRect(Math.round(f.x) - (across ? 3 : 1), Math.round(f.y) - (across ? 1 : 3), across ? 6 : 2, across ? 2 : 6);
  }
  for (const f of floesOf(world)) if (f.x > x0 - 30 && f.x < x1 + 30 && f.y > y0 - 30 && f.y < y1 + 30) { // (ice floes: flat, lumpy, pale, a darker edge where they lie in the water)
    const pts = Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2, r = f.r * (0.75 + hash(f.s, k, 31) * 0.4); return [f.x + Math.cos(a) * r, f.y + (Math.sin(a) * r) / 1.6]; });
    const path = (dy) => { ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y + dy) : ctx.moveTo(x, y + dy))); ctx.closePath(); ctx.fill(); };
    ctx.fillStyle = mix(HEX.blueGrey, HEX.blue, 0.4); path(2);
    ctx.fillStyle = mix(HEX.white, HEX.lightGrey, 0.4); path(0);
    ctx.fillStyle = HEX.white; ctx.fillRect(Math.round(f.x - f.r * 0.4), Math.round(f.y - f.r * 0.25), Math.round(f.r * 0.5), 1);
  }
  for (const f of world.food) if (f.gone <= 0 && f.x > x0 && f.x < x1 && f.y > y0 && f.y < y1) {
    const bat = f.kind === 'bat', s = bat ? ART[Math.sin(t * 22 + f.x) > 0 ? 'bat' : 'bat1'] : ART[f.kind], hop = bat ? 8 : f.run > 0 && f.kind === 'mouse' && Math.sin(t * 30 + f.x) > 0 ? 1 : 0; // (running: a scurry; a bat: up, flapping)
    if (bat) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(Math.round(f.x) - 2, Math.round(f.y), 4, 1); }
    s.draw(ctx, Math.round(f.x - s.w / 2 + (f.kind === 'worm' && Math.sin(t * 4 + f.x) > 0 ? 1 : 0)), Math.round(f.y - s.h + 1 - hop), Math.cos(f.a) > 0);
  }
  for (const g of world.gems) if (!save.gems[`${world.seed}:${g.id}`]) { // (treasure, glinting)
    ART.gem.draw(ctx, Math.round(g.x) - 3, Math.round(g.y) - 6);
    if (Math.sin(t * 3 + g.id * 2) > 0.85) { ctx.fillStyle = HEX.white; ctx.fillRect(Math.round(g.x) + 1, Math.round(g.y) - 9, 1, 3); ctx.fillRect(Math.round(g.x), Math.round(g.y) - 8, 3, 1); }
  }
  // shadows, then all that stands, back to front (the eagle among it, or over it all when high)
  const seen = world.objects.filter((o) => o.x > x0 && o.x < x1 && o.y > y0 && o.y < y1);
  ctx.fillStyle = 'rgba(30,40,70,0.22)';
  for (const o of seen) if (!o.cave) { ctx.beginPath(); ctx.ellipse(o.x + 2, o.y, o.block.w ? 18 : 6, o.block.w ? 4 : 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
  for (const o of seen) if (o.perch && isWater(world, o.x, o.y)) { // (a rock in the sea: the water foaming round its foot)
    const f = (t * 0.5 + hash(o.x, o.y, 2)) % 1;
    ctx.strokeStyle = `rgba(253,251,246,${0.8 * (1 - f)})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(o.x, o.y - 1, 23 + f * 12, 6 + f * 4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(30,40,70,0.22)';
  }
  if (bird.state !== 'dive' && !(bird.state === 'ground' && bird.z > 0)) {
    const s = 1 - (bird.z / CRUISE) * 0.45; ctx.beginPath(); ctx.ellipse(bird.x + bird.z * 0.3, bird.y + bird.z * 0.15, 6 * s, 2.5 * s, 0, 0, Math.PI * 2); ctx.fill();
  }
  const high = bird.z >= 20, gust = world.weather === 'storm' ? 1.7 : world.weather === 'wind' ? 1 : 0;
  const others = me.room ? [] : save.eagles.filter((e) => e !== me && e.isl === me.isl && !e.room && e.bird.x > x0 && e.bird.x < x1 && e.bird.y > y0 && e.bird.y < y1);
  const drawn = [...seen, ...others.map((e) => ({ other: e, y: e.bird.y + 0.5 })), ...(high ? [] : [{ bird: true, y: bird.y + 0.5 }])].sort((a, b) => a.y - b.y);
  for (const o of drawn) {
    if (o.bird) { drawBird(); continue; }
    if (o.other) { const b = o.other.bird, p = eagle(b.state === 'air' ? 'glide' : 'stand', b.a, lookOf(o.other.look)); ctx.drawImage(p.canvas, Math.round(b.x - p.ox), Math.round(b.y - b.z - p.oy)); continue; } // (the other eagles here: where they were left)
    const s = o.art === 'fountain' ? ART[`fountain${Math.floor(t * 6) % 3}`] : ART[o.art];
    if (gust && /^(pine|oak|bush)/.test(o.art)) { // (the wind: trees and bushes leaning with it, swaying; the higher, the more)
      const k = (Math.sign(world.wind.x) * 0.06 + Math.sin(t * 2.6 + o.x * 0.05 + o.y * 0.03) * 0.07) * gust;
      ctx.save(); ctx.translate(o.x, o.y + 1); ctx.transform(1, 0, -k, 1, 0, 0); s.draw(ctx, -s.w / 2, -s.h); ctx.restore();
    } else s.draw(ctx, o.x - s.w / 2, o.y - s.h + 1);
    if (o.nest && !fam.residentOf(save, me.isl)) { // (no nest yet: the twigs and straw brought so far)
      const got = fam.built(save, me.isl), bits = [...Array(got.twig || 0).fill('twig'), ...Array(got.straw || 0).fill('straw')];
      bits.forEach((k, i) => { const a = i * 2.4; ART[k].draw(ctx, Math.round(o.x - 3 + Math.cos(a) * 7), Math.round(o.y - PERCH - 2 + Math.sin(a) * 3)); });
    } else if (o.nest) {
      ART.nest.draw(ctx, o.x - ART.nest.w / 2, o.y - PERCH - ART.nest.h / 2);
      const r = fam.residentOf(save, me.isl), b = r?.brood; // (its egg, its chick)
      if (b?.stage === 'egg') ART.egg.draw(ctx, o.x + 4, o.y - PERCH - 4);
      if (b?.stage === 'chick') drawChick(ctx, o.x + 7 - 20, o.y - PERCH + 1 - 24, fam.growth(b.chick), sky()[1] > 0.6 ? 'sleep' : 'stand', b.chick.ready ? lookOf(b.chick.look) : undefined);
    }
  }
  // clouds: their shadows on the ground (in sunshine), the clouds up at CLOUD; high, the eagle over them, else under
  const [, darkNow] = sky(), cl = open && CLOUDS[world.weather];
  if (cl && (world.weather === 'sun' || world.weather === 'wind')) layered(S, camx, camy, (g) => clouds(g, x0, x1, y0, y1, 0, '#000', null), 0.2 * wfade * (1 - darkNow), 35, 17);
  const over = Math.min(1, Math.max(0, (bird.z - CLOUD + 10) / 20)), cloudA = (0.25 + 0.67 * over) * wfade;
  if (high && bird.z > CLOUD) { if (cl) layered(S, camx, camy, (g) => clouds(g, x0, x1, y0, y1, CLOUD, cl[1], cl[2]), cloudA, 0, 0); drawBird(); }
  else { if (high) drawBird(); if (cl) layered(S, camx, camy, (g) => clouds(g, x0, x1, y0, y1, CLOUD, cl[1], cl[2]), cloudA, 0, 0); }
  for (const p of particles) if (p.type === 'drop') { // (thrown up, falling back)
    const z = p.vz * p.t - 90 * p.t * p.t;
    if (z > 0) { ctx.fillStyle = 'rgba(253,251,246,0.9)'; ctx.fillRect(Math.round(p.x + p.vx * p.t), Math.round(p.y + p.vy * p.t - z), 1, 2); }
  }
  for (const p of particles) if (p.type === 'splash' || p.type === 'miss') {
    ctx.strokeStyle = `rgba(253,251,246,${1 - p.t / 1.2})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 4 + p.t * 14, 1.5 + p.t * 5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  // the time of day: the world tinted; at night the windows lit
  const [tint, dark] = sky();
  if (world.room !== 'cave' && (dark > 0 || tint !== '#ffffff')) {
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = tint; ctx.fillRect(x0 - 50, y0 - 200, x1 - x0 + 100, y1 - y0 + 300); ctx.globalCompositeOperation = 'source-over';
    if (dark > 0.05) for (const o of seen) if (o.tower) { // (the lighthouse: its lamp lit, a beam sweeping round)
      const lx = o.x, ly = o.y - PERCH - 6, a = t * 1.2;
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 18); g.addColorStop(0, `rgba(255,220,120,${0.7 * dark})`); g.addColorStop(1, 'rgba(255,220,120,0)'); ctx.fillStyle = g; ctx.fillRect(lx - 18, ly - 18, 36, 36);
      ctx.fillStyle = `rgba(255,230,150,${0.22 * dark})`; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + Math.cos(a - 0.12) * 260, ly + Math.sin(a - 0.12) * 180); ctx.lineTo(lx + Math.cos(a + 0.12) * 260, ly + Math.sin(a + 0.12) * 180); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (dark > 0.05) for (const o of seen) if (o.art.startsWith('house')) {
      const s = ART[o.art], sx = o.x - s.w / 2, sy = o.y - s.h + 1;
      for (const [lx, ly, lw, lh] of HOUSE_LIGHTS) {
        ctx.fillStyle = `rgba(255,190,80,${0.12 * dark})`; ctx.fillRect(sx + lx - 3, sy + ly - 2, lw + 6, lh + 8);
        ctx.fillStyle = `rgba(255,214,110,${0.95 * dark})`; ctx.fillRect(sx + lx + 1, sy + ly + 1, lw - 2, lh - 2);
      }
    }
  }
  // rain: rings on the water where the drops fall
  if (open && (world.weather === 'rain' || world.weather === 'storm')) for (let i = 0; i < 60; i++) {
    const ph = t * 1.4 + hash(i, 2, 11), k = Math.floor(ph), p = ph - k, x = Math.round(x0 + hash(i, k, 12) * (x1 - x0)), y = Math.round(y0 + hash(i, k, 13) * (y1 - y0));
    if (!isWater(world, x, y)) continue;
    ctx.strokeStyle = `rgba(253,251,246,${0.6 * (1 - p) * wfade})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, 1 + p * 4, 0.5 + p * 1.6, 0, 0, Math.PI * 2); ctx.stroke();
  }
  // flying: what can be caught blinks, a pixel each, to be seen from up there
  if (bird.state === 'air' && bird.z > 20) {
    const a = Math.min(1, (bird.z - 20) / 30), q = 4;
    for (const f of [...world.food.filter((f) => f.gone <= 0), ...world.fish.filter((f) => f.t <= 0)]) {
      if (f.x < x0 || f.x > x1 || f.y < y0 || f.y > y1 || Math.sin(t * 7 + f.x * 0.37 + f.y) < 0) continue;
      const px = Math.round(f.x) - 2, py = Math.round(f.y) - 3;
      ctx.fillStyle = `rgba(43,37,65,${a * 0.8})`; ctx.fillRect(px - 1, py - 1, q + 2, q + 2);
      ctx.fillStyle = f.kind ? `rgba(255,226,90,${a})` : `rgba(253,251,246,${a})`; ctx.fillRect(px, py, q, q);
    }
  }
  // fixed on its prey: brackets round it, closing in
  const g = bird.target || nearFish();
  if (g && (g.nest || (g.kind ? g.gone <= 0 : g.t <= 0))) {
    const r = (g.nest ? 20 : 7) + Math.sin(t * 8) * 1.5, x = Math.round(g.x), y = Math.round(g.y) - (g.nest ? PERCH : 2);
    ctx.fillStyle = HEX.yellow;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.fillRect(x + sx * r - (sx > 0 ? 3 : 0), y + sy * r - (sy > 0 ? 1 : 0), 4, 1); ctx.fillRect(x + sx * r - (sx > 0 ? 1 : 0), y + sy * r - (sy > 0 ? 3 : 0), 1, 4); }
  }
  // rays of sunlight (in the sun), slanting down from the top left: fixed on the world, each its own stretch of it
  const ray = open && world.weather === 'sun' ? 0.16 * wfade * (1 - dark) : 0, K = 0.6, RC = 230, RL = 420;
  if (ray > 0.005) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = Math.floor((x0 - y1 * K) / RC) - 1; i <= (x1 - y0 * K) / RC; i++) for (let j = Math.floor(y0 / RL) - 1; j <= y1 / RL; j++) {
      if (hash(i, j, 18) > 0.45) continue;
      const u = i * RC + hash(i, j, 19) * RC * 0.6, bw = 14 + hash(i, j, 20) * 36, top = j * RL + hash(i, j, 21) * RL * 0.4, bot = top + RL * (0.6 + hash(i, j, 22) * 0.6);
      const a = ray * (0.7 + 0.3 * Math.sin(t * 0.5 + i * 2 + j));
      const g = ctx.createLinearGradient(0, top, 0, bot); g.addColorStop(0, 'rgba(255,236,190,0)'); g.addColorStop(0.3, `rgba(255,236,190,${a})`); g.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(u + top * K, top); ctx.lineTo(u + bw + top * K, top); ctx.lineTo(u + bw + bot * K, bot); ctx.lineTo(u + bot * K, bot); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (open) weather(S);
  if (world.room === 'cave') { // (the dark: only round the eagle a little light)
    const x = cw / 2, y = ch / 2, g = ctx.createRadialGradient(x, y, 25 * S, x, y, 95 * S);
    g.addColorStop(0, 'rgba(8,6,14,0)'); g.addColorStop(1, 'rgba(8,6,14,0.96)'); ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
  }
  if (bird.state === 'dive') { ctx.fillStyle = 'rgba(40,70,130,0.3)'; ctx.fillRect(0, 0, cw, ch); }
  hud(S, camx, camy);
}

// the weather over it all, on the screen: rain falling, fog drifting, the wind blowing streaks and leaves along
function weather(S) {
  const t = world.time, f = wfade, u = Math.max(2, Math.round(Math.min(cw, ch) / 170)), wk = world.weather;
  if (wk === 'rain' || wk === 'storm') {
    const storm = wk === 'storm', n = storm ? 260 : 150, slant = storm ? 0.45 : 0.2;
    ctx.fillStyle = `rgba(${storm ? '40,45,80' : '60,70,110'},${(storm ? 0.38 : 0.2) * f})`; ctx.fillRect(0, 0, cw, ch);
    ctx.strokeStyle = `rgba(200,215,240,${0.55 * f})`; ctx.lineWidth = Math.max(1, u / 2); ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const h = hash(i, 0, 11), y = (hash(i, 1, 11) * ch + t * ch * (1.3 + h * 0.5)) % (ch + 40) - 20, x = (h * cw * 1.3 + y * slant) % cw;
      ctx.moveTo(x, y); ctx.lineTo(x + u * 7 * slant, y + u * 7);
    }
    ctx.stroke();
    if (storm) { // (lightning: now and then a bolt and the sky lit white, flickering)
      const slot = Math.floor(t / 4), d = t - slot * 4 - hash(slot, 0, 16) * 3;
      if (d >= 0 && d < 0.35) {
        const a = (1 - d / 0.35) * (d % 0.12 < 0.06 ? 1 : 0.5) * f;
        ctx.fillStyle = `rgba(235,240,255,${0.55 * a})`; ctx.fillRect(0, 0, cw, ch);
        let x = cw * (0.15 + hash(slot, 1, 16) * 0.7), y = 0;
        ctx.strokeStyle = `rgba(255,255,240,${a})`; ctx.lineWidth = u * 1.5; ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; y < ch * 0.6; k++) { x += (hash(slot, k + 2, 16) - 0.5) * u * 24; y += u * (6 + hash(slot, k + 40, 16) * 10); ctx.lineTo(x, y); }
        ctx.stroke();
      }
    }
  } else if (wk === 'snow') { // (snow: the land paler, flakes drifting down, swaying)
    ctx.fillStyle = `rgba(240,244,252,${0.28 * f})`; ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = `rgba(253,251,246,${0.9 * f})`;
    for (let i = 0; i < 160; i++) {
      const h = hash(i, 0, 17), y = (hash(i, 1, 17) * ch + t * u * (14 + h * 14)) % (ch + 20) - 10, x = (h * cw * 1.3 + Math.sin(t * 1.3 + i) * u * 6) % cw, q = u * (h > 0.7 ? 2 : 1);
      ctx.fillRect(Math.round(x), Math.round(y), q, q);
    }
  } else if (wk === 'fog') {
    ctx.fillStyle = `rgba(225,230,238,${(0.3 + 0.25 * Math.min(1, bird.z / CRUISE)) * f})`; ctx.fillRect(0, 0, cw, ch);
    const r = Math.max(cw, ch) * 0.45;
    for (let i = 0; i < 6; i++) {
      const x = ((hash(i, 0, 14) * cw * 1.8 + t * 12 * u * (0.6 + hash(i, 1, 14))) % (cw * 1.8)) - cw * 0.4, y = hash(i, 2, 14) * ch;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(240,243,248,${0.45 * f})`); g.addColorStop(1, 'rgba(240,243,248,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  if (wk === 'wind' || wk === 'storm') {
    const a = Math.atan2(world.wind.y, world.wind.x), ca = Math.cos(a), sa = Math.sin(a), W2 = cw + 200, H2 = ch + 200;
    ctx.strokeStyle = `rgba(253,251,246,${0.35 * f})`; ctx.lineWidth = Math.max(1, u / 2); ctx.beginPath();
    for (let i = 0; i < 40; i++) {
      const s = t * 260 * u * (0.7 + hash(i, 0, 15) * 0.6), x = (((hash(i, 1, 15) * W2 + ca * s) % W2) + W2) % W2 - 100, y = (((hash(i, 2, 15) * H2 + sa * s) % H2) + H2) % H2 - 100;
      ctx.moveTo(x, y); ctx.lineTo(x + ca * u * 14, y + sa * u * 14);
    }
    ctx.stroke();
    for (let i = 0; i < 18; i++) { // (leaves, tumbling)
      const s = t * 140 * u * (0.7 + hash(i, 3, 15) * 0.6), x = (((hash(i, 4, 15) * W2 + ca * s) % W2) + W2) % W2 - 100, y = (((hash(i, 5, 15) * H2 + sa * s) % H2) + H2) % H2 - 100 + Math.sin(t * 5 + i) * u * 4;
      ctx.fillStyle = [HEX.lightGreen, HEX.ochre, HEX.green][i % 3]; ctx.globalAlpha = f;
      ctx.fillRect(Math.round(x), Math.round(y), u * (1 + (Math.sin(t * 9 + i) > 0)), u);
      ctx.globalAlpha = 1;
    }
  }
}

// the clouds: by the weather how many (of the sky), their color, their underside's
const CLOUD = 115, CC = 260;
const CLOUDS = { sun: [0.3, '#fdfbf6', '#d9dcea'], wind: [0.4, '#fdfbf6', '#d9dcea'], rain: [0.7, '#b4b9cc', '#8c91aa'], snow: [0.65, '#dfe2ec', '#b9bdd0'], storm: [0.85, '#7d8099', '#5b5e78'] };
// each puff of the clouds in view (drifting with the wind, or a breeze), drawn at height h (as seen from above: up the screen)
function clouds(g, x0, x1, y0, y1, h, col, under) {
  const t = world.time, cov = CLOUDS[world.weather][0], v = world.wind.x || world.wind.y ? world.wind : { x: 6, y: 2 }, dx = v.x * t * 1.4, dy = v.y * t * 1.4;
  for (const pass of under ? [under, col] : [col]) {
    g.fillStyle = pass; const off = pass === under ? 3 : 0;
    for (let j = Math.floor((y0 + h - dy - 150) / CC); j < (y1 + h - dy + 150) / CC; j++) for (let i = Math.floor((x0 - dx - 150) / CC); i < (x1 - dx + 150) / CC; i++) {
      if (hash(i, j, 21) > cov) continue;
      const cx = i * CC + hash(i, j, 22) * CC * 0.6 + dx, cy = j * CC + hash(i, j, 23) * CC * 0.6 + dy - h;
      for (let k = 0, n = 4 + Math.floor(hash(i, j, 24) * 4); k < n; k++) {
        g.beginPath(); g.arc(Math.round(cx + (hash(i, j, 30 + k) - 0.5) * 130 + off), Math.round(cy + (hash(i, j, 50 + k) - 0.5) * 50 + off), 20 + hash(i, j, 70 + k) * 26, 0, Math.PI * 2); g.fill();
      }
    }
  }
}
// drawn on a layer of the world's pixels (so overlapping puffs make one cloud, and as pixels), laid over at alpha a
const layer = document.createElement('canvas'), lctx = layer.getContext('2d');
function layered(S, camx, camy, paint, a, ox, oy) {
  if (a <= 0.01) return;
  const lw = Math.ceil(cw / S) + 4, lh = Math.ceil(ch / S) + 4;
  if (layer.width < lw || layer.height < lh) { layer.width = Math.max(lw, layer.width); layer.height = Math.max(lh, layer.height); }
  const lx = Math.floor(camx - cw / 2 / S) - 2, ly = Math.floor(camy - ch / 2 / S) - 2;
  lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, layer.width, layer.height);
  lctx.setTransform(1, 0, 0, 1, -lx + ox, -ly + oy); paint(lctx);
  ctx.globalAlpha = a; ctx.drawImage(layer, lx, ly); ctx.globalAlpha = 1;
}

function drawBird() {
  const pic = eagle(poseOf(bird), bird.a, look), x = Math.round(bird.x), y = Math.round(bird.y - bird.z);
  if (bird.state === 'swim') { ctx.strokeStyle = 'rgba(253,251,246,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, 9 + Math.sin(world.time * 3), 3.5, 0, 0, Math.PI * 2); ctx.stroke(); }
  if (bird.stooping) { // (the wind: streaks behind it, up the screen)
    ctx.fillStyle = 'rgba(253,251,246,0.55)';
    for (let i = 0; i < 4; i++) { const h = hash(i, Math.floor(world.time * 12), 5); ctx.fillRect(x - 8 + Math.floor(h * 16), y - 26 - Math.floor(h * 10), 1, 6 + Math.floor(h * 6)); }
  }
  ctx.drawImage(pic.canvas, x - pic.ox, y - pic.oy);
  if (bird.prey && bird.state !== 'dive' && !(bird.state === 'swim' && bird.prey === 'fish')) { // (in its claws; eating: at its beak)
    const s = ART[bird.prey] || ART.mouse, [bx, by] = bird.eating > 0 ? beak(bird.a) : [0, bird.state === 'air' ? 3 : 0];
    s.draw(ctx, Math.round(x + bx - s.w / 2), Math.round(y + by - s.h / 2), Math.cos(bird.a) > 0);
  }
}

// on the open sea: the rocks still ahead
const rocksAhead = () => (me.room?.kind === 'sea' ? world.objects.filter((o) => { const q = me.room.across ? o.x : o.y; return (me.room.d > 0 ? q : LONG - q) > along() + 20; }) : null);
// swimming, nothing in its claws: a fish near enough to dive for
const nearFish = () => (bird.state === 'swim' && !bird.prey ? world.fish.find((f) => f.t <= 0 && Math.hypot(f.x - bird.x, f.y - bird.y) < REACH) : null);
function hud(S, camx, camy) {
  const u = Math.max(2, Math.round(Math.min(cw, ch) / 170)), pad = u * 4, line = tone(HEX.charcoal, 'line');
  // energy
  const bw = u * 60, e = bird.energy / 100, col = e > 0.5 ? HEX.green : e > 0.2 ? HEX.yellow : HEX.red;
  text(ctx, 'ENERGIE', pad, pad, HEX.white, 'left', u);
  ctx.fillStyle = line; ctx.fillRect(pad, pad + u * 7, bw + u * 2, u * 6);
  ctx.fillStyle = HEX.charcoal; ctx.fillRect(pad + u, pad + u * 8, bw, u * 4);
  ctx.fillStyle = col; ctx.fillRect(pad + u, pad + u * 8, Math.round(bw * e), u * 4);
  ctx.fillStyle = tone(col, 'light'); ctx.fillRect(pad + u, pad + u * 8, Math.round(bw * e), u);
  if (bird.energy < 20 && Math.sin(world.time * 8) > 0) text(ctx, bird.state === 'air' ? 'HUNGER! JAGEN!' : 'HUNGER!', pad, pad + u * 15, HEX.red, 'left', u);
  const toChick = fam.hungry(me) && me.isl === me.home && !me.room;
  const mat = bird.prey === 'twig' || bird.prey === 'straw', want = fam.needs(save, me);
  if (mat) text(ctx, 'ZUM FELSEN, WO DAS NEST HIN SOLL', pad, pad + u * 23, HEX.yellow, 'left', u);
  else if (bird.prey && (bird.state !== 'ground' || (toChick && !bird.perch?.nest))) text(ctx, toChick ? 'INS NEST ZUM KÜKEN, ODER AN LAND FRESSEN' : 'ZUM FRESSEN AN LAND', pad, pad + u * 23, HEX.yellow, 'left', u);
  else if (nearFish()) text(ctx, 'EIN FISCH! NACH UNTEN: TAUCHEN', pad, pad + u * 23, HEX.yellow, 'left', u);
  text(ctx, me.home ? fam.broodSay(me) : want ? fam.needSay(want) : 'FLIEG ÜBERS MEER: SUCH DIR EINE FREIE INSEL', pad, pad + u * 31, 'rgba(253,251,246,0.85)', 'left', u);
  if (want && !mat) text(ctx, 'ZWEIGE: AN BÄUMEN, STROH: IN SCHEUNEN', pad, pad + u * 39, 'rgba(253,251,246,0.6)', 'left', u);
  // prey eaten
  const n = `${bird.caught}`, fx = cw - pad - textWidth(n) * u;
  text(ctx, n, fx, pad, HEX.white, 'left', u);
  ctx.save(); ctx.translate(fx - u * 10, pad); ctx.scale(u, u); ART.mouse.draw(ctx, 0, 0); ctx.restore();
  if (me.gems || world.room === 'cave') { const gn = `${me.gems}`, gx = cw - pad - textWidth(gn) * u; text(ctx, gn, gx, pad + u * 9, HEX.white, 'left', u); ctx.save(); ctx.translate(gx - u * 8, pad + u * 9); ctx.scale(u, u); ART.gem.draw(ctx, 0, 0); ctx.restore(); }
  // what happened: risen words where it caught something, numbers where it ate
  for (const p of particles) if (p.value || p.type === 'catch') {
    const sx = cw / 2 + (p.x - camx) * S, sy = ch / 2 + (p.y - camy - 8) * S - p.t * 30 * u;
    text(ctx, p.value ? `+${p.value}` : p.kind === 'fish' ? 'FISCH!' : p.kind === 'twig' ? 'EIN ZWEIG!' : p.kind === 'straw' ? 'STROH!' : 'GEFANGEN!', sx, sy, p.value ? HEX.white : HEX.yellow, 'center', u);
  }
  for (const p of particles) if (p.type === 'feed' || p.type === 'gem' || p.type === 'build') {
    const sx = cw / 2 + (p.x - camx) * S, sy = ch / 2 + (p.y - camy - 8) * S - p.t * 30 * u;
    text(ctx, p.type === 'build' ? 'FÜRS NEST!' : p.type === 'gem' ? 'EIN SCHATZ!' : `FÜR ${me.brood.chick?.name || 'DAS KÜKEN'}!`, sx, sy, p.type === 'gem' ? HEX.lightGreen : HEX.yellow, 'center', u);
  }
  for (const p of particles) if (p.type === 'miss' && p.t < 0.9) text(ctx, 'NICHTS...', cw / 2, ch / 2 - 30 * u, HEX.white, 'center', u);
  // off the screen, an arrow at the edge pointing to it: the nest (its own, or the place for one: the nest beside it),
  // in a cave its way out, on the open sea the next rock ahead
  const nestMine = !me.room && [me, null].includes(fam.residentOf(save, me.isl));
  const ahead = rocksAhead(), rock = ahead?.sort((a, b) => Math.hypot(a.x - bird.x, a.y - bird.y) - Math.hypot(b.x - bird.x, b.y - bird.y))[0];
  const aim = nestMine ? { x: island.nest.x, y: island.nest.y - PERCH, nest: true } : world.room === 'cave' ? world.exit : rock ? { x: rock.x, y: rock.y - PERCH } : null;
  const nx = aim ? cw / 2 + (aim.x - camx) * S : 0, ny = aim ? ch / 2 + (aim.y - camy) * S : 0, m = u * 14;
  if (started && aim && (nx < 0 || ny < 0 || nx > cw || ny > ch)) {
    const dx = nx - cw / 2, dy = ny - ch / 2, k = Math.min((cw / 2 - m) / Math.abs(dx || 1e-6), (ch / 2 - m) / Math.abs(dy || 1e-6));
    const ax = cw / 2 + dx * k, ay = Math.max(u * 30, ch / 2 + dy * k), a = Math.atan2(dy, dx); // (below the day's name, at the top)
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
    ctx.fillStyle = HEX.yellow; ctx.strokeStyle = tone(HEX.charcoal, 'line'); ctx.lineWidth = u;
    ctx.beginPath(); ctx.moveTo(u * 8, 0); ctx.lineTo(-u * 4, -u * 6); ctx.lineTo(-u * 1, 0); ctx.lineTo(-u * 4, u * 6); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.restore();
    if (!aim.nest) text(ctx, world.room === 'cave' ? 'AUSGANG' : 'FELSEN', ax - Math.cos(a) * u * 16, ay - Math.sin(a) * u * 12 - u * 3, HEX.yellow, 'center', u);
    const n = ART.nest, q = Math.max(1, Math.round(u / 2));
    if (aim.nest) { ctx.save(); ctx.translate(Math.round(ax - Math.cos(a) * u * 14 - (n.w * q) / 2), Math.round(ay - Math.sin(a) * u * 12 - (n.h * q) / 2)); ctx.scale(q, q); n.draw(ctx, 0, 0); ctx.restore(); }
  }
  // the day and its weather; a new day: what it brings
  const [wname, wsay] = SAY[island.weather];
  text(ctx, `TAG ${me.dayN}: ${wname}`, cw / 2, pad, HEX.white, 'center', u);
  text(ctx, `${me.name}, ${me.room?.kind === 'cave' ? 'IN DER HÖHLE' : me.room?.kind === 'sea' ? `ÜBERS MEER, NOCH ${rocksAhead().length} FELSEN` : me.room ? 'IN DER SCHEUNE' : `INSEL ${islandName(me.isl)}`}`, cw / 2, pad + u * 9, 'rgba(253,251,246,0.75)', 'center', u);
  if (banner > 0 && started) {
    const a = Math.min(1, banner, 6 - banner), big = u * 2;
    text(ctx, `TAG ${me.dayN}: ${wname}`, cw / 2, ch * 0.22, `rgba(253,251,246,${a})`, 'center', big);
    text(ctx, wsay, cw / 2, ch * 0.22 + big * 9, `rgba(255,226,90,${a})`, 'center', u);
  }
  if (notice?.t > 0 && started) notice.text.split('\n').forEach((l, i) => text(ctx, l, cw / 2, ch * 0.42 + i * u * 9, `rgba(255,226,90,${Math.min(1, notice.t)})`, 'center', u));
  if (bird.asleep) for (let i = 0; i < 3; i++) { // (asleep: Z z z rising)
    const f = (world.time * 0.6 + i / 3) % 1;
    text(ctx, 'Z', cw / 2 + (8 + f * 10) * u, ch / 2 - (14 + f * 22) * u, `rgba(253,251,246,${1 - f})`, 'left', Math.round(u * (1 + f)));
  }
  if (!started) return title(u);
  sticksDraw(u);
}

function sticksDraw(u) {
  const r = R();
  for (const s of Object.values(sticks)) {
    const [hx, hy] = s.id !== null ? [s.ox, s.oy] : home(s), across = s === sticks.turn;
    // the track: a capsule of two half circles (roundRect: not before Safari 16)
    const ex = across ? r * 0.68 : 0, ey = across ? 0 : r * 0.68, th = Math.atan2(ey, ex);
    ctx.fillStyle = 'rgba(253,251,246,0.18)'; ctx.strokeStyle = 'rgba(43,37,65,0.5)'; ctx.lineWidth = u;
    ctx.beginPath(); ctx.arc(hx - ex, hy - ey, r * 0.32, th + Math.PI / 2, th + Math.PI * 1.5); ctx.arc(hx + ex, hy + ey, r * 0.32, th - Math.PI / 2, th + Math.PI / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    const kx = hx + (across ? s.v * r : 0), ky = hy - (across ? 0 : s.v * r);
    ctx.fillStyle = s.id !== null ? 'rgba(253,251,246,0.75)' : 'rgba(253,251,246,0.45)';
    ctx.beginPath(); ctx.arc(kx, ky, r * 0.38, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (across) continue;
    const marks = [[1.02, 'HOCH'], [FLY_AT + 0.08, 'FLIEGEN'], [0.52, 'RENNEN'], [0.18, 'GEHEN'], [-0.15, 'STOP']], lu = Math.max(2, Math.round(u * 0.7));
    if (bird.state === 'swim' || bird.state === 'dive') marks.push([-0.8, 'TAUCHEN']);
    if (bird.state === 'air') marks.push([-0.8, 'STURZFLUG']);
    for (const [v, label] of marks) text(ctx, label, hx - r * 0.45, hy - v * r - lu * 2.5, 'rgba(253,251,246,0.85)', 'right', lu);
  }
}

function title(u) {
  ctx.fillStyle = 'rgba(43,37,65,0.45)'; ctx.fillRect(0, 0, cw, ch);
  const big = u * 4;
  text(ctx, 'VON OBEN', cw / 2 + big / 2, ch * 0.3 + big / 2, tone(HEX.charcoal, 'line'), 'center', big);
  text(ctx, 'VON OBEN', cw / 2, ch * 0.3, HEX.white, 'center', big);
  const lines = ['LINKS: DREHEN', 'RECHTS: GEHEN, RENNEN, FLIEGEN', 'LOSLASSEN: LANDEN', 'IM FLUG NACH UNTEN: STURZFLUG', '', 'FLIEGEN KOSTET ENERGIE.', 'JAGE MÄUSE, KÄFER, WÜRMER UND FISCHE IM STURZFLUG!', 'GEFRESSEN WIRD AN LAND.', 'IM NEST AUF DEM FELSEN SCHLAFEN: VOLLE ENERGIE', 'SCHWIMMEND BEIM FISCH: TAUCHEN!', 'EIN NEUES NEST: ZWEIGE VON BÄUMEN, STROH AUS DER SCHEUNE', 'JEDES WETTER LOCKT ANDERE TIERE HERAUS.', 'NACH 5 TAGEN LIEGT EIN EI IM NEST: FÜTTERE DAS KÜKEN!', 'HÖHLEN UND SCHEUNEN: HINEIN!', '', 'TIPPEN ZUM STARTEN'];
  text(ctx, VERSION, cw - u * 4, ch - u * 10, HEX.white, 'right', u);
  lines.forEach((l, i) => text(ctx, l, cw / 2, ch * 0.3 + big * 9 + i * Math.round(u * 1.5) * 9, i === lines.length - 1 && Math.sin(world.time * 4) < 0 ? HEX.yellow : HEX.white, 'center', Math.round(u * 1.5)));
}

play(fam.current(save));
if (fresh) { // (the first time: the nest, and a name for the first eagle)
  const pic = picture((g) => { ART.crag.draw(g, 8, 60 - ART.crag.h); ART.nest.draw(g, 30 - ART.nest.w / 2, 60 - PERCH - ART.nest.h / 2 - 1); const p = eagle('stand', Math.PI * 0.35, look); g.drawImage(p.canvas, 30 - p.ox, 60 - PERCH - p.oy); }, 60, 62, 4);
  ui.ask('VON OBEN', pic, 'WIE HEISST DEIN ADLER?').then((n) => { me.name = n; fam.store(save); say(`${n}: INSEL ${islandName(seedOf(0))}`); });
}
requestAnimationFrame(frame);
