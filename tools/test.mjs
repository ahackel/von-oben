// npm test: the island and the eagle without a screen: there is land and sea, a village; the eagle takes off, flies,
// gets tired, glides down and lands when let go; it can't walk through a house; it eats; it swims, dives and (with luck) catches a fish.
import assert from 'node:assert/strict';
import { makeWorld, makeRoom, makeSea, LONG, onIce, floesOf, update, setWeather, terrain, isWater, blocked, doorAt, seedOf, W, H, GRASS, ROCK, DEEP, WALL, PERCH } from '../src/world.js';
import * as fam from '../src/family.js';
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
const pt = w.food.find((f) => f.gone <= 0 && f.kind === 'beetle'), fb = makeBird(pt.x + 12, pt.y + 6, 60); fb.state = 'air'; fb.v = 0;
for (let n = 0; n < 90 && !fb.target; n++) { fb.x = pt.x + 12; fb.y = pt.y + 6; fb.z = 60; step(fb, { push: 0.75 }, 1 / 60, w); }
assert.equal(fb.target, pt, 'fixed on the beetle');
for (let n = 0; n < 120 && !fb.prey; n++) { update(w, 1 / 60, fb); step(fb, { push: -1 }, 1 / 60, w); }
assert.equal(fb.prey, 'beetle', 'stooped on it, caught it');
// gliding down by the nest, a little off: drawn in, sitting in it
const nb = makeBird(w.nest.x + 25, w.nest.y + 10, PERCH + 25); nb.state = 'air'; nb.v = 30; nb.a = Math.PI;
run(nb, { push: 0 }, 2.5);
assert.ok(nb.state === 'ground' && nb.z === PERCH && nb.perch?.nest, 'drawn into the nest');
// flying by the nest a while: fixed on it; stooping, it lands in it
const hb = makeBird(w.nest.x + 50, w.nest.y + 20, 80); hb.state = 'air'; hb.v = 0;
for (let n = 0; n < 90 && !hb.target; n++) { hb.x = w.nest.x + 50; hb.y = w.nest.y + 20; hb.z = 80; step(hb, { push: 0.75 }, 1 / 60, w); }
assert.ok(hb.target?.nest, 'fixed on the nest');
run(hb, { push: -1 }, 1.5);
assert.ok(hb.state === 'ground' && hb.z === PERCH && hb.perch?.nest, 'stooped into the nest');
// the weather: rain brings out worms and frogs
{
  setWeather(w, 'rain');
  for (let n = 0; n < 600; n++) update(w, 1 / 20);
  const out = w.food.filter((f) => f.gone <= 0), wet = out.filter((f) => f.kind === 'worm' || f.kind === 'frog').length;
  assert.ok(wet > out.length * 0.6, `rain: worms and frogs (${wet}/${out.length})`);
}
// out to sea, beyond the island's map
const o = makeBird(W - 20, H / 2, CRUISE); o.state = 'air'; o.v = 90; o.a = 0; run(o, { push: 1 }, 10);
assert.ok(o.x > W + 300 && o.state === 'air', 'far out over the sea');
// other islands: each its own, the same each time
{
  const a = makeWorld(seedOf(1)), b = makeWorld(seedOf(1));
  assert.notDeepEqual(a.ground.slice(0, 5000).join() + a.nest.x, w.ground.slice(0, 5000).join() + w.nest.x, 'another island');
  assert.deepEqual([a.nest, a.objects.length], [b.nest, b.objects.length], 'the same for everyone');
}
// barns and caves: in through the door, the mouth
const barn = w.objects.find((o) => o.door), cave = w.objects.find((o) => o.cave);
assert.ok(barn && cave, 'a barn, a cave');
const wb = makeBird(barn.x, barn.y + 6); wb.a = -Math.PI / 2;
let inside = null; for (let n = 0; n < 120 && !inside; n++) { step(wb, { push: 0.3 }, 1 / 60, w); inside = doorAt(w, wb.x, wb.y, wb.z); }
assert.equal(inside, barn, 'walked in at the barn door');
assert.ok(blocked(w, barn.x - 20, barn.y - 10) && !blocked(w, barn.x, barn.y - 10), 'its walls, its door');
for (const kind of ['barn', 'cave']) {
  const r = makeRoom(kind, 3), rb = makeBird(r.exit.x, r.exit.y - 30, 0); rb.state = 'ground'; rb.a = -Math.PI / 2;
  for (let t = 0; t < 6; t += 1 / 60) step(rb, { push: 1, turn: 0.2 }, 1 / 60, r);
  assert.ok(rb.z <= r.roof + 0.01 && terrain(r, rb.x, rb.y) !== WALL, `${kind}: under its roof, inside its walls`);
  assert.ok(r.food.length > 10 && (kind === 'barn' || r.gems.length > 3), `${kind}: prey${kind === 'cave' ? ', treasure' : ''}`);
}
// the family: five days at home, an egg; a chick; fed, grown in three days; flown off, an eagle of its own
{
  const save = fam.newGame('ADA', w.nest), e = fam.current(save);
  for (let d = 0; d < 4; d++) assert.equal(fam.nextDay(e), null);
  assert.equal(fam.nextDay(e), 'egg'); assert.equal(fam.nextDay(e), 'hatch');
  const g0 = fam.growth(e.brood.chick);
  fam.nextDay(e); assert.equal(e.brood.chick.grown, 0, 'not fed: not grown');
  assert.ok(fam.hungry(e)); fam.feed(e); assert.ok(!fam.hungry(e), 'once a day is enough');
  assert.ok(fam.growth(e.brood.chick) > g0, 'fed: a little bigger');
  fam.nextDay(e); assert.equal(e.brood.chick.grown, 1, 'fed once: grown a day');
  let ev = null; for (let d = 0; d < 2; d++) { fam.feed(e); ev = fam.nextDay(e); }
  assert.equal(ev, 'grown');
  e.brood.chick.name = 'BEN';
  const k = fam.fledge(save, e);
  assert.ok(k.name === 'BEN' && !k.home && e.brood.stage === 'none' && save.eagles.length === 2, 'flown off');
  assert.ok(!fam.claim(save, k, w.nest), 'its parent\'s nest is taken');
  const there = fam.onward(save, k);
  assert.ok(!save.eagles.some((x) => x.isl === there) && there !== fam.onward(save, k), 'over the sea: an island no eagle has seen, a new one each time');
  k.isl = there; assert.ok(fam.claim(save, k, { x: 5, y: 5 }) && fam.residentOf(save, there) === k, 'a free nest: its home');
  assert.equal(fam.onward(save, k), save.islands[(save.islands.indexOf(there) + 1) % save.islands.length], 'at home: on to the islands it knows');
  // in the nest with prey, the chick hungry: fed to it, not eaten
  const fb = makeBird(w.nest.x, w.nest.y, PERCH); fb.prey = 'mouse'; fb.feeds = true; fb.energy = 50;
  run(fb, { push: 0 }, 1);
  assert.ok(!fb.prey && fb.energy >= 50 && fb.events.some((v) => v.type === 'feed'), 'fed to the chick');
}
// swimming by a fish: diving, it has it (every time)
{ const f = w.fish[3], d = makeBird(f.x + 5, f.y); d.state = 'swim'; d.wet = 1; f.t = 0; run(d, { push: -1 }, 0.1); run(d, { push: 0 }, 1.5); assert.equal(d.prey, 'fish', 'dived by a fish: caught'); }
// cold a while: floes on the sea near the shore, to stand on
{
  assert.equal(floesOf(w).length, 0, 'no ice when warm');
  w.ice = 1; const fl = floesOf(w)[0]; assert.ok(fl && isWater(w, fl.x, fl.y) && onIce(w, fl.x, fl.y), 'floes on the sea');
  const ib = makeBird(fl.x, fl.y, 10); ib.state = 'air'; run(ib, { push: 0 }, 1);
  assert.ok(ib.state === 'ground' && ib.z === 0, 'landed on the ice, not in the sea'); w.ice = 0;
}
// a new nest: twigs from a tree, straw (from a barn's hay), brought to the rock; built, its home
{
  const save = fam.newGame('ADA', w.nest), k = fam.fledge(save, Object.assign(fam.current(save), { brood: { stage: 'chick', days: 0, chick: { name: 'BO', look: 3, fed: 0, grown: 3, ready: true } } }));
  assert.equal(fam.needs(save, k), null, 'its parent\'s island: no nest to build');
  k.isl = fam.onward(save, k); assert.deepEqual(fam.needs(save, k), { twig: 4, straw: 2 });
  const tree = w.objects.find((o) => /^pine/.test(o.art)), tb = makeBird(tree.x + 8, tree.y); tb.wants = fam.needs(save, k); run(tb, { push: 0 }, 0.2);
  assert.equal(tb.prey, 'twig', 'a twig picked up by a tree');
  run(tb, { push: 0 }, 2); assert.equal(tb.prey, 'twig', 'not eaten');
  const nb = makeBird(w.nest.x, w.nest.y, PERCH); nb.prey = 'twig'; nb.nestOk = false; run(nb, { push: 0 }, 1);
  assert.ok(!nb.prey && nb.events.some((v) => v.type === 'build'), 'brought to the rock');
  assert.equal(fam.build(save, k, 'straw', w.nest), true); assert.equal(fam.build(save, k, 'straw', w.nest), true); assert.equal(fam.build(save, k, 'straw', w.nest), false, 'enough straw');
  for (let n = 0; n < 3; n++) fam.build(save, k, 'twig', w.nest);
  assert.equal(fam.build(save, k, 'twig', w.nest), 'done'); assert.equal(k.home, k.isl, 'built: its home');
}
// the open sea between islands: long, rocks along it to rest on (a little), fish round them
{
  const sw = makeSea({ across: true, d: 1, lat: 1500, seed: 4 }), rk = sw.objects.filter((o) => o.perch);
  assert.ok(sw.W === LONG && rk.length >= 4 && sw.fish.length > 40, `the open sea (${rk.length} rocks)`);
  const rb = makeBird(rk[0].x, rk[0].y, PERCH); rb.energy = 20; for (let t = 0; t < 3; t += 1 / 60) step(rb, { push: 0 }, 1 / 60, sw);
  assert.ok(rb.energy > 25 && !rb.asleep, 'resting on a rock at sea');
}
// each new island its surprise
assert.deepEqual([1, 2, 3, 4, 5].map((k) => makeWorld(seedOf(k)).feature), ['caves', 'wreck', 'farm', 'tower', 'isles']);
console.log('ok');
