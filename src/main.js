// Von Oben: the eagle in the middle of the screen, the island moving under it (never turning: the eagle turns). Close
// to it on the ground, farther away the higher it flies. Two sticks: the left turns it, the right sets its pace.
import { HEX, tone, mix } from './pixels.js';
import { text, textWidth } from '../lib/font.js';
import { makeWorld, update, setWeather, terrain, elevation, hash, isWater, W, H, DEEP, WATER, SAND, GRASS, ROCK, SNOW, PERCH } from './world.js';
import { makeBird, step, CRUISE, HIGH, FLY_AT } from './bird.js';
import { eagle, poseOf, beak } from './eagle.js';
import { ART, HOUSE_LIGHTS } from './art/island.js';

const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const world = makeWorld(), bird = makeBird(world.nest.x, world.nest.y, PERCH); // (it starts at home, in its nest)
let cw = 0, ch = 0, dpr = 1, zoom = 4, started = false, last = performance.now(), keyPush = 0;
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
let dayN = 1, wfade = 1, banner = 0;
function newDay() {
  dayN++;
  let k = WEATHERS[Math.floor(hash(dayN, 7, 9) * WEATHERS.length)];
  if (k === world.weather) k = WEATHERS[(WEATHERS.indexOf(k) + 1) % WEATHERS.length];
  setWeather(world, k); wfade = 0; banner = 6;
}
function sky() {
  const i = SKY.findIndex(([at]) => at > day), [a0, c0, d0] = SKY[i - 1], [a1, c1, d1] = SKY[i], f = (day - a0) / (a1 - a0), e = f * f * (3 - 2 * f);
  return [mix(c0, c1, e), d0 + (d1 - d0) * e];
}
globalThis.vonOben = { bird, world, setDay: (d) => (day = d), newDay }; // (to look into, from the console)
const ZOOM_GROUND = 4, ZOOM_AIR = 1.5, VERSION = 'V12'; // (on the title: is the new code there?)

function resize() {
  dpr = window.devicePixelRatio || 1; cw = cv.width = Math.round(innerWidth * dpr); ch = cv.height = Math.round(innerHeight * dpr);
}
addEventListener('resize', resize); resize();

