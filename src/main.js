// Von Oben: the eagle in the middle of the screen, the island moving under it (never turning: the eagle turns). Close
// to it on the ground, farther away the higher it flies. Two sticks: the left turns it, the right sets its pace.
import { HEX, tone, mix } from './pixels.js';
import { text, textWidth } from '../lib/font.js';
import { makeWorld, update, terrain, elevation, hash, isWater, W, H, DEEP, WATER, SAND, GRASS } from './world.js';
import { makeBird, step, CRUISE, FLY_AT } from './bird.js';
import { eagle, poseOf, beak } from './eagle.js';
import { ART } from './art/island.js';

const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const world = makeWorld(), bird = makeBird(world.village.x - 28, world.village.y + 2);
let cw = 0, ch = 0, dpr = 1, zoom = 4, started = false, last = performance.now(), keyPush = 0;
const particles = [], keys = new Set();
globalThis.vonOben = { bird, world }; // (to look into, from the console)
const ZOOM_GROUND = 4, ZOOM_AIR = 1.7;

function resize() {
  dpr = window.devicePixelRatio || 1; cw = cv.width = Math.round(innerWidth * dpr); ch = cv.height = Math.round(innerHeight * dpr);
}
addEventListener('resize', resize); resize();

// the ground, drawn once, a pixel each: the sea darker the deeper, foam at the shore, sand, grass and paths speckled
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
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = terrain(world, x, y), e = elevation(world, x, y), h = hash(x, y, 1);
    let col;
    if (t === DEEP) col = deep[Math.min(4, Math.floor(((-e - 0.07) / 0.2) * 5))];
    else if (t === WATER) col = e > -0.006 ? foam : shallow[Math.min(4, Math.floor((-e / 0.07) * 5))];
    else { const k = C[t]; col = h < 0.06 ? k[1] : h > 0.95 ? k[2] : k[0]; }
    px[y * W + x] = col;
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
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(world, dt);
  if (started) step(bird, input(dt), dt, world);
  for (const e of bird.events.splice(0)) particles.push({ ...e, t: 0 });
  for (let i = particles.length - 1; i >= 0; i--) if ((particles[i].t += dt) > 1.2) particles.splice(i, 1);
  zoom += ((ZOOM_GROUND + (ZOOM_AIR - ZOOM_GROUND) * Math.min(1, bird.z / CRUISE)) - zoom) * Math.min(1, dt * 3);
  draw();
  requestAnimationFrame(frame);
}

