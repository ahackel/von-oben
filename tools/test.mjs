// npm test: the island and the eagle without a screen: there is land and sea, a village; the eagle takes off, flies,
// gets tired, glides down and lands when let go; it can't walk through a house; it eats; it swims, dives and (with luck) catches a fish.
import assert from 'node:assert/strict';
import { makeWorld, terrain, isWater, blocked, W, H, GRASS } from '../src/world.js';
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

// food: walking over it
const f = w.food.find((f) => f.gone <= 0);
const e = makeBird(f.x - 3, f.y); e.a = 0; e.energy = 50; run(e, { push: 0.1 }, 0.5);
assert.ok(f.gone > 0 && e.energy > 50, 'ate');

// the sea: swimming, diving, a fish now and then
const fish = w.fish[0], s = makeBird(fish.x, fish.y); s.state = 'swim';
let caught = 0;
for (let n = 0; n < 40 && !caught; n++) {
  s.x = fish.x; s.y = fish.y; fish.t = 0;
  run(s, { push: -1 }, 0.1); assert.equal(s.state, 'dive');
  run(s, { push: 0 }, 1.5); assert.equal(s.state, 'swim');
  caught = s.fish;
}
assert.ok(caught, 'caught a fish');
assert.ok(terrain(w, w.village.x, w.village.y) !== GRASS, 'the street is a path');
console.log('ok');