const shallows = new Map(); // (64 px squares of the sea → the shallow spots in them: x, y, how deep)
// the ground, drawn once, a pixel each: the sea darker the deeper, foam at the shore, sand, grass and paths speckled;
// the land lit by how it slopes (the light from the top left), the mountains most: bare rock, snow on the peaks
const groundCanvas = (() => {
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
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = terrain(world, x, y), e = elevation(world, x, y), h = hash(x, y, 1);
    let col;
    if (t === DEEP) col = deep[Math.min(4, Math.floor(((-e - 0.07) / 0.2) * 5))];
    else if (t === WATER) col = e > -0.006 ? foam : shallow[Math.min(4, Math.floor((-e / 0.07) * 5))];
    else {
      const lit = (elevation(world, x + 3, y + 3) - elevation(world, x - 3, y - 3)) * 70, l = lit > 0.35 ? 2 : lit < -0.35 ? 0 : 1;
      if (t === ROCK) col = h < 0.05 ? rock[3] : h > 0.96 ? rock[4] : rock[l];
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
  return c;
})();

// the sticks: where a finger went down is the stick's middle (near its place: that place)
const sticks = { turn: { id: null, ox: 0, oy: 0, v: 0 }, push: { id: null, ox: 0, oy: 0, v: 0 } };
const R = () => Math.min(cw, ch) * 0.14;
const home = (s) => (s === sticks.turn ? [cw * 0.14, ch * 0.8] : [cw * 0.86, ch * 0.72]);
cv.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (!started) { started = true; return; }
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
addEventListener('keydown', (e) => { keys.add(e.key); started = true; });
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
  update(world, dt, started ? bird : null);
  if (started) step(bird, input(dt), dt, world);
  const was = day;
  day = (day + (dt * (bird.asleep ? 12 : 1)) / DAY) % 1;
  if (was < 0.95 && day >= 0.95) newDay();
  wfade = Math.min(1, wfade + dt / 6); banner = Math.max(0, banner - dt);
  for (const e of bird.events.splice(0)) {
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
  ctx.fillStyle = tone(HEX.blue, 'dark'); ctx.fillRect(0, 0, cw, ch);
  ctx.setTransform(S, 0, 0, S, Math.round(cw / 2 - camx * S), Math.round(ch / 2 - camy * S));
  ctx.drawImage(groundCanvas, 0, 0);
  const x0 = camx - cw / 2 / S - 40, x1 = camx + cw / 2 / S + 40, y0 = camy - ch / 2 / S - 20, y1 = camy + ch / 2 / S + 60;
  // the sea: wave crests coming and going (a little arc each), and waves running in to the shore: a line of foam where
  // the water is as shallow as each has got, fading as it reaches the sand; two at a time
  const wdx = world.wind.x * t * 0.9, wdy = world.wind.y * t * 0.9; // (the wind: the crests running along with it)
  for (let j = Math.floor((y0 - wdy) / 14); j < (y1 - wdy) / 14; j++) for (let i = Math.floor((x0 - wdx) / 14); i < (x1 - wdx) / 14; i++) {
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
      const c = shallows.get(bi * 1000 + bj);
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
  for (const f of world.food) if (f.gone <= 0 && f.x > x0 && f.x < x1 && f.y > y0 && f.y < y1) {
    const s = ART[f.kind], hop = f.run > 0 && f.kind === 'mouse' && Math.sin(t * 30 + f.x) > 0 ? 1 : 0; // (running: a scurry)
    s.draw(ctx, Math.round(f.x - s.w / 2 + (f.kind === 'worm' && Math.sin(t * 4 + f.x) > 0 ? 1 : 0)), Math.round(f.y - s.h + 1 - hop), Math.cos(f.a) > 0);
  }
  // shadows, then all that stands, back to front (the eagle among it, or over it all when high)
  const seen = world.objects.filter((o) => o.x > x0 && o.x < x1 && o.y > y0 && o.y < y1);
  ctx.fillStyle = 'rgba(30,40,70,0.22)';
  for (const o of seen) { ctx.beginPath(); ctx.ellipse(o.x + 2, o.y, o.block.w ? 18 : 6, o.block.w ? 4 : 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
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
  const drawn = [...seen, ...(high ? [] : [{ bird: true, y: bird.y + 0.5 }])].sort((a, b) => a.y - b.y);
  for (const o of drawn) {
    if (o.bird) { drawBird(); continue; }
    const s = o.art === 'fountain' ? ART[`fountain${Math.floor(t * 6) % 3}`] : ART[o.art];
    if (gust && /^(pine|oak|bush)/.test(o.art)) { // (the wind: trees and bushes leaning with it, swaying; the higher, the more)
      const k = (Math.sign(world.wind.x) * 0.06 + Math.sin(t * 2.6 + o.x * 0.05 + o.y * 0.03) * 0.07) * gust;
      ctx.save(); ctx.translate(o.x, o.y + 1); ctx.transform(1, 0, -k, 1, 0, 0); s.draw(ctx, -s.w / 2, -s.h); ctx.restore();
    } else s.draw(ctx, o.x - s.w / 2, o.y - s.h + 1);
    if (o.nest) ART.nest.draw(ctx, o.x - ART.nest.w / 2, o.y - PERCH - ART.nest.h / 2);
  }
  // clouds: their shadows on the ground (in sunshine), the clouds up at CLOUD; high, the eagle over them, else under
  const [, darkNow] = sky(), cl = CLOUDS[world.weather];
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
  if (dark > 0 || tint !== '#ffffff') {
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = tint; ctx.fillRect(x0 - 50, y0 - 200, x1 - x0 + 100, y1 - y0 + 300); ctx.globalCompositeOperation = 'source-over';
    if (dark > 0.05) for (const o of seen) if (o.art.startsWith('house')) {
      const s = ART[o.art], sx = o.x - s.w / 2, sy = o.y - s.h + 1;
      for (const [lx, ly, lw, lh] of HOUSE_LIGHTS) {
        ctx.fillStyle = `rgba(255,190,80,${0.12 * dark})`; ctx.fillRect(sx + lx - 3, sy + ly - 2, lw + 6, lh + 8);
        ctx.fillStyle = `rgba(255,214,110,${0.95 * dark})`; ctx.fillRect(sx + lx + 1, sy + ly + 1, lw - 2, lh - 2);
      }
    }
  }
  // rain: rings on the water where the drops fall
  if (world.weather === 'rain' || world.weather === 'storm') for (let i = 0; i < 60; i++) {
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
  const g = bird.target;
  if (g && (g.nest || (g.kind ? g.gone <= 0 : g.t <= 0))) {
    const r = (g.nest ? 20 : 7) + Math.sin(t * 8) * 1.5, x = Math.round(g.x), y = Math.round(g.y) - (g.nest ? PERCH : 2);
    ctx.fillStyle = HEX.yellow;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.fillRect(x + sx * r - (sx > 0 ? 3 : 0), y + sy * r - (sy > 0 ? 1 : 0), 4, 1); ctx.fillRect(x + sx * r - (sx > 0 ? 1 : 0), y + sy * r - (sy > 0 ? 3 : 0), 1, 4); }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  weather(S);
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
  // rays of sunlight, slanting down from the top left through the fog (in the sun: faint)
  const [, dark] = sky(), ray = (wk === 'fog' ? 0.14 : wk === 'sun' ? 0.06 : 0) * f * (1 - dark);
  if (ray > 0.005) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = cw * (hash(i, 0, 18) * 1.2 - 0.4) + Math.sin(t * 0.15 + i) * cw * 0.04, bw = cw * (0.03 + hash(i, 1, 18) * 0.07), run = ch * 0.7;
      const g = ctx.createLinearGradient(0, 0, 0, ch); g.addColorStop(0, `rgba(255,236,190,${ray * (0.7 + 0.3 * Math.sin(t * 0.5 + i * 2))})`); g.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + bw, 0); ctx.lineTo(x + bw * 2 + run, ch); ctx.lineTo(x + run, ch); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
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
  const pic = eagle(poseOf(bird), bird.a), x = Math.round(bird.x), y = Math.round(bird.y - bird.z);
  if (bird.state === 'swim') { ctx.strokeStyle = 'rgba(253,251,246,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, 9 + Math.sin(world.time * 3), 3.5, 0, 0, Math.PI * 2); ctx.stroke(); }
  if (bird.stooping) { // (the wind: streaks behind it, up the screen)
    ctx.fillStyle = 'rgba(253,251,246,0.55)';
    for (let i = 0; i < 4; i++) { const h = hash(i, Math.floor(world.time * 12), 5); ctx.fillRect(x - 8 + Math.floor(h * 16), y - 26 - Math.floor(h * 10), 1, 6 + Math.floor(h * 6)); }
  }
  ctx.drawImage(pic.canvas, x - pic.ox, y - pic.oy);
  if (bird.prey && bird.state !== 'dive' && !(bird.state === 'swim' && bird.prey === 'fish')) { // (in its claws; eating: at its beak)
    const s = ART[bird.prey], [bx, by] = bird.eating > 0 ? beak(bird.a) : [0, bird.state === 'air' ? 3 : 0];
    s.draw(ctx, Math.round(x + bx - s.w / 2), Math.round(y + by - s.h / 2), Math.cos(bird.a) > 0);
  }
}

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
  if (bird.prey && bird.state !== 'ground') text(ctx, 'ZUM FRESSEN AN LAND', pad, pad + u * 23, HEX.yellow, 'left', u);
  // prey eaten
  const n = `${bird.caught}`, fx = cw - pad - textWidth(n) * u;
  text(ctx, n, fx, pad, HEX.white, 'left', u);
  ctx.save(); ctx.translate(fx - u * 10, pad); ctx.scale(u, u); ART.mouse.draw(ctx, 0, 0); ctx.restore();
  // what happened: risen words where it caught something, numbers where it ate
  for (const p of particles) if (p.value || p.type === 'catch') {
    const sx = cw / 2 + (p.x - camx) * S, sy = ch / 2 + (p.y - camy - 8) * S - p.t * 30 * u;
    text(ctx, p.value ? `+${p.value}` : p.kind === 'fish' ? 'FISCH!' : 'GEFANGEN!', sx, sy, p.value ? HEX.white : HEX.yellow, 'center', u);
  }
  for (const p of particles) if (p.type === 'miss' && p.t < 0.9) text(ctx, 'NICHTS...', cw / 2, ch / 2 - 30 * u, HEX.white, 'center', u);
  // the nest off the screen: an arrow at the edge pointing to it, the nest beside it
  const nx = cw / 2 + (world.nest.x - camx) * S, ny = ch / 2 + (world.nest.y - PERCH - camy) * S, m = u * 14;
  if (started && (nx < 0 || ny < 0 || nx > cw || ny > ch)) {
    const dx = nx - cw / 2, dy = ny - ch / 2, k = Math.min((cw / 2 - m) / Math.abs(dx || 1e-6), (ch / 2 - m) / Math.abs(dy || 1e-6));
    const ax = cw / 2 + dx * k, ay = Math.max(u * 26, ch / 2 + dy * k), a = Math.atan2(dy, dx); // (below the day's name, at the top)
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
    ctx.fillStyle = HEX.yellow; ctx.strokeStyle = tone(HEX.charcoal, 'line'); ctx.lineWidth = u;
    ctx.beginPath(); ctx.moveTo(u * 8, 0); ctx.lineTo(-u * 4, -u * 6); ctx.lineTo(-u * 1, 0); ctx.lineTo(-u * 4, u * 6); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.restore();
    const n = ART.nest, q = Math.max(1, Math.round(u / 2));
    ctx.save(); ctx.translate(Math.round(ax - Math.cos(a) * u * 14 - (n.w * q) / 2), Math.round(ay - Math.sin(a) * u * 12 - (n.h * q) / 2)); ctx.scale(q, q); n.draw(ctx, 0, 0); ctx.restore();
  }
  // the day and its weather; a new day: what it brings
  const [wname, wsay] = SAY[world.weather];
  text(ctx, `TAG ${dayN}: ${wname}`, cw / 2, pad, HEX.white, 'center', u);
  if (banner > 0 && started) {
    const a = Math.min(1, banner, 6 - banner), big = u * 2;
    text(ctx, `TAG ${dayN}: ${wname}`, cw / 2, ch * 0.22, `rgba(253,251,246,${a})`, 'center', big);
    text(ctx, wsay, cw / 2, ch * 0.22 + big * 9, `rgba(255,226,90,${a})`, 'center', u);
  }
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
  const lines = ['LINKS: DREHEN', 'RECHTS: GEHEN, RENNEN, FLIEGEN', 'LOSLASSEN: LANDEN', 'IM FLUG NACH UNTEN: STURZFLUG', '', 'FLIEGEN KOSTET ENERGIE.', 'JAGE MÄUSE, KÄFER, WÜRMER UND FISCHE IM STURZFLUG!', 'GEFRESSEN WIRD AN LAND.', 'IM NEST AUF DEM FELSEN SCHLAFEN: VOLLE ENERGIE', 'JEDES WETTER LOCKT ANDERE TIERE HERAUS.', '', 'TIPPEN ZUM STARTEN'];
  text(ctx, VERSION, cw - u * 4, ch - u * 10, HEX.white, 'right', u);
  lines.forEach((l, i) => text(ctx, l, cw / 2, ch * 0.3 + big * 9 + i * Math.round(u * 1.5) * 9, i === lines.length - 1 && Math.sin(world.time * 4) < 0 ? HEX.yellow : HEX.white, 'center', Math.round(u * 1.5)));
}

requestAnimationFrame(frame);
