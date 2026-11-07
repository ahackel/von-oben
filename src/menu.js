// What is typed and chosen, over the game (in HTML: the iPad's keyboard comes up for a name): asking a name (with a
// picture), and the menu, a list of all the eagles (and their chicks) to change to.
const ui = document.getElementById('ui');
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
export const open = () => ui.childElementCount > 0;
const close = () => { ui.replaceChildren(); ui.style.display = 'none'; };
function panel() { close(); ui.style.display = 'flex'; const p = el('div', 'panel'); ui.append(p); return p; }

// asking a name: a title, a picture, a field; the name, once given (not empty)
export function ask(title, picture, hint = '') {
  return new Promise((done) => {
    const p = panel();
    p.append(el('h1', '', title));
    if (picture) p.append(picture);
    if (hint) p.append(el('p', '', hint));
    const f = el('input'); f.maxLength = 14; f.autocapitalize = 'characters'; f.autocomplete = 'off'; f.spellcheck = false; f.placeholder = 'NAME';
    const ok = el('button', '', 'LOS');
    const go = () => { const n = f.value.trim().toUpperCase(); if (n) { close(); done(n); } else f.focus(); };
    ok.onclick = go; f.onkeydown = (e) => { if (e.key === 'Enter') go(); };
    p.append(f, ok); setTimeout(() => f.focus(), 50);
  });
}
// the menu: each row { picture, name, lines, action: [label, fn] | null, now: is it the one played }
export function menu(rows, title = 'DEINE ADLER') {
  const p = panel();
  p.append(el('h1', '', title));
  const list = el('div', 'list');
  for (const r of rows) {
    const row = el('div', r.now ? 'row now' : r.sub ? 'row sub' : 'row');
    row.append(r.picture);
    const t = el('div', 'txt'); t.append(el('b', '', r.name)); for (const l of r.lines) t.append(el('span', '', l));
    row.append(t);
    if (r.action) { const b = el('button', '', r.action[0]); b.onclick = () => { close(); r.action[1](); }; row.append(b); }
    list.append(row);
  }
  const back = el('button', 'back', 'WEITER'); back.onclick = close;
  p.append(list, back);
}
