# Von Oben

Ein Weißkopfseeadler über einer Insel. Er ist immer in der Bildmitte, die Insel zieht unter ihm vorbei (sie dreht sich nie, der Adler dreht sich).

- **Linker Stick** (links/rechts): drehen
- **Rechter Stick** (hoch): stehen → gehen → rennen → abheben und fliegen. Loslassen: langsamer werden, hinuntergleiten, landen.
- **Im Meer** den rechten Stick nach unten: tauchen, mit Glück einen Fisch fangen.
- Fliegen kostet Energie. Mäuse, Käfer und Würmer am Boden auffressen (drüberlaufen), Fische füllen viel auf.
- Am Boden ist die Kamera nah dran, in der Luft zoomt sie heraus.

Am Rechner: Pfeiltasten (↑ halten = schneller, ↓ = tauchen).

```
npm run dev    # http://localhost:8325
npm test
```

Ohne Build-Schritt, reines HTML5/JS. Palette und Pixel-Font aus Lop Hop (`lib/`), Pixelart-Technik und Bäume aus Animal Hospital (`src/pixels.js`, `src/art/garden.js`), kopiert, nicht geteilt. Der Adler wird aus 3D-Klümpchen in 16 Richtungen zu Pixeln gerechnet (`src/eagle.js`).
