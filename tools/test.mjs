// npm test: the island and the eagle without a screen: there is land and sea, a village; the eagle takes off, flies,
// gets tired, glides down and lands when let go; it can't walk through a house; it eats; it swims, dives and (with luck) catches a fish.
import assert from 'node:assert/strict';
import { makeWorld, update, terrain, isWater, blocked, W, H, GRASS, ROCK, DEEP, PERCH } from '../src/world.js';
import { makeBird, step, CRUISE } from '../src/bird.js';

const w = makeWorld();
let land = 0, sea = 0;
for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 16) isWater(w, x, y) ? sea++ : land++;
assert.ok(land > 0.25 * (land + sea) && sea > 0.25 * (land + sea), `land and sea (${land}/${sea})`);
assert.ok(w.objects.filter((o) => o.art.startsWith('house')).length >= 8, 'a village');
assert.ok(w.objects.length > 200, 'trees');
const run = (b, inp, secs) => { for (let t = 0; t < secs; t += 1 / 60) step(b, inp, 1 / 60, w); };

const b = makeBird(w.village.x - 28, w.village.y + 2);
assert.equal(terrain(w, b.x, b.y) !== undefined && !isWater(w, b.x, b.y), true, 'starts on land');
b.a = 0; run(b, { push: 1 }, 4);
assert.equal(b.state, 'air', 'takes off');
assert.ok(b.z > CRUISE * 0.9 && b.energy < 100, 'climbs, costs energy');
run(b, { push: 0 }, 6);
assert.notEqual(b.state, 'air', 'let go: lands');
assert.equal(b.z, 0);
// out of energy: it can't stay up
const t = makeBird(w.village.x - 28, w.village.y + 2); t.a = 0; run(t, { push: 1 }, 3); t.energy = 0; run(t, { push: 1 }, 6);
assert.notEqual(t.state, 'air', 'no energy: down it comes');

// a house in the way: it stops at the wall
const h = w.objects.find((o) => o.art.startsWith('house'));
const g = makeBird(h.x, h.y + 12); g.a = -Math.PI / 2; run(g, { push: 0.6 }, 3);
assert.ok(!blocked(w, g.x, g.y) && g.y >= h.y, 'stopped by the house');

// prey: startled by the eagle near and low, it runs off
const f = w.food.find((f) => f.gone <= 0 && f.kind === 'mouse');
const near = makeBird(f.x - 20, f.y), d0 = Math.hypot(f.x - near.x, f.y - near.y);
for (let n = 0; n < 60; n++) update(w, 1 / 60, near);
assert.ok(Math.hypot(f.x - near.x, f.y - near.y) > d0 + 5, 'the mouse runs away');
// stooping on it: in the claws; eaten only on land
const e = makeBird(f.x - 2, f.y, 10); e.state = 'air'; e.a = 0; e.energy = 50; run(e, { push: -1 }, 0.3);
assert.ok(e.prey === 'mouse' && f.gone > 0 && e.energy < 51, 'caught, not eaten yet');
run(e, { push: 0 }, 1.5);
assert.ok(!e.prey && e.energy > 70 && e.caught === 1, 'eaten on land');
// a fish, stooped on from the air: held while swimming, not eaten in the sea
const fs = w.fish[1], sf = makeBird(fs.x, fs.y, 10); sf.state = 'air'; sf.v = 0; run(sf, { push: -1 }, 0.3);
assert.ok(sf.prey === 'fish' && sf.state === 'swim', 'a fish in its claws');
run(sf, { push: 0 }, 2); assert.equal(sf.prey, 'fish', 'not eaten in the sea');

