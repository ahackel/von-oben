// The eagle, without a screen: where it is (x, y on the ground, z its height), which way it looks (a, radians: 0 east,
// turning clockwise), how fast (v, px/s) and what it is doing: on the ground (walking, running), in the air, swimming,
// diving. Steered by two sticks: turn (-1..1) and push (-1..1: up from standing, walking, running to flying; down,
// on the sea, to dive). Let go and it slows, glides down and lands.
import { W, H, blocked, isWater, eat, FOOD } from './world.js';

export const CRUISE = 90; // (height it flies at)
const WALK = 18, RUN = 40, TAKEOFF = 56, FAST = 95, SWIM = 16, GLIDE = 30, DIVE = 1.1, CATCH = 22, LUCK = 0.55;
const toward = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));
export const FLY_AT = 0.7; // (the push from which it flies)
// how fast it wants to go on the ground, by the push
const paced = (p) => (p <= 0.02 ? 0 : p < 0.35 ? 6 + (WALK - 6) * (p / 0.35) : p < FLY_AT ? WALK + ((RUN - WALK) * (p - 0.35)) / 0.35 : RUN);

export const makeBird = (x, y) => ({ x, y, z: 0, a: Math.PI / 2, v: 0, state: 'ground', energy: 100, fish: 0, dive: 0, carry: 0, stride: 0, flap: 0, events: [] });

export function step(b, { turn = 0, push = 0 }, dt, w) {
  const fly = push >= FLY_AT && b.energy > 0, off = fly && b.energy > 5;
  b.a = (b.a + turn * (b.state === 'air' ? 1.9 : 2.8) * dt) % (Math.PI * 2);
  if (b.carry > 0) b.carry -= dt;
  let cost = 0;
  if (b.state === 'ground' || b.state === 'swim') {
    const swim = b.state === 'swim', t = off ? TAKEOFF + 4 : Math.min(paced(push), swim ? SWIM : RUN);
    b.v = toward(b.v, t, (t > b.v ? (swim ? 30 : 50) : 80) * dt);
    if (off && b.v >= TAKEOFF) b.state = 'air';
    else if (swim && push < -0.5) { b.state = 'dive'; b.dive = DIVE; b.v *= 0.3; b.events.push({ type: 'splash', x: b.x, y: b.y }); }
    cost = swim ? 0.4 : b.v > WALK + 2 ? 0.6 : b.v > 1 ? 0.2 : 0;
  } else if (b.state === 'dive') {
    b.v = toward(b.v, 0, 20 * dt); cost = 2;
    if ((b.dive -= dt) <= 0) {
      b.state = 'swim';
      const f = w.fish.filter((f) => f.t <= 0).find((f) => Math.hypot(f.x - b.x, f.y - b.y) < CATCH);
      if (f && w.rand() < LUCK) { f.t = 20; b.fish++; b.carry = 2.5; b.energy += 35; b.events.push({ type: 'fish', x: b.x, y: b.y, value: 35 }); }
      else b.events.push({ type: 'miss', x: b.x, y: b.y });
    }
  } else { // air
    if (fly) { b.z = toward(b.z, CRUISE, 40 * dt); b.v = toward(b.v, TAKEOFF + (FAST - TAKEOFF) * Math.min(1, (push - FLY_AT) / (1 - FLY_AT)), 30 * dt); cost = b.z < CRUISE ? 4 : 2.5; }
    else { b.z -= (push < -0.3 ? 50 : 28) * dt; b.v = toward(b.v, GLIDE, 20 * dt); cost = 0.5; }
    b.flap += dt; b.flapping = fly; b.climbing = fly && b.z < CRUISE;
    if (b.z <= 0) {
      b.z = 0;
      if (isWater(w, b.x, b.y)) { b.state = 'swim'; b.v = Math.min(b.v, SWIM); b.events.push({ type: 'splash', x: b.x, y: b.y }); }
      else { b.state = 'ground'; b.v = Math.min(b.v, RUN); }
    }
  }
  b.energy = Math.max(0, Math.min(100, b.energy - cost * dt));
  // moving: on the ground round what stands in the way (each way alone, so it slides along a wall), in the air over it
  const dx = Math.cos(b.a) * b.v * dt, dy = Math.sin(b.a) * b.v * dt, grounded = b.state === 'ground';
  if (!grounded || !blocked(w, b.x + dx, b.y)) b.x += dx;
  if (!grounded || !blocked(w, b.x, b.y + dy)) b.y += dy;
  b.x = Math.max(8, Math.min(W - 8, b.x)); b.y = Math.max(8, Math.min(H - 8, b.y));
  b.stride += b.v * dt;
  if (b.state === 'ground' && isWater(w, b.x, b.y)) { b.state = 'swim'; b.v = Math.min(b.v, SWIM); b.events.push({ type: 'splash', x: b.x, y: b.y }); }
  else if (b.state === 'swim' && !isWater(w, b.x, b.y)) b.state = 'ground';
  if (b.state === 'ground') for (const f of w.food) if (f.gone <= 0 && Math.hypot(f.x - b.x, f.y - b.y) < 7) {
    b.energy = Math.min(100, b.energy + eat(w, f)); b.events.push({ type: 'eat', x: f.x, y: f.y, value: FOOD[f.kind] });
  }
}
