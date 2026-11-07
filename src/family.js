// The eagles, a family of them, without a screen: each its name, its looks (a number: see eagle.js), the island it is on
// (isl: the island's seed, see world.js), its home there (the nest of an island no other eagle has), where it was and
// how it was (bird), its own days. At home five days, it lays an egg; the next day a chick hatches; each day it is fed
// (once is enough) it grows, three such days and it is grown and can fly off (and be played: over the sea to an island
// no eagle has seen yet, a nest free there); its parent lays again five days on. Kept in the browser (localStorage).
import { PERCH, islandSeed, seedOf } from './world.js';

export const EGG_AFTER = 5, GROW_DAYS = 3, FEEDS = 1; // (days at home till the egg; days fed till grown; prey a day it needs)
const KEY = 'vonOben.v1';

export const brood0 = () => ({ stage: 'none', days: 0, chick: null });
function eagleRec(save, name, isl, x, y, look) {
  return { id: save.next++, name, look, isl, home: null, room: null, dayN: 1, day: 0.08, gems: 0, brood: brood0(), bird: { x, y, z: PERCH, a: Math.PI / 2, state: 'ground', energy: 100, caught: 0, prey: null } };
}
// a new game: the first eagle, at home in the first island's nest
export function newGame(name, nest) {
  const save = { eagles: [], current: 0, next: 1, gems: {}, islands: [seedOf(0)] };
  const e = eagleRec(save, name, seedOf(0), nest.x, nest.y, 0);
  e.home = e.isl; e.nest = { x: nest.x, y: nest.y }; save.current = e.id; save.eagles.push(e);
  return save;
}
export const current = (save) => save.eagles.find((e) => e.id === save.current);
// the eagle at home on that island (if any)
export const residentOf = (save, isl) => save.eagles.find((e) => e.home === isl) || null;
// a homeless eagle in a free nest: its home now
export function claim(save, e, nest) {
  if (e.home || residentOf(save, e.isl)) return false;
  e.home = e.isl; e.nest = { x: nest.x, y: nest.y }; e.brood = brood0(); return true;
}
// over the sea: the island it comes to (a homeless one: always one not seen yet; one at home: the next of those known)
export function onward(save, e) {
  if (!e.home) { const s = seedOf(save.islands.length); save.islands.push(s); return s; }
  return save.islands[(save.islands.indexOf(e.isl) + 1) % save.islands.length];
}
// a new day for it: what happened in its nest ('egg', 'hatch', 'grown', or nothing)
export function nextDay(e) {
  e.dayN++;
  if (!e.home) return null;
  const b = e.brood;
  if (b.stage === 'none') { if (++b.days >= EGG_AFTER) { b.stage = 'egg'; return 'egg'; } return null; }
  if (b.stage === 'egg') { b.stage = 'chick'; b.chick = { name: '', look: e.id * 7 + e.dayN, fed: 0, grown: 0, ready: false }; return 'hatch'; }
  const c = b.chick;
  if (c.ready) return null;
  if (c.fed >= FEEDS) c.grown++;
  c.fed = 0;
  if (c.grown >= GROW_DAYS) { c.ready = true; return 'grown'; }
  return null;
}
// is its chick hungry (so prey brought to the nest is fed to it)?
export const hungry = (e) => e.brood.stage === 'chick' && !e.brood.chick.ready && e.brood.chick.fed < FEEDS;
export function feed(e) { if (hungry(e)) e.brood.chick.fed++; }
// how grown a chick is (0 .. 1), each day fed a little more
export const growth = (c) => (c.ready ? 1 : Math.min(1, (c.grown + Math.min(c.fed, FEEDS) / FEEDS) / GROW_DAYS));
// the grown chick flies off: an eagle of its own (no home yet), in its parent's nest; the parent's nest empty again
export function fledge(save, e) {
  const c = e.brood.chick;
  const k = eagleRec(save, c.name || 'KÜKEN', e.home, e.nest.x - 7, e.nest.y, c.look); // (beside its parent)
  k.parent = e.id; k.dayN = e.dayN; k.day = e.day;
  save.eagles.push(k); e.brood = brood0();
  return k;
}
// what its nest holds, said
export function broodSay(e) {
  if (!e.home) return 'SUCHT EIN FREIES NEST';
  const b = e.brood;
  if (b.stage === 'none') return `EI IN ${EGG_AFTER - b.days} TAGEN`;
  if (b.stage === 'egg') return 'EIN EI IM NEST';
  const c = b.chick;
  return c.ready ? `${c.name || 'KÜKEN'} KANN AUSFLIEGEN` : `KÜKEN ${c.name}: TAG ${c.grown + 1}/${GROW_DAYS}, ${c.fed >= FEEDS ? 'HEUTE SATT' : 'HAT HUNGER'}`;
}

// a game kept from before islands had seeds of their own (gx, gy on a grid): the same islands, by their seeds
function migrate(s) {
  if (s.islands) return s;
  const seen = [];
  for (const e of s.eagles) {
    e.isl = islandSeed(e.gx, e.gy); if (e.home) e.home = islandSeed(e.home.gx, e.home.gy);
    if (!seen.includes(e.isl)) seen.push(e.isl);
  }
  s.islands = [seedOf(0), ...seen.filter((x) => x !== seedOf(0))];
  return s;
}
export function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return s?.eagles?.[0]?.name ? migrate(s) : null; } catch { return null; } }
export function store(save) { if (!save.eagles[0]?.name) return; try { // (not before the first eagle has its name)
   localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* (private mode: it only lasts the visit) */ } }
