// The bald eagle's pictures, in 16 directions and each pose: built of little lumps (ellipsoids) in 3D, turned, looked
// at from the front and above like the island, and laid down as pixels: lit from the top left (light, base, shade,
// dark tones of Lop Hop's palette), with an outline in each color's line tone, as pixels.js draws by hand.
import { HEX, tone, mix } from './pixels.js';
import { hash } from './world.js';

const KY = 0.75, KZ = 0.68, SIZE = 1.4; // (the view: a step back in y is KY pixels up the screen, a step up KZ)
const LIGHT = (() => { const l = [-0.45, -0.55, 1]; const n = Math.hypot(...l); return l.map((v) => v / n); })();
// a pose's lumps, in the eagle's own frame: x forwards, y to its right, z up; each [center, radii, color, roll (a wing's,
// round its shoulder)]
// each eagle a little different, by its number (0: the first, as it always was): its brown, its head's white, its size,
// its head's and beak's; a chick (grown: days fed) small and grey, a big head
export function lookOf(n, chick = null) {
  if (chick) return { key: `c${chick}`, body: HEX.lightGrey, wing: HEX.blueGrey, head: HEX.white, size: 0.75 + chick * 0.1, headR: 1.3, beak: 0.7 };
  if (!n) return { key: '0', body: HEX.darkBrown, wing: HEX.deepBrown, head: HEX.white, size: SIZE, headR: 1, beak: 1 };
  const h = (k) => hash(n, k, 61), other = [HEX.brown, HEX.deepBrown, HEX.rust, HEX.charcoal][Math.floor(h(1) * 4)];
  return { key: `${n}`, body: mix(HEX.darkBrown, other, 0.15 + h(2) * 0.45), wing: mix(HEX.deepBrown, other, h(3) * 0.45), head: mix(HEX.white, [HEX.cream, HEX.lightGrey, HEX.beige][Math.floor(h(4) * 3)], h(5) * 0.7),
    size: 1.28 + h(6) * 0.24, headR: 0.88 + h(7) * 0.3, beak: 0.8 + h(8) * 0.45 };
}
function lumps(pose, look) {
  const L = [], add = (c, r, col, roll = 0, side = 1) => L.push({ c, r, col, roll, side });
  const bob = pose.legs === 'walk0' || pose.legs === 'walk1' ? 0.5 : 0, z0 = pose.legs ? 0 : pose.swim ? -2.4 : pose.sleep ? -2.6 : 0;
  const hx = pose.sleep ? -1.6 : 0, hz = pose.sleep ? -1.8 : 0; // (asleep: its head sunk, drawn back into its shoulders)
  const body = (dx, dz) => [dx, 0, 6 + dz + z0 - bob];
  const hr = look.headR, bk = look.beak;
  add(body(0, 0), [5, 3, 3], look.body);
  add(body(5.2 + hx, 3 + hz), [2.5 * hr, 2.2 * hr, 2.3 * hr], look.head); // head
  add(body(5.2 + 2.4 * hr + (bk - 1) * 1.5 + hx, 2.5 + hz), [1.5 * bk, 0.8 * bk, 0.8 * bk], 'yellow'); // beak
  add(body(-6.2, -0.4), [2.8, 2.1, 0.8], look.head); // tail
  for (const s of [1, -1]) {
    if (!pose.sleep) L.push({ c: [5.2 + 1.2 * hr, s * 1.5 * hr, 6 + 3 + 0.4 * hr + z0 - bob], r: [0.5, 0.5, 0.5], col: 'black' }); // eye (shut, asleep)
    if (pose.stoop) { // (stooping: the wings drawn in tight along its back, swept up; the legs out, talons first)
      add([-2, s * 2.4, 7.6], [5.6, 1.2, 1.5], look.wing);
      add([-6.2, s * 1.6, 7.9], [2.6, 0.8, 0.8], look.wing);
      add([2.4, s * 1.4, 2.8], [1.4, 0.8, 1], look.body);
      add([4.4, s * 1.3, 1.9], [1.5, 0.6, 0.6], 'yellow');
      L.push({ c: [5.7, s * 1.3, 1.5], r: [0.5, 0.5, 0.5], col: 'black' });
      continue;
    }
    if (pose.wings === undefined) add([-0.6, s * 2.6, 6.6 + z0 - bob], [4.8, 1, 2.2], look.wing); // folded
    else add([-0.4, s * 7.2, 6.8], [3.2, 6.6, 0.7], look.wing, pose.wings, s); // spread
    if (pose.legs) {
      const f = pose.legs === 'walk0' ? s : pose.legs === 'walk1' ? -s : 0;
      add([0.5 + f * 1.2, s * 1.3, 1.6], [0.6, 0.6, 1.7], 'yellow');
    } else if (!pose.swim && !pose.sleep) add([-3, s * 1, 3.6], [1, 0.5, 0.5], 'yellow'); // (tucked up, flying)
  }
  return L;
}

