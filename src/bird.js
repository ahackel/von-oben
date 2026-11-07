// The eagle, without a screen: where it is (x, y on the ground, z its height), which way it looks (a, radians: 0 east,
// turning clockwise), how fast (v, px/s) and what it is doing: on the ground (walking, running), in the air, swimming,
// diving. Steered by two sticks: turn (-1..1) and push (-1..1: up from standing, walking, running to flying; down,
// on the sea, to dive; flying, to stoop). Let go and it slows, glides down and lands. It hunts stooping: down fast on
// a mouse, beetle, worm or fish, it has it in its claws; eaten only on land. Rocks (PERCH px up) to land on; one its
// home, a nest: sitting still in it, it falls asleep and its energy fills up.
import { W, H, SEA, PERCH, WALL, terrain, blocked, isWater, perchNear, snatch, take, alive, nearestPrey, FOOD } from './world.js';

export const CRUISE = 90, HIGH = 150; // (the height it flies at; up to, the stick right up: over the clouds)
const NEST = 10, SLEEP_AFTER = 1, REST = 25; // (how near the nest's middle it sits in it; still how long till asleep; energy a second asleep)
const WALK = 18, RUN = 40, TAKEOFF = 56, FAST = 95, SWIM = 16, GLIDE = 30, DIVE = 1.1, CATCH = 22, LUCK = 0.55;
const STOOP = 75, CLAW = 16, EAT = 0.7; // (how fast it falls stooping; how near it snatches; how long eating takes)
const PECK = 9, SPOT = 70, LOSE = 120, FOCUS = 0.8, HOMING = 40; // (on foot: how near it grabs; flying: how near prey is spotted, lost; how long till it is fixed on it; how far a rock draws it in, gliding down)
const toward = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));
export const FLY_AT = 0.7; // (the push from which it flies)
// how fast it wants to go on the ground, by the push
const paced = (p) => (p <= 0.02 ? 0 : p < 0.35 ? 6 + (WALK - 6) * (p / 0.35) : p < FLY_AT ? WALK + ((RUN - WALK) * (p - 0.35)) / 0.35 : RUN);

export const makeBird = (x, y, z = 0) => ({ x, y, z, still: 0, asleep: false, a: Math.PI / 2, v: 0, state: 'ground', energy: 100, prey: null, target: null, focus: 0, stooping: false, eating: 0, caught: 0, perch: null, dive: 0, stride: 0, flap: 0, events: [] });

