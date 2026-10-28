"use strict";

// Mask skins, drawn as SVG in the same flat, gold-trimmed style as the menu mask.
// To add a skin, add a line to MASKS below using any shape, colours, pattern and extras.

const { MASKS, maskArt } = (() => {
  const C = {
    wine: "#7a1729", deep: "#4a0c18", crimson: "#c8323e", cream: "#f0e0c0", ivory: "#faf3e3",
    gold: "#d4a865", black: "#2a1d22", plum: "#5b2a6e", midnight: "#26346a", teal: "#2f7470",
    emerald: "#2f6b45", rose: "#d07a8e", silver: "#bcc0c8", bronze: "#93602e", ember: "#d9732f", ash: "#6e6672",
  };
  const INK = "#1a0a0e";

  const EYES_STD = [[70, 88, 26, 14, 10], [170, 88, 26, 14, -10]];
  const EYES_FACE = [[90, 88, 20, 11, 8], [150, 88, 20, 11, -8]];
  const COLOMBINA =
    "M120 70 C100 50 40 40 14 60 C4 70 10 100 30 118 C50 136 90 134 108 116 C114 110 117 106 120 106 " +
    "C123 106 126 110 132 116 C150 134 190 136 210 118 C230 100 236 70 226 60 C200 40 140 50 120 70 Z";

  // eyes: [cx, cy, rx, ry, rotation]; jewelY/browY place the jewel and the "brow" band;
  // feather/tassel are anchor points (null when the shape has no room for them).
  const SHAPES = {
    colombina: { d: COLOMBINA, eyes: EYES_STD, jewelY: 66, browY: 84, feather: [190, 76], tassel: [212, 96] },
    cat: {
      d: "M120 72 C104 58 70 52 46 58 L22 24 L16 66 C4 82 12 104 30 118 C50 136 90 134 108 116 C114 110 117 106 120 106 " +
        "C123 106 126 110 132 116 C150 134 190 136 210 118 C228 104 236 82 224 66 L218 24 L194 58 C170 52 136 58 120 72 Z",
      eyes: [[72, 90, 25, 12, 16], [168, 90, 25, 12, -16]], jewelY: 72, browY: 86, feather: [192, 74], tassel: [212, 100],
    },
    winged: {
      d: "M120 72 C100 54 60 50 38 58 C22 42 10 30 0 20 C4 52 4 84 26 112 C46 136 92 136 108 116 C114 110 117 106 120 106 " +
        "C123 106 126 110 132 116 C148 136 194 136 214 112 C236 84 236 52 240 20 C230 30 218 42 202 58 C180 50 140 54 120 72 Z",
      eyes: EYES_STD, jewelY: 70, browY: 84, feather: null, tassel: [214, 104],
    },
    butterfly: {
      d: "M120 76 C108 50 76 30 40 32 C16 34 8 60 22 84 C10 100 20 130 50 132 C78 134 100 120 110 108 Q120 98 130 108 " +
        "C140 120 162 134 190 132 C220 130 230 100 218 84 C232 60 224 34 200 32 C164 30 132 50 120 76 Z",
      eyes: [[76, 84, 24, 13, 8], [164, 84, 24, 13, -8]], jewelY: 74, browY: 80, feather: null, tassel: null,
    },
    beak: {
      d: "M120 70 C100 50 40 40 14 60 C4 70 10 100 30 118 C50 134 86 132 104 118 L120 176 L136 118 " +
        "C154 132 190 134 210 118 C230 100 236 70 226 60 C200 40 140 50 120 70 Z",
      eyes: EYES_STD, jewelY: 66, browY: 84, feather: [190, 76], tassel: null, seam: true,
    },
    jester: { d: COLOMBINA, eyes: EYES_STD, jewelY: 66, browY: 84, feather: null, tassel: null, points: true },
    volto: {
      d: "M120 14 C66 14 40 52 40 96 C40 140 74 172 120 172 C166 172 200 140 200 96 C200 52 174 14 120 14 Z",
      eyes: EYES_FACE, jewelY: 44, browY: 76, feather: null, tassel: null, mouth: true,
    },
    bauta: {
      d: "M120 12 C70 12 44 46 44 92 L44 122 C44 140 66 150 82 162 L120 178 L158 162 C174 150 196 140 196 122 " +
        "L196 92 C196 46 170 12 120 12 Z",
      eyes: EYES_FACE, jewelY: 42, browY: 76, feather: null, tassel: null,
    },
    phantom: {
      d: "M116 14 C164 12 202 50 202 96 C202 140 170 170 128 172 C126 150 132 134 122 120 C112 108 118 94 112 80 " +
        "C106 60 122 40 116 14 Z",
      eyes: [[154, 88, 20, 11, -8]], jewelY: null, browY: 76, feather: null, tassel: null,
    },
  };

  const mask = (name, shape, base, accent, pattern, extras = {}) => ({ name, shape, base, accent, pattern, ...extras });

  const MASKS = [
    mask("The Velvet Rose", "colombina", C.wine, C.cream, "split", { jewel: true, feathers: [C.deep, C.wine, C.crimson], tassel: true, filigree: true }),
    mask("The Crimson Fox", "cat", C.crimson, C.cream, "brow", { jewel: true }),
    mask("The Onyx Cat", "cat", C.black, C.gold, "solid", { filigree: true, jewel: true, gem: C.emerald }),
    mask("The Amber Lynx", "cat", C.ember, C.cream, "split", { filigree: true }),
    mask("The Emerald Viper", "cat", C.emerald, C.black, "diagonal", { jewel: true, gem: C.gold }),
    mask("The Ivory Swan", "winged", C.ivory, C.gold, "solid", { filigree: true, jewel: true, gem: C.midnight }),
    mask("The Black Swan", "winged", C.black, C.wine, "brow", { jewel: true, tassel: true }),
    mask("The Midnight Owl", "winged", C.midnight, C.gold, "split", { filigree: true }),
    mask("The Sea Witch", "winged", C.teal, C.midnight, "diagonal", { jewel: true, gem: C.ivory, tassel: true }),
    mask("The Ember Stag", "winged", C.ember, C.wine, "brow", { filigree: true }),
    mask("The Butterfly Queen", "butterfly", C.plum, C.rose, "split", { jewel: true, gem: C.gold }),
    mask("The Monarch", "butterfly", C.ember, C.black, "brow", { filigree: true }),
    mask("The Silver Moth", "butterfly", C.silver, C.ash, "solid", { filigree: true, jewel: true, gem: C.plum }),
    mask("The Gilded Raven", "beak", C.black, C.gold, "brow", { filigree: true, feathers: [C.black, C.ash, C.black] }),
    mask("The Plague Doctor", "beak", C.ash, C.black, "solid", { filigree: true }),
    mask("The Night Heron", "beak", C.midnight, C.ivory, "split", { jewel: true, gem: C.crimson }),
    mask("The Scarlet Jester", "jester", C.crimson, C.black, "harlequin", { bells: true }),
    mask("The Merry Fool", "jester", C.plum, C.gold, "split", { bells: true, jewel: true, gem: C.emerald }),
    mask("The Harlequin", "colombina", C.crimson, C.black, "harlequin", { stick: true }),
    mask("The Rose Countess", "colombina", C.rose, C.cream, "brow", { stick: true, feathers: [C.rose, C.wine, C.cream] }),
    mask("The Blue Duchess", "colombina", C.midnight, C.gold, "solid", { filigree: true, jewel: true, stick: true }),
    mask("The Mourning Dove", "colombina", C.ash, C.ivory, "diagonal", { tassel: true, feathers: [C.ivory, C.ash, C.silver] }),
    mask("The Teal Siren", "colombina", C.teal, C.ivory, "split", { filigree: true, jewel: true, gem: C.gold }),
    mask("The Pale Duke", "volto", C.ivory, C.gold, "solid", { filigree: true, jewel: true }),
    mask("The Weeping Pierrot", "volto", C.ivory, C.midnight, "solid", { tear: true }),
    mask("The Silent Lady", "volto", C.cream, C.wine, "split", { jewel: true, gem: C.wine }),
    mask("The Golden Sun", "bauta", C.gold, C.crimson, "brow", { filigree: true, jewel: true }),
    mask("The Iron Baron", "bauta", C.silver, C.black, "diagonal", { filigree: true }),
    mask("The Bronze Knight", "bauta", C.bronze, C.gold, "solid", { filigree: true, jewel: true, gem: C.midnight }),
    mask("The Phantom", "phantom", C.ivory, C.gold, "solid", { filigree: true }),
    mask("The Crimson Phantom", "phantom", C.wine, C.black, "brow", { filigree: true }),
  ];

  let uid = 0;

  function maskArt(i, cls = "") {
    const m = MASKS[i] ?? MASKS[0];
    const s = SHAPES[m.shape];
    const id = "mk" + uid++;
    const gold = `url(#${id}g)`;
    const back = [];
    const inner = [];
    const front = [];

    // Behind the mask
    if (s.points) {
      const pts = [
        "M48 70 Q24 36 22 8 Q66 28 98 62 Z",
        "M100 64 Q110 30 120 2 Q130 30 140 64 Z",
        "M192 70 Q216 36 218 8 Q174 28 142 62 Z",
      ];
      pts.forEach((d, k) => {
        back.push(`<path d="${d}" fill="none" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/>
          <path d="${d}" fill="${k === 1 ? m.base : m.accent}" stroke="${gold}" stroke-width="3" stroke-linejoin="round"/>`);
      });
      if (m.bells) {
        for (const [x, y] of [[22, 8], [120, 2], [218, 8]]) {
          front.push(`<circle cx="${x}" cy="${y}" r="7" fill="${gold}" stroke="${INK}" stroke-width="2.5"/>
            <circle cx="${x - 2}" cy="${y - 2}" r="2" fill="#fff" opacity=".6"/>`);
        }
      }
    }
    if (m.stick) {
      back.push(`<path d="M196 122 L236 190" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
        <path d="M196 122 L236 190" stroke="${gold}" stroke-width="6" stroke-linecap="round"/>`);
    }
    if (m.feathers && s.feather) {
      const [ax, ay] = s.feather;
      const rots = [-30, -6, 18];
      m.feathers.forEach((color, k) => {
        back.push(`<g transform="translate(${ax} ${ay}) rotate(${rots[k % 3]})">
          <path d="M0 0 C-14 -26 -6 -58 22 -80 C40 -56 36 -22 0 0 Z" fill="${color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
          <path d="M2 -6 C6 -30 12 -52 20 -72" fill="none" stroke="${gold}" stroke-width="1.8" opacity=".85"/></g>`);
      });
    }

    // Painted surface (clipped to the mask)
    if (m.pattern === "split") inner.push(`<rect x="-10" y="-10" width="130" height="200" fill="${m.accent}"/>`);
    if (m.pattern === "diagonal") inner.push(`<polygon points="-10,-10 150,-10 90,190 -10,190" fill="${m.accent}"/>`);
    if (m.pattern === "brow") inner.push(`<rect x="-10" y="-10" width="260" height="${s.browY + 10}" fill="${m.accent}"/>`);
    if (m.pattern === "harlequin") inner.push(`<rect x="-10" y="-10" width="260" height="200" fill="url(#${id}p)"/>`);
    inner.push(`<rect x="-10" y="-10" width="260" height="200" fill="url(#${id}s)"/>`);
    inner.push(`<ellipse cx="62" cy="68" rx="24" ry="7" transform="rotate(-18 62 68)" fill="#fff" opacity=".14"/>`);
    if (m.filigree) {
      inner.push(`<g fill="none" stroke="${gold}" stroke-width="1.8" stroke-linecap="round" opacity=".85">
        <path d="M28 98 C42 92 58 104 60 116 C62 126 52 128 50 120"/>
        <path d="M212 98 C198 92 182 104 180 116 C178 126 188 128 190 120"/>
        <path d="M104 64 C94 56 80 58 76 66"/><path d="M136 64 C146 56 160 58 164 66"/>
        <path d="M120 112 C114 124 126 134 120 150"/></g>`);
    }
    if (s.seam) inner.push(`<path d="M120 112 L120 172" stroke="${INK}" stroke-opacity=".35" stroke-width="2.5"/>`);
    if (s.mouth) {
      inner.push(`<path d="M120 98 C116 112 116 120 124 124" fill="none" stroke="${INK}" stroke-opacity=".25" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M104 146 Q120 154 136 146" fill="none" stroke="${INK}" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/>`);
    }

    // In front of the mask
    const eyes = s.eyes
      .map(([cx, cy, rx, ry, r]) =>
        `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${r} ${cx} ${cy})" fill="#120709" stroke="${gold}" stroke-width="3"/>`)
      .join("");
    if (m.jewel && s.jewelY) {
      const y = s.jewelY;
      const d = `M120 ${y - 16} L132 ${y} L120 ${y + 16} L108 ${y} Z`;
      front.push(`<path d="${d}" fill="none" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
        <path d="${d}" fill="${m.gem ?? C.crimson}" stroke="${gold}" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M120 ${y - 10} L125 ${y} L120 ${y - 2} Z" fill="#fff" opacity=".5"/>`);
    }
    if (m.tear) {
      const [cx, cy, , ry] = s.eyes[0];
      const y = cy + ry + 12;
      front.push(`<path d="M${cx} ${y - 8} C${cx + 8} ${y + 4} ${cx + 6} ${y + 14} ${cx} ${y + 14} C${cx - 6} ${y + 14} ${cx - 8} ${y + 4} ${cx} ${y - 8} Z"
        fill="${m.accent}" stroke="${gold}" stroke-width="1.5"/>`);
    }
    if (m.tassel && s.tassel) {
      const [x, y] = s.tassel;
      front.push(`<path d="M${x} ${y} L${x + 4} ${y + 30}" stroke="${gold}" stroke-width="2.5"/>
        <path d="M${x - 2} ${y + 30} h12 l-2 24 h-8 Z" fill="${gold}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
        <circle cx="${x + 4}" cy="${y + 30}" r="4" fill="${gold}" stroke="${INK}" stroke-width="1.5"/>`);
    }

    return `<svg class="${cls}" viewBox="-10 -10 260 200" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f8dca0"/><stop offset="1" stop-color="#a87a3c"/>
        </linearGradient>
        <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/>
          <stop offset="1" stop-color="#000" stop-opacity=".28"/>
        </linearGradient>
        <clipPath id="${id}c"><path d="${s.d}"/></clipPath>
        ${m.pattern === "harlequin"
          ? `<pattern id="${id}p" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(45 120 90)">
               <rect width="18" height="18" fill="${m.accent}"/><rect x="18" y="18" width="18" height="18" fill="${m.accent}"/></pattern>`
          : ""}
      </defs>
      ${back.join("")}
      <path d="${s.d}" fill="none" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>
      <path d="${s.d}" fill="${m.base}"/>
      <g clip-path="url(#${id}c)">${inner.join("")}</g>
      ${eyes}
      <path d="${s.d}" fill="none" stroke="${gold}" stroke-width="4.5" stroke-linejoin="round"/>
      ${front.join("")}
    </svg>`;
  }

  return { MASKS, maskArt };
})();