function draw() {
  const S = zoom * dpr, camx = bird.x, camy = bird.y - bird.z, t = world.time;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = tone(HEX.blue, 'dark'); ctx.fillRect(0, 0, cw, ch);
  ctx.setTransform(S, 0, 0, S, Math.round(cw / 2 - camx * S), Math.round(ch / 2 - camy * S));
  ctx.drawImage(groundCanvas, 0, 0);
  const x0 = camx - cw / 2 / S - 40, x1 = camx + cw / 2 / S + 40, y0 = camy - ch / 2 / S - 20, y1 = camy + ch / 2 / S + 60;
  // glints on the sea
  ctx.fillStyle = tone(HEX.blue, 'light');
  for (let j = Math.floor(y0 / 12); j < y1 / 12; j++) for (let i = Math.floor(x0 / 12); i < x1 / 12; i++) {
    const h = hash(i, j, 3), x = i * 12 + Math.floor(h * 10), y = j * 12 + Math.floor(hash(i, j, 4) * 10);
    if (Math.sin(t * 1.5 + h * 40) > 0.8 && isWater(world, x, y)) ctx.fillRect(x, y, 3, 1);
  }
  // fish: shadows under the water
  ctx.fillStyle = 'rgba(35,45,90,0.4)';
  for (const f of world.fish) if (f.t <= 0 && f.x > x0 && f.x < x1 && f.y > y0 && f.y < y1) {
    const across = Math.abs(Math.cos(f.a)) > Math.abs(Math.sin(f.a));
    ctx.fillRect(Math.round(f.x) - (across ? 3 : 1), Math.round(f.y) - (across ? 1 : 3), across ? 6 : 2, across ? 2 : 6);
  }
  for (const f of world.food) if (f.gone <= 0 && f.x > x0 && f.x < x1 && f.y > y0 && f.y < y1) {
    const s = ART[f.kind]; s.draw(ctx, f.x - s.w / 2 + (f.kind === 'worm' && Math.sin(t * 4 + f.x) > 0 ? 1 : 0), f.y - s.h + 1);
  }
  // shadows, then all that stands, back to front (the eagle among it, or over it all when high)
  const seen = world.objects.filter((o) => o.x > x0 && o.x < x1 && o.y > y0 && o.y < y1);
  ctx.fillStyle = 'rgba(30,40,70,0.22)';
  for (const o of seen) { ctx.beginPath(); ctx.ellipse(o.x + 2, o.y, o.block.w ? 18 : 6, o.block.w ? 4 : 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
  if (bird.state !== 'dive') {
    const s = 1 - (bird.z / CRUISE) * 0.45; ctx.beginPath(); ctx.ellipse(bird.x + bird.z * 0.3, bird.y + bird.z * 0.15, 6 * s, 2.5 * s, 0, 0, Math.PI * 2); ctx.fill();
  }
  const drawn = [...seen, { bird: true, y: bird.z > 30 ? Infinity : bird.y + 0.5 }].sort((a, b) => a.y - b.y);
  for (const o of drawn) {
    if (o.bird) { drawBird(); continue; }
    const s = o.art === 'fountain' ? ART[`fountain${Math.floor(t * 6) % 3}`] : ART[o.art];
    s.draw(ctx, o.x - s.w / 2, o.y - s.h + 1);
  }
  for (const p of particles) if (p.type === 'splash' || p.type === 'miss') {
    ctx.strokeStyle = `rgba(253,251,246,${1 - p.t / 1.2})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 4 + p.t * 14, 1.5 + p.t * 5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (bird.state === 'dive') { ctx.fillStyle = 'rgba(40,70,130,0.3)'; ctx.fillRect(0, 0, cw, ch); }
  hud(S, camx, camy);
}

function drawBird() {
  const pic = eagle(poseOf(bird), bird.a), x = Math.round(bird.x), y = Math.round(bird.y - bird.z);
  if (bird.state === 'swim') { ctx.strokeStyle = 'rgba(253,251,246,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, 9 + Math.sin(world.time * 3), 3.5, 0, 0, Math.PI * 2); ctx.stroke(); }
  ctx.drawImage(pic.canvas, x - pic.ox, y - pic.oy);
  if (bird.carry > 0 && bird.state !== 'dive') { const [bx, by] = beak(bird.a); ART.fish.draw(ctx, x + bx - 3, y + by - 1, Math.cos(bird.a) > 0); }
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
  if (bird.energy < 20 && Math.sin(world.time * 8) > 0) text(ctx, bird.state === 'air' ? 'HUNGER! LANDEN!' : 'HUNGER!', pad, pad + u * 15, HEX.red, 'left', u);
  // fish caught
  const n = `${bird.fish}`, fx = cw - pad - textWidth(n) * u;
  text(ctx, n, fx, pad, HEX.white, 'left', u);
  ctx.save(); ctx.translate(fx - u * 11, pad); ctx.scale(u, u); ART.fish.draw(ctx, 0, 0); ctx.restore();
  // what happened: risen numbers where it ate
  for (const p of particles) if (p.value) {
    const sx = cw / 2 + (p.x - camx) * S, sy = ch / 2 + (p.y - camy - 8) * S - p.t * 30 * u;
    text(ctx, p.type === 'fish' ? `FISCH! +${p.value}` : `+${p.value}`, sx, sy, p.type === 'fish' ? HEX.yellow : HEX.white, 'center', u);
  }
  for (const p of particles) if (p.type === 'miss' && p.t < 0.9) text(ctx, 'NICHTS...', cw / 2, ch / 2 - 30 * u, HEX.white, 'center', u);
  if (!started) return title(u);
  sticksDraw(u);
}

function sticksDraw(u) {
  const r = R();
  for (const s of Object.values(sticks)) {
    const [hx, hy] = s.id !== null ? [s.ox, s.oy] : home(s), across = s === sticks.turn;
    ctx.fillStyle = 'rgba(253,251,246,0.18)'; ctx.strokeStyle = 'rgba(43,37,65,0.5)'; ctx.lineWidth = u;
    ctx.beginPath(); ctx.roundRect(hx - (across ? r : r * 0.32), hy - (across ? r * 0.32 : r), across ? r * 2 : r * 0.64, across ? r * 0.64 : r * 2, r * 0.32); ctx.fill(); ctx.stroke();
    const kx = hx + (across ? s.v * r : 0), ky = hy - (across ? 0 : s.v * r);
    ctx.fillStyle = s.id !== null ? 'rgba(253,251,246,0.75)' : 'rgba(253,251,246,0.45)';
    ctx.beginPath(); ctx.arc(kx, ky, r * 0.38, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (across) continue;
    const marks = [[FLY_AT + 0.15, 'FLIEGEN'], [0.52, 'RENNEN'], [0.18, 'GEHEN'], [-0.15, 'STOP']], lu = Math.max(2, Math.round(u * 0.7));
    if (bird.state === 'swim' || bird.state === 'dive') marks.push([-0.8, 'TAUCHEN']);
    for (const [v, label] of marks) text(ctx, label, hx - r * 0.45, hy - v * r - lu * 2.5, 'rgba(253,251,246,0.85)', 'right', lu);
  }
}

function title(u) {
  ctx.fillStyle = 'rgba(43,37,65,0.45)'; ctx.fillRect(0, 0, cw, ch);
  const big = u * 4;
  text(ctx, 'VON OBEN', cw / 2 + big / 2, ch * 0.3 + big / 2, tone(HEX.charcoal, 'line'), 'center', big);
  text(ctx, 'VON OBEN', cw / 2, ch * 0.3, HEX.white, 'center', big);
  const lines = ['LINKS: DREHEN', 'RECHTS: GEHEN, RENNEN, FLIEGEN', 'LOSLASSEN: LANDEN', 'IM MEER NACH UNTEN: TAUCHEN', '', 'FLIEGEN KOSTET ENERGIE.', 'FRISS MÄUSE, KÄFER, WÜRMER UND FISCHE!', '', 'TIPPEN ZUM STARTEN'];
  lines.forEach((l, i) => text(ctx, l, cw / 2, ch * 0.3 + big * 9 + i * Math.round(u * 1.5) * 9, i === lines.length - 1 && Math.sin(world.time * 4) < 0 ? HEX.yellow : HEX.white, 'center', Math.round(u * 1.5)));
}

requestAnimationFrame(frame);