// the sea: swimming, diving, a fish now and then
const fish = w.fish[0], s = makeBird(fish.x, fish.y); s.state = 'swim';
let caught = 0;
for (let n = 0; n < 40 && !caught; n++) {
  s.x = fish.x; s.y = fish.y; fish.t = 0; s.wet = 1;
  run(s, { push: -1 }, 0.1); assert.equal(s.state, 'dive');
  run(s, { push: 0 }, 1.5); assert.equal(s.state, 'swim');
  caught = s.prey === 'fish';
}
assert.ok(caught, 'caught a fish');
assert.ok(terrain(w, w.village.x, w.village.y) !== GRASS, 'the street is a path');
// home: the nest on its rock, in the mountains; landing in it, sleeping in it fills the energy up
assert.equal(terrain(w, w.nest.x, w.nest.y), ROCK, 'the nest is on a rock');
const n = makeBird(w.nest.x + 6, w.nest.y, PERCH + 4); n.state = 'air'; n.v = 30; n.a = Math.PI;
run(n, { push: 0 }, 0.5);
assert.ok(n.state === 'ground' && n.z === PERCH, 'lands in the nest');
n.energy = 10; run(n, { push: 0 }, 1.5);
assert.ok(n.asleep && n.energy > 10, 'asleep, getting its energy back');
run(n, { push: 0 }, 5);
assert.equal(n.energy, 100);
run(n, { push: 0.3 }, 0.8);
assert.ok(!n.asleep && n.state === 'air', 'walking off the rock: woken, gliding down');
run(n, { push: 0 }, 3);
assert.ok(n.state === 'ground' && n.z === 0 && !blocked(w, n.x, n.y), 'down beside the rock, free to walk');
// rocks out in the sea: landing on one, but no sleep there
const rocks = w.objects.filter((o) => o.perch && !o.nest);
assert.ok(rocks.length >= 6 && rocks.some((o) => o.x > W || o.y > H || o.x < 0 || o.y < 0), `rocks at sea (${rocks.length})`);
const r = rocks[0], k = makeBird(r.x + 6, r.y, PERCH + 4); k.state = 'air'; k.v = 30; k.a = Math.PI; k.energy = 10;
run(k, { push: 0 }, 2);
assert.ok(k.state === 'ground' && k.z === PERCH && !k.asleep, 'resting on a rock at sea');
// small islands: land in the map's sea, away from the big island
let isles = 0;
for (let y = 8; y < H; y += 16) for (let x = 8; x < W; x += 16) if (!isWater(w, x, y) && [0, 1, 2, 3].every((q) => terrain(w, x + Math.cos(q * 1.57) * 160, y + Math.sin(q * 1.57) * 160) === DEEP)) isles++;
assert.ok(isles > 0, 'small islands');
// on foot: grabbed when near
const pg = w.food.find((f) => f.gone <= 0), gb = makeBird(pg.x - 4, pg.y); gb.a = 0; run(gb, { push: 0.1 }, 0.3);
assert.ok(gb.prey, 'grabbed on foot');
// flying near prey a while: fixed on it; stooping, it gets it, though it starts off to one side
const pt = w.food.find((f) => f.gone <= 0 && f.kind === 'beetle'), fb = makeBird(pt.x + 40, pt.y + 20, 60); fb.state = 'air'; fb.v = 0;
for (let n = 0; n < 90 && !fb.target; n++) { fb.x = pt.x + 40; fb.y = pt.y + 20; fb.z = 60; step(fb, { push: 0.75 }, 1 / 60, w); }
assert.equal(fb.target, pt, 'fixed on the beetle');
for (let n = 0; n < 120 && !fb.prey; n++) { update(w, 1 / 60, fb); step(fb, { push: -1 }, 1 / 60, w); }
assert.equal(fb.prey, 'beetle', 'stooped on it, caught it');
// gliding down by the nest, a little off: drawn in, sitting in it
const nb = makeBird(w.nest.x + 25, w.nest.y + 10, PERCH + 25); nb.state = 'air'; nb.v = 30; nb.a = Math.PI;
run(nb, { push: 0 }, 2.5);
assert.ok(nb.state === 'ground' && nb.z === PERCH && nb.perch?.nest, 'drawn into the nest');
// out to sea, beyond the island's map
const o = makeBird(W - 20, H / 2, CRUISE); o.state = 'air'; o.v = 90; o.a = 0; run(o, { push: 1 }, 10);
assert.ok(o.x > W + 300 && o.state === 'air', 'far out over the sea');
console.log('ok');
