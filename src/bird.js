// The eagle, without a screen: where it is (x, y on the ground, z its height), which way it looks (a, radians: 0 east,
// turning clockwise), how fast (v, px/s) and what it is doing: on the ground (walking, running), in the air, swimming,
// diving. Steered by two sticks: turn (-1..1) and push (-1..1: up from standing, walking, running to flying; down,
// on the sea, to dive). Let go and it slows, glides down and lands. Its home: a nest on a rock (PERCH px up), reached
// flying; sitting still in it, it falls asleep and its energy fills up.
import { W, H, SEA, PERCH, blocked, isWater, eat, FOOD } from './world.js';

export const CRUISE = 90; // (height it flies at)
const NEST = 10, SLEEP_AFTER = 1, REST = 25; // (how near the nest's middle it sits in it; still how long till asleep; energy a second asleep)
const WALK = 18, RUN = 40, TAKEOFF = 56, FAST = 95, SWIM = 16, GLIDE = 30, DIVE = 1.1, CATCH = 22, LUCK = 0.55;
const toward = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));
export const FLY_AT = 0.7; // (the push from which it flies)
// how fast it wants to go on the ground, by the push
const paced = (p) => (p <= 0.02 ? 0 : p < 0.35 ? 6 + (WALK - 6) * (p / 0.35) : p < FLY_AT ? WALK + ((RUN - WALK) * (p - 0.35)) / 0.35 : RUN);

export const makeBird = (x, y, z = 0) => ({ x, y, z, still: 0, asleep: false, a: Math.PI / 2, v: 0, state: 'ground', energy: 100, fish: 0, dive: 0, carry: 0, stride: 0, flap: 0, events: [] });

export function step(b, { turn = 0, push = 0 }, dt, w) {
  const fly = push >= FLY_AT && b.energy > 0, off = fly && b.energy > 5;
  b.a = (b.a + turn * (b.state === 'air' ? 1.9 : 2.8) * dt) % (Math.PI * 2);
  if (b.carry > 0) b.carry -= dt;
  let cost = 0;
  const perched = b.state === 'ground' && b.z > 0, inNest = Math.hypot(b.x - w.nest.x, b.y - w.nest.y) < NEST;
  if (b.state === 'ground' || b.state === 'swim') {
    const swim = b.state === 'swim', t = off ? TAKEOFF + 4 : Math.min(paced(push), swim ? SWIM : RUN);
    b.v = toward(b.v, t, (t > b.v ? (swim ? 30 : 50) : 80) * dt);
    if (off && b.v >= TAKEOFF) b.state = 'air';
    else if (swim && push < -0.5) { b.state = 'dive'; b.dive = DIVE; b.v *= 0.3; b.events.push({ type: 'splash', x: b.x, y: b.y }); }
    cost = swim ? 0.4 : b.v > WALK + 2 ? 0.6 : b.v > 1 ? 0.2 : 0;
    b.still = perched && inNest && b.v < 1 && push <= 0.02 ? b.still + dt : 0;
    b.asleep = b.still > SLEEP_AFTER;
    if (b.asleep) cost = -REST;
  } else if (b.state === 'dive') {
    b.v = toward(b.v, 0, 20 * dt); cost = 2;
    if ((b.dive -= dt) <= 0) {
      b.state = 'swim';
      const f = w.fish.filter((f) => f.t <= 0).find((f) => Math.hypot(f.x - b.x, f.y - b.y) < CATCH);
      if (f && w.rand() < LUCK) { f.t = 20; b.fish++; b.carry = 2.5; b.energy += 35; b.events.push({ type: 'fish', x: b.x, y: b.y, value: 35 }); }
      else b.events.push({ type: 'miss', x: b.x, y: b.y });
    }
  } else { // air
    const was = b.z;
    if (fly) { b.z = toward(b.z, CRUISE, 40 * dt); b.v = toward(b.v, TAKEOFF + (FAST - TAKEOFF) * Math.min(1, (push - FLY_AT) / (1 - FLY_AT)), 30 * dt); cost = b.z < CRUISE ? 4 : 2.5; }
    else { b.z -= (push < -0.3 ? 50 : 28) * dt; b.v = toward(b.v, GLIDE, 20 * dt); cost = 0.5; }
    b.flap += dt; b.flapping = fly; b.climbing = fly && b.z < CRUISE;
    if (!fly && Math.hypot(b.x - w.nest.x, b.y - w.nest.y) < NEST * 1.8 && was > PERCH && b.z <= PERCH) { b.z = PERCH; b.x = w.nest.x; b.y = w.nest.y; b.state = 'ground'; b.v = 0; } // (home: it settles in the middle)
    else if (b.z <= 0) {
      b.z = 0;
      if (isWater(w, b.x, b.y)) { b.state = 'swim'; b.v = Math.min(b.v, SWIM); b.events.push({ type: 'splash', x: b.x, y: b.y }); }
      else { b.state = 'ground'; b.v = Math.min(b.v, RUN); }
    }
  }
  b.energy = Math.max(0, Math.min(100, b.energy - cost * dt));
  // moving: on the ground round what stands in the way (each way alone, so it slides along a wall), in the air over it
  if (b.state !== 'ground') { b.asleep = false; b.still = 0; }
  const dx = Math.cos(b.a) * b.v * dt, dy = Math.sin(b.a) * b.v * dt, grounded = b.state === 'ground' && !b.z;
  if (!grounded || !blocked(w, b.x + dx, b.y)) b.x += dx;
  if (!grounded || !blocked(w, b.x, b.y + dy)) b.y += dy;
  b.x = Math.max(-SEA, Math.min(W + SEA, b.x)); b.y = Math.max(-SEA, Math.min(H + SEA, b.y));
  b.stride += b.v * dt;
  if (b.state === 'ground' && b.z > 0 && Math.hypot(b.x - w.nest.x, b.y - w.nest.y) > NEST) b.state = 'air'; // (off the rock's edge: gliding)
  else if (b.state === 'ground' && isWater(w, b.x, b.y)) { b.state = 'swim'; b.v = Math.min(b.v, SWIM); b.events.push({ type: 'splash', x: b.x, y: b.y }); }
  else if (b.state === 'swim' && !isWater(w, b.x, b.y)) b.state = 'ground';
  if (b.state === 'ground' && !b.z) for (const f of w.food) if (f.gone <= 0 && Math.hypot(f.x - b.x, f.y - b.y) < 7) {
    b.energy = Math.min(100, b.energy + eat(w, f)); b.events.push({ type: 'eat', x: f.x, y: f.y, value: FOOD[f.kind] });
  }
}