export function step(b, { turn = 0, push = 0 }, dt, w) {
  const fly = push >= FLY_AT && b.energy > 0, off = fly && b.energy > 5;
  b.a = (b.a + turn * (b.state === 'air' ? 1.9 : 2.8) * dt) % (Math.PI * 2);
  let cost = 0;
  const perched = b.state === 'ground' && b.z > 0;
  if (perched) b.perch ??= perchNear(w, b.x, b.y, NEST * 2);
  const inNest = perched && b.perch?.nest && b.nestOk !== false && Math.hypot(b.x - b.perch.x, b.y - b.perch.y) < NEST;
  if (b.state === 'ground' || b.state === 'swim') {
    const swim = b.state === 'swim'; b.wet = swim ? (b.wet || 0) + dt : 0; // (just down in the sea from a stoop: not diving yet)
    const t = off ? TAKEOFF + 4 : Math.min(paced(push), swim ? SWIM : RUN);
    b.v = toward(b.v, t, (t > b.v ? (swim ? 30 : 50) : 80) * dt);
    if (off && b.v >= TAKEOFF) b.state = 'air';
    else if (swim && push < -0.5 && b.wet > 0.5) { b.state = 'dive'; b.dive = DIVE; b.v *= 0.3; b.events.push({ type: 'splash', x: b.x, y: b.y }); }
    cost = swim ? 0.4 : b.v > WALK + 2 ? 0.6 : b.v > 1 ? 0.2 : 0;
    if (!swim && !b.z && !b.prey) { const kind = snatch(w, b.x, b.y, PECK); if (kind) { b.prey = kind; b.events.push({ type: 'catch', kind, x: b.x, y: b.y }); } } // (on foot: grabbed)
    if (!swim && b.prey && b.v < 3) { // (on land, with its prey: eating it; in the nest, a chick hungry: feeding it)
      if (inNest && b.feeds && (b.eating += dt) > EAT) { b.events.push({ type: 'feed', kind: b.prey, x: b.x, y: b.y - b.z }); b.prey = null; b.eating = 0; }
      else if (!(inNest && b.feeds) && (b.eating += dt) > EAT) { b.energy += FOOD[b.prey]; b.events.push({ type: 'eat', x: b.x, y: b.y - b.z, value: FOOD[b.prey] }); b.prey = null; b.caught++; b.eating = 0; }
    } else b.eating = 0;
    b.still = inNest && b.v < 1 && push <= 0.02 ? b.still + dt : 0;
    b.asleep = b.still > SLEEP_AFTER;
    if (b.asleep) cost = -REST;
  } else if (b.state === 'dive') {
    b.v = toward(b.v, 0, 20 * dt); cost = 2;
    if ((b.dive -= dt) <= 0) {
      b.state = 'swim';
      const f = w.fish.filter((f) => f.t <= 0).find((f) => Math.hypot(f.x - b.x, f.y - b.y) < CATCH);
      if (f && !b.prey && w.rand() < LUCK) { f.t = 20; b.prey = 'fish'; b.events.push({ type: 'catch', kind: 'fish', x: b.x, y: b.y }); }
      else b.events.push({ type: 'miss', x: b.x, y: b.y });
    }
  } else { // air
    const was = b.z, stoop = !fly && push < -0.3;
    // flying near prey a while: fixed on it (the nearest), till it is gone or far
    // (or on the nest, near it: carrying prey home, or to sleep)
    const nest = (t) => t?.nest === true, nestAt = w.objects.find(nest);
    if (b.target && ((!nest(b.target) && (!alive(b.target) || b.prey)) || Math.hypot(b.target.x - b.x, b.target.y - b.y) > LOSE)) b.target = null;
    if (!b.target) {
      const dn = nestAt ? Math.hypot(nestAt.x - b.x, nestAt.y - b.y) : Infinity, q = !b.prey && nearestPrey(w, b.x, b.y, Math.min(SPOT, dn)), p = q || (dn < SPOT ? nestAt : null); // (whichever is nearer)
      b.focus = p ? b.focus + dt : 0; if (b.focus > FOCUS) { b.target = p; b.focus = 0; }
    }
    b.stooping = stoop;
    if (fly) { const top = Math.min(w.roof ?? HIGH, CRUISE + Math.max(0, (push - 0.85) / 0.15) * (HIGH - CRUISE)); /* (inside: no higher than the roof) */ b.z = toward(b.z, top, 40 * dt); b.v = toward(b.v, TAKEOFF + (FAST - TAKEOFF) * Math.min(1, (push - FLY_AT) / (1 - FLY_AT)), 30 * dt); cost = b.z < top - 1 ? 4 : 2.5; b.climbing = b.z < top - 1; }
    else { b.z -= (stoop ? STOOP : 28) * dt; b.v = toward(b.v, GLIDE, 20 * dt); cost = 0.5; }
    b.x += w.wind.x * dt * Math.min(1, b.z / 30); b.y += w.wind.y * dt * Math.min(1, b.z / 30); // (the wind carrying it, up high)
    b.flap += dt; b.flapping = fly; if (!fly) b.climbing = false;
    if (stoop && b.target) { // (stooping on it: headed at it, as fast as reaches it as it comes down)
      const dx = b.target.x - b.x, dy = b.target.y - b.y, d = Math.hypot(dx, dy), down = b.z - (nest(b.target) ? PERCH : 0);
      if (d > 0.5) b.a = Math.atan2(dy, dx);
      b.v = Math.min(140, d / Math.max(0.05, down / STOOP));
    }
    if (stoop && !b.prey && b.z < 8) {
      const kind = b.target && !nest(b.target) && Math.hypot(b.target.x - b.x, b.target.y - b.y) < CLAW * 1.5 ? take(w, b.target) : snatch(w, b.x, b.y, CLAW);
      if (kind) { b.prey = kind; b.target = null; b.events.push({ type: 'catch', kind, x: b.x, y: b.y }); }
    }
    const near = !fly && !(stoop && b.target && !nest(b.target)) && b.z > PERCH && b.z < PERCH + 30 && perchNear(w, b.x, b.y, HOMING);
    if (near) { const k = Math.min(1, dt * 6); b.x += (near.x - b.x) * k; b.y += (near.y - b.y) * k; } // (gliding down by a rock: drawn onto it)
    const rock = !fly && was > PERCH && b.z <= PERCH && perchNear(w, b.x, b.y, NEST * 1.8);
    if (rock) { b.perch = rock; b.z = PERCH; b.x = rock.x; b.y = rock.y; b.state = 'ground'; b.v = 0; } // (on a rock: it settles in the middle)
    else if (b.z <= 0) {
      b.z = 0;
      if (isWater(w, b.x, b.y)) { b.state = 'swim'; b.v = Math.min(b.v, SWIM); b.events.push({ type: 'splash', x: b.x, y: b.y }); }
      else { b.state = 'ground'; b.v = Math.min(b.v, RUN); }
    }
  }
  b.energy = Math.max(0, Math.min(100, b.energy - cost * dt));
  // moving: on the ground round what stands in the way (each way alone, so it slides along a wall), in the air over it
  if (b.state !== 'ground') { b.asleep = false; b.still = 0; }
  if (b.state !== 'air') { b.target = null; b.focus = 0; b.stooping = false; }
  const dx = Math.cos(b.a) * b.v * dt, dy = Math.sin(b.a) * b.v * dt, grounded = b.state === 'ground' && !b.z;
  const stop = (x, y) => (grounded ? blocked(w, x, y) : terrain(w, x, y) === WALL); // (inside, even flying: the walls)
  if (!stop(b.x + dx, b.y)) b.x += dx;
  if (!stop(b.x, b.y + dy)) b.y += dy;
  if (!w.room) { b.x = Math.max(-SEA - 40, Math.min(W + SEA + 40, b.x)); b.y = Math.max(-SEA - 40, Math.min(H + SEA + 40, b.y)); } // (beyond the sea's edge: the next island, see main)
  b.stride += b.v * dt;
  if (b.state === 'ground' && b.z > 0 && (!b.perch || Math.hypot(b.x - b.perch.x, b.y - b.perch.y) > NEST)) b.state = 'air'; // (off the rock's edge: gliding)
  else if (b.state === 'ground' && !b.z && isWater(w, b.x, b.y)) { b.state = 'swim'; b.v = Math.min(b.v, SWIM); b.events.push({ type: 'splash', x: b.x, y: b.y }); }
  else if (b.state === 'swim' && !isWater(w, b.x, b.y)) b.state = 'ground';
}
