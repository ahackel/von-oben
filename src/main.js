// Von Oben: the eagle in the middle of the screen, the island moving under it (never turning: the eagle turns). Close
// to it on the ground, farther away the higher it flies. Two sticks: the left turns it, the right sets its pace.
import { HEX, tone, mix } from './pixels.js';
import { text, textWidth } from '../lib/font.js';
import { makeWorld, update, terrain, elevation, hash, isWater, W, H, DEEP, WATER, SAND, GRASS, ROCK, SNOW, PERCH } from './world.js';
import { makeBird, step, CRUISE, FLY_AT } from './bird.js';
import { eagle, poseOf, beak } from './eagle.js';
import { ART, HOUSE_LIGHTS } from './art/island.js';

const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const world = makeWorld(), bird = makeBird(world.nest.x, world.nest.y, PERCH); // (it starts at home, in its nest)
let cw = 0, ch = 0, dpr = 1, zoom = 4, started = false, last = performance.now(), keyPush = 0;
const particles = [], keys = new Set();
// a day: DAY seconds (asleep: 12 times as fast). Through it, what the world is tinted with (multiplied: as Lop Hop's
// sunset and morning tint its palette) and how dark it is: day, a sunset, a purple dusk, the night, a pink morning
const DAY = 240, SKY = [[0, '#ffffff', 0], [0.42, '#ffffff', 0], [0.5, mix('#ffffff', '#ff8c5a', 0.55), 0.15], [0.56, '#a088c4', 0.6],
  [0.62, '#55609e', 1], [0.85, '#55609e', 1], [0.92, mix('#ffffff', '#ffb4c4', 0.5), 0.25], [1, '#ffffff', 0]];
let day = 0.08;
function sky() {
  const i = SKY.findIndex(([at]) => at > day), [a0, c0, d0] = SKY[i - 1], [a1, c1, d1] = SKY[i], f = (day - a0) / (a1 - a0), e = f * f * (3 - 2 * f);
  return [mix(c0, c1, e), d0 + (d1 - d0) * e];
}
globalThis.vonOben = { bird, world, setDay: (d) => (day = d) }; // (to look into, from the console)
const ZOOM_GROUND = 4, ZOOM_AIR = 1.5, VERSION = 'V6'; // (on the title: is the new code there?)

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
  day = (day + (dt * (bird.asleep ? 12 : 1)) / DAY) % 1;
  for (const e of bird.events.splice(0)) particles.push({ ...e, t: 0 });
  for (let i = particles.length - 1; i >= 0; i--) if ((particles[i].t += dt) > 1.2) particles.splice(i, 1);
  const up = bird.state === 'ground' ? 0 : bird.z; // (in its nest: as on the ground)
  zoom += ((ZOOM_GROUND + (ZOOM_AIR - ZOOM_GROUND) * Math.min(1, up / CRUISE)) - zoom) * Math.min(1, dt * 3);
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
  for (let j = Math.floor(y0 / 14); j < y1 / 14; j++) for (let i = Math.floor(x0 / 14); i < x1 / 14; i++) {
    const h = hash(i, j, 3), f = Math.sin(t * 0.9 + h * 40);
    if (f < 0.3) continue;
    const x = i * 14 + Math.floor(h * 9) + Math.floor(((t * 0.9 + h * 40) % (Math.PI * 2)) * 0.8), y = j * 14 + Math.floor(hash(i, j, 4) * 11);
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
  const drawn = [...seen, { bird: true, y: bird.z >= 20 ? Infinity : bird.y + 0.5 }].sort((a, b) => a.y - b.y);
  for (const o of drawn) {
    if (o.bird) { drawBird(); continue; }
    const s = o.art === 'fountain' ? ART[`fountain${Math.floor(t * 6) % 3}`] : ART[o.art];
    s.draw(ctx, o.x - s.w / 2, o.y - s.h + 1);
    if (o.nest) ART.nest.draw(ctx, o.x - ART.nest.w / 2, o.y - PERCH - ART.nest.h / 2);
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
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (bird.state === 'dive') { ctx.fillStyle = 'rgba(40,70,130,0.3)'; ctx.fillRect(0, 0, cw, ch); }
  hud(S, camx, camy);
}

function drawBird() {
  const pic = eagle(poseOf(bird), bird.a), x = Math.round(bird.x), y = Math.round(bird.y - bird.z);
  if (bird.state === 'swim') { ctx.strokeStyle = 'rgba(253,251,246,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, 9 + Math.sin(world.time * 3), 3.5, 0, 0, Math.PI * 2); ctx.stroke(); }
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
    const marks = [[FLY_AT + 0.15, 'FLIEGEN'], [0.52, 'RENNEN'], [0.18, 'GEHEN'], [-0.15, 'STOP']], lu = Math.max(2, Math.round(u * 0.7));
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
  const lines = ['LINKS: DREHEN', 'RECHTS: GEHEN, RENNEN, FLIEGEN', 'LOSLASSEN: LANDEN', 'IM FLUG NACH UNTEN: STURZFLUG', '', 'FLIEGEN KOSTET ENERGIE.', 'JAGE MÄUSE, KÄFER, WÜRMER UND FISCHE IM STURZFLUG!', 'GEFRESSEN WIRD AN LAND.', 'IM NEST AUF DEM FELSEN SCHLAFEN: VOLLE ENERGIE', '', 'TIPPEN ZUM STARTEN'];
  text(ctx, VERSION, cw - u * 4, ch - u * 10, HEX.white, 'right', u);
  lines.forEach((l, i) => text(ctx, l, cw / 2, ch * 0.3 + big * 9 + i * Math.round(u * 1.5) * 9, i === lines.length - 1 && Math.sin(world.time * 4) < 0 ? HEX.yellow : HEX.white, 'center', Math.round(u * 1.5)));
}

requestAnimationFrame(frame);
