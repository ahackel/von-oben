// The eagles, a family of them, without a screen: each its name, its looks (a number: see eagle.js), the island it is on
// (gx, gy: see world.js islandSeed), its home there (the nest of an island no other eagle has), where it was and how
// it was (bird), its own days. At home five days, it lays an egg; the next day a chick hatches; fed two prey a day
// for three days, it is grown and can fly off (and be played: over the sea to find a free nest of its own); its
// parent lays again five days on. Kept in the browser (localStorage).
import { PERCH } from './world.js';

export const EGG_AFTER = 5, GROW_DAYS = 3, FEEDS = 2; // (days at home till the egg; days fed till grown; prey a day)
const KEY = 'vonOben.v1';

export const brood0 = () => ({ stage: 'none', days: 0, chick: null });
function eagleRec(save, name, gx, gy, x, y, look) {
  return { id: save.next++, name, look, gx, gy, home: null, room: null, dayN: 1, day: 0.08, gems: 0, brood: brood0(), bird: { x, y, z: PERCH, a: Math.PI / 2, state: 'ground', energy: 100, caught: 0, prey: null } };
}
// a new game: the first eagle, at home in the first island's nest
export function newGame(name, nest) {
  const save = { eagles: [], current: 0, next: 1, gems: {} };
  const e = eagleRec(save, name, 0, 0, nest.x, nest.y, 0);
  e.home = { gx: 0, gy: 0 }; e.nest = { x: nest.x, y: nest.y }; save.current = e.id; save.eagles.push(e);
  return save;
}
export const current = (save) => save.eagles.find((e) => e.id === save.current);
// the eagle at home on that island (if any)
export const residentOf = (save, gx, gy) => save.eagles.find((e) => e.home && e.home.gx === gx && e.home.gy === gy) || null;
// a homeless eagle in a free nest: its home now
export function claim(save, e, nest) {
  if (e.home || residentOf(save, e.gx, e.gy)) return false;
  e.home = { gx: e.gx, gy: e.gy }; e.nest = { x: nest.x, y: nest.y }; e.brood = brood0(); return true;
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
// the grown chick flies off: an eagle of its own (no home yet), in its parent's nest; the parent's nest empty again
export function fledge(save, e) {
  const c = e.brood.chick;
  const k = eagleRec(save, c.name || 'KÜKEN', e.home.gx, e.home.gy, e.nest.x - 7, e.nest.y, c.look); // (beside its parent)
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
  return c.ready ? `${c.name || 'KÜKEN'} KANN AUSFLIEGEN` : `KÜKEN ${c.name}: TAG ${c.grown + 1}/${GROW_DAYS}, ${c.fed}/${FEEDS} GEFÜTTERT`;
}

export function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return s?.eagles?.[0]?.name ? s : null; } catch { return null; } }
export function store(save) { if (!save.eagles[0]?.name) return; try { // (not before the first eagle has its name)
   localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* (private mode: it only lasts the visit) */ } }
