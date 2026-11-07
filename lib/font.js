// The game's pixel font: capitals 3 pixels wide (the M and the W 5) and 5 tall, in a cell of 7 rows: a row above and a
// row below a letter, for what reaches out of it (an umlaut's dots, the $'s line; accents, a tail below, when wanted).
// text(ctx, s, x, y) writes s with its letters' tops at y: the cell from y - 1 to y + 6.
//
// A letter: its rows, top to bottom, each a number whose bits are its pixels (written in base 32), 3 wide (4: the left
// column) or, where a row needs more, 5 wide (16: the left column, the M and the W). Five of them (the letter alone) or
// seven (the row above, the letter, the row below: Q's tail). It is as wide as the columns it uses (the I a line, the . a dot,
// the 1 two), a space 2, a pixel between letters.
export const GLYPHS = {
  A: '25755', B: '65656', C: '34443', D: '65556', E: '74647', F: '74644', G: '34553', H: '55755', I: '22222', J: '11152', K: '55655', L: '44447', M: 'hrlhh',
  N: '65555', O: '25552', P: '65644', Q: '0255522', R: '65655', S: '34216', T: '72222', U: '55557', V: '55552', W: 'hhlla', X: '55255', Y: '55222', Z: '71247',
  0: '75557', 1: '26222', 2: '61247', 3: '61216', 4: '55711', 5: '74616', 6: '34757', 7: '71222', 8: '75757', 9: '75716',
  Ä: '5257550', Ö: '5255520', Ü: '5055570', // (German: the dots in the row above, clear of the letter's top; the U a row shorter. ß is written SS)
  ' ': '00000', '.': '00002', ':': '02020', '!': '22202', '-': '00700', '/': '1122244', '+': '02720', '<': '12421', '>': '42124', '?': '61202', '(': '1222221', ')': '4222224', ',': '0000022', // (( ) and / the cell's height; the , a line down into the row below)
  '€': '68s86', '$': '2342162', '£': '32727', '¥': '52727', // (for prices, as the App Store writes them; the $ an S with its line through, above and below)
};
export const ABOVE = 1, BELOW = 1; // (the cell's rows beyond a letter's 5)

// a letter's rows as written (above) → its pixels: { rows (numbers, the cell's 7), full (3 or 5: the bits a row has),
// from (the first column it uses), w (how many) }; kept
const glyphs = new Map();
function glyphOf(gl) {
  let g = glyphs.get(gl);
  if (g) return g;
  const written = [...gl].map((c) => parseInt(c, 32)), rows = written.length === 5 ? [0, ...written, 0] : written;
  const full = rows.some((r) => r > 7) ? 5 : 3, all = rows.reduce((a, r) => a | r, 0), on = (c) => all & (1 << (full - 1 - c));
  let from = 0, to = full - 1;
  while (from < full && !on(from)) from++;
  while (to > from && !on(to)) to--;
  g = { rows, full, from: from < full ? from : 0, w: from < full ? to - from + 1 : 2 }; // (none: a space)
  glyphs.set(gl, g);
  return g;
}
const glyphFor = (ch, set) => glyphOf(set[ch] || GLYPHS[ch] || GLYPHS[' ']);

// how wide text is (in pixels of the font: times its size), a pixel between its letters
export function textWidth(s, set = GLYPHS) {
  s = String(s).toUpperCase();
  let w = -1;
  for (let i = 0; i < s.length; i++) w += glyphFor(s[i], set).w + 1;
  return Math.max(0, w);
}

// text at (x, y), its letters' top left; align 'center' or 'right' moves x
export function text(ctx, s, x, y, color, align = 'left', size = 1, set = GLYPHS) { // (size: each pixel of the font that many; set: some of its letters drawn otherwise)
  s = String(s).toUpperCase();
  if (align === 'center') x -= (textWidth(s, set) * size) / 2;
  if (align === 'right') x -= textWidth(s, set) * size;
  x = Math.round(x);
  ctx.fillStyle = color;
  ctx.beginPath(); // (every pixel of it in one path: one fill)
  for (let i = 0, at = 0; i < s.length; i++) {
    const g = glyphFor(s[i], set);
    for (let r = 0; r < 7; r++) for (let c = 0; c < g.w; c++) if (g.rows[r] & (1 << (g.full - 1 - g.from - c))) ctx.rect(x + (at + c) * size, y + (r - ABOVE) * size, size, size);
    at += g.w + 1;
  }
  ctx.fill();
}