// a picture of the pose, facing a (radians): { canvas, ox, oy (where its feet are, in it) }
function render(pose, a, look) {
  const ca = Math.cos(a), sa = Math.sin(a), pitch = pose.dive ? 1.1 : pose.stoop ? 0.45 : 0, cp = Math.cos(pitch), sp = Math.sin(pitch);
  const px = new Map(); // ("x,y" → [depth, color, base])
  for (const { c: c0, r: r0, col, roll = 0, side = 1 } of lumps(pose, look)) {
    const c = c0.map((v) => v * look.size), r = r0.map((v) => v * look.size);
    const base = col[0] === '#' ? col : HEX[col], cr = Math.cos(roll), sr = Math.sin(roll);
    for (let lx = -r[0]; lx <= r[0]; lx += 0.4) for (let ly = -r[1]; ly <= r[1]; ly += 0.4) for (let lz = -r[2]; lz <= r[2]; lz += 0.4) {
      const q = (lx / r[0]) ** 2 + (ly / r[1]) ** 2 + (lz / r[2]) ** 2;
      if (q > 1) continue;
      let n = [lx / r[0] ** 2, ly / r[1] ** 2, lz / r[2] ** 2], p = [c[0] + lx, c[1] + ly, c[2] + lz];
      if (roll) { // (a wing turned up or down round its shoulder, the tips the most)
        const sy = c[1] - side * r[1] * 0.9, y = p[1] - sy, z = p[2] - c[2];
        p = [p[0], sy + y * cr - side * z * sr, c[2] + side * y * sr + z * cr];
        n = [n[0], n[1] * cr - side * n[2] * sr, side * n[1] * sr + n[2] * cr];
      }
      if (pitch) { // (diving: nose down, round its middle)
        const x = p[0], z = p[2] - 6 * look.size; p = [x * cp + z * sp, p[1], 1 - x * sp + z * cp];
        n = [n[0] * cp + n[2] * sp, n[1], -n[0] * sp + n[2] * cp];
      }
      if ((pose.swim || pose.dive) && p[2] < 0) continue; // (under the water)
      const X = p[0] * ca - p[1] * sa, Y = p[0] * sa + p[1] * ca, Z = p[2];
      const nl = Math.hypot(...n) || 1, N = [(n[0] * ca - n[1] * sa) / nl, (n[0] * sa + n[1] * ca) / nl, n[2] / nl];
      const lit = N[0] * LIGHT[0] + N[1] * LIGHT[1] + N[2] * LIGHT[2], depth = Y * 0.66 + Z * 0.75;
      const k = `${Math.round(X)},${Math.round(Y * KY - Z * KZ)}`, was = px.get(k);
      if (was && was[0] >= depth) continue;
      const color = col === 'black' ? base : lit > 0.55 ? tone(base, 'light') : lit > 0 ? base : lit > -0.45 ? tone(base, 'shade') : tone(base, 'dark');
      px.set(k, [depth, color, base]);
    }
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const k of px.keys()) { const [x, y] = k.split(',').map(Number); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const w = x1 - x0 + 3, h = y1 - y0 + 3;
  const c = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const cx = c.getContext('2d');
  for (const [k, [, , base]] of px) { // the outline first: round each pixel, where nothing is
    const [x, y] = k.split(',').map(Number);
    cx.fillStyle = tone(base, 'line');
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!px.has(`${x + dx},${y + dy}`)) cx.fillRect(x + dx - x0 + 1, y + dy - y0 + 1, 1, 1);
  }
  for (const [k, [, color]] of px) { const [x, y] = k.split(',').map(Number); cx.fillStyle = color; cx.fillRect(x - x0 + 1, y - y0 + 1, 1, 1); }
  return { canvas: c, ox: -x0 + 1, oy: -y0 + 1 };
}

export const DIRS = 16;
const POSES = {
  stand: { legs: 'stand' }, sleep: { sleep: true }, walk0: { legs: 'walk0' }, walk1: { legs: 'walk1' }, swim: { swim: true }, dive: { dive: true }, stoop: { stoop: true },
  glide: { wings: 0.08 }, fly0: { wings: 0.6 }, fly1: { wings: 0.2 }, fly2: { wings: -0.35 }, fly3: { wings: 0.05 },
};
const made = new Map(), LOOK0 = lookOf(0);
// the picture for a pose, facing the nearest of the 16 directions to a
export function eagle(pose, a, look = LOOK0) {
  const d = ((Math.round(a / ((Math.PI * 2) / DIRS)) % DIRS) + DIRS) % DIRS, k = pose + d + '/' + look.key;
  if (!made.has(k)) made.set(k, render(POSES[pose], (d * Math.PI * 2) / DIRS, look));
  return made.get(k);
}
// which pose the bird is in
export function poseOf(b) {
  if (b.asleep) return 'sleep';
  if (b.state === 'swim') return 'swim';
  if (b.state === 'dive') return 'dive';
  if (b.state === 'air' && b.stooping) return 'stoop';
  if (b.state === 'air') return b.flapping && (b.climbing || b.flap % 2 < 1.4) ? `fly${Math.floor(b.flap * 8) % 4}` : 'glide';
  return b.v < 2 ? 'stand' : `walk${Math.floor(b.stride / 5) % 2}`;
}
// where its beak is, from its feet (for the fish it carries)
export const beak = (a) => [Math.cos(a) * 8 * SIZE, Math.sin(a) * 8 * SIZE * KY - 8.5 * SIZE * KZ];
