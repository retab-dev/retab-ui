export const getUncertaintyColor = (
  uncertainty: number | undefined,
): string => {
  if (!uncertainty) return "#fefaf6";
  // Use uncertainty directly as it is between 0 and 1
  const coeff = Math.min(1, Math.max(0, uncertainty));

  const interpolate = (
    c1: [number, number, number],
    c2: [number, number, number],
    t: number,
  ) => {
    return c1.map((_, i) => Math.floor(c1[i] * (1 - t) + c2[i] * t)) as [
      number,
      number,
      number,
    ];
  };

  const interpolateGradient = (
    ics: { color: [number, number, number]; pos: number }[],
    t: number,
  ) => {
    const cs = [...ics].sort((a, b) => a.pos - b.pos);
    const i = cs.findIndex((c) => c.pos > t);
    if (i === 0) return cs[0].color;
    if (i === -1) return cs[cs.length - 1].color;
    return interpolate(
      cs[i - 1].color,
      cs[i].color,
      (t - cs[i - 1].pos) / (cs[i].pos - cs[i - 1].pos),
    );
  };

  const h2c = (h: string): [number, number, number] => {
    return [
      parseInt(h.slice(1, 3), 16),
      parseInt(h.slice(3, 5), 16),
      parseInt(h.slice(5, 7), 16),
    ];
  };

  const color = interpolateGradient(
    [
      { color: h2c("#FEE2E2"), pos: 0 },
      { color: h2c("#FEF3C7"), pos: 0.5 },
      { color: h2c("#DCFCE7"), pos: 1 },
    ],
    coeff,
  );
  /*
    const color = interpolateGradient([
        { color: h2c("#FEF2F2"), pos: 0 },
        { color: h2c("#FFFBEB"), pos: 0.5 },
        { color: h2c("#F0FDF4"), pos: 1 },
    ], coeff);*/

  return "#" + color.map((c) => c.toString(16).padStart(2, "0")).join("");
};

/* colormap.ts
 * ------------------------------------------------------------------
 * Minimal linear-segmented colormap utilities for TypeScript.
 * Now provides:  bone, pink, coolwarm, summer, wistia.
 * ------------------------------------------------------------------
 */

export type ColormapName =
  | "retab_rdylbu"
  | "retab_rdylgn"
  | "bone"
  | "pink"
  | "coolwarm"
  | "summer"
  | "jet"
  | "wistia"
  | "RdYlBu"
  | "RdBu"
  | "RdGn"
  | "RdYlGn"
  | "Reds"
  | "hot"
  | "afmhot"
  | "gist_heat"
  | "YlOrRd"
  | "retab_YlOrRd"
  | "OrRd";

type RGB = [number, number, number];

interface Stop {
  pos: number; // ∈ [0,1]
  color: RGB; // 0-255 per channel
}

/* ---- Palette definitions ----
 * Bone & Pink: same six-stop data from the first snippet.
 * Coolwarm:   sampled from Matplotlib 3.8.2 (blue-grey-red).
 * Summer:     analytic R(t)=t, G(t)=0.5+0.5t, B=0.4  → 5 stops.
 * Wistia:     yellow–gold ramp (approximated) → 5 stops.
 */
/*Recovered original colour: (250, 110, 110)
Forward blend again: (254, 226, 226)
    (base) sachaichbiah @MacBook-Pro - de - Sacha - 5 CUBE_local % python3 colorscript.py
Recovered original colour: (250, 195, 0)
Forward blend again: (254, 243, 204)
    (base) sachaichbiah @MacBook-Pro - de - Sacha - 5 CUBE_local % python3 colorscript.py
Recovered original colour: (80, 100, 240)
Forward blend again: (220, 224, 252)*/
const PALETTES: Record<ColormapName, Stop[]> = {
  /*retab_rdylbu: [
        { pos: 0.0, color: [254, 226, 226] },   // #FEE2E2
        { pos: 0.5, color: [254, 243, 199] },   // #FEF3C7
        { pos: 1.0, color: [220, 224, 252] }    // #DCE0FC
    ],
    retab_rdylgn: [
        { pos: 0.0, color: [254, 226, 226] },   // #FEE2E2
        { pos: 0.5, color: [254, 243, 199] },   // #FEF3C7
        { pos: 1.0, color: [220, 252, 231] }    // #DCFCE7
    ],*/
  retab_rdylbu: [
    { pos: 0.0, color: [250, 110, 110] },
    { pos: 0.5, color: [250, 195, 0] },
    { pos: 1.0, color: [80, 100, 240] },
  ],
  retab_rdylgn: [
    { pos: 0.0, color: [250, 110, 110] },
    { pos: 0.5, color: [250, 195, 0] },
    { pos: 1.0, color: [80, 240, 135] },
  ],
  Reds: [
    { pos: 0.0, color: [255, 245, 240] },
    { pos: 0.1, color: [254, 229, 216] },
    { pos: 0.2, color: [253, 202, 181] },
    { pos: 0.3, color: [252, 171, 143] },
    { pos: 0.4, color: [252, 138, 106] },
    { pos: 0.5, color: [251, 105, 74] },
    { pos: 0.6, color: [241, 68, 50] },
    { pos: 0.7, color: [217, 37, 35] },
    { pos: 0.8, color: [188, 20, 26] },
    { pos: 0.9, color: [152, 12, 19] },
    { pos: 1.0, color: [103, 0, 13] },
  ],
  hot: [
    { pos: 0.0, color: [11, 0, 0] },
    { pos: 0.1, color: [76, 0, 0] },
    { pos: 0.2, color: [144, 0, 0] },
    { pos: 0.3, color: [210, 0, 0] },
    { pos: 0.4, color: [255, 23, 0] },
    { pos: 0.5, color: [255, 92, 0] },
    { pos: 0.6, color: [255, 157, 0] },
    { pos: 0.7, color: [255, 225, 0] },
    { pos: 0.8, color: [255, 255, 54] },
    { pos: 0.9, color: [255, 255, 157] },
    { pos: 1.0, color: [255, 255, 255] },
  ],
  afmhot: [
    { pos: 0.0, color: [0, 0, 0] },
    { pos: 0.1, color: [50, 0, 0] },
    { pos: 0.2, color: [102, 0, 0] },
    { pos: 0.3, color: [152, 24, 0] },
    { pos: 0.4, color: [204, 77, 0] },
    { pos: 0.5, color: [255, 128, 1] },
    { pos: 0.6, color: [255, 178, 51] },
    { pos: 0.7, color: [255, 230, 103] },
    { pos: 0.8, color: [255, 255, 153] },
    { pos: 0.9, color: [255, 255, 205] },
    { pos: 1.0, color: [255, 255, 255] },
  ],
  gist_heat: [
    { pos: 0.0, color: [0, 0, 0] },
    { pos: 0.1, color: [38, 0, 0] },
    { pos: 0.2, color: [77, 0, 0] },
    { pos: 0.3, color: [114, 0, 0] },
    { pos: 0.4, color: [153, 0, 0] },
    { pos: 0.5, color: [192, 1, 0] },
    { pos: 0.6, color: [229, 51, 0] },
    { pos: 0.7, color: [255, 103, 0] },
    { pos: 0.8, color: [255, 153, 51] },
    { pos: 0.9, color: [255, 205, 155] },
    { pos: 1.0, color: [255, 255, 255] },
  ],
  YlOrRd: [
    { pos: 0.0, color: [255, 255, 204] },
    { pos: 0.1, color: [255, 241, 169] },
    { pos: 0.2, color: [254, 225, 135] },
    { pos: 0.3, color: [254, 202, 102] },
    { pos: 0.4, color: [254, 171, 73] },
    { pos: 0.5, color: [253, 140, 60] },
    { pos: 0.6, color: [252, 91, 46] },
    { pos: 0.7, color: [237, 46, 33] },
    { pos: 0.8, color: [212, 16, 32] },
    { pos: 0.9, color: [176, 0, 38] },
    { pos: 1.0, color: [128, 0, 38] },
  ],
  retab_YlOrRd: [
    { pos: 0.0, color: [255, 255, 255] },
    { pos: 0.1, color: [255, 241, 169] },
    { pos: 0.2, color: [254, 225, 135] },
    { pos: 0.3, color: [254, 202, 102] },
    { pos: 0.4, color: [254, 171, 73] },
    { pos: 0.5, color: [253, 140, 60] },
    { pos: 0.6, color: [252, 91, 46] },
    { pos: 0.7, color: [237, 46, 33] },
    { pos: 0.8, color: [212, 16, 32] },
    { pos: 0.9, color: [176, 0, 38] },
    { pos: 1.0, color: [128, 0, 38] },
  ],
  OrRd: [
    { pos: 0.0, color: [255, 247, 236] },
    { pos: 0.1, color: [254, 235, 208] },
    { pos: 0.2, color: [253, 220, 175] },
    { pos: 0.3, color: [253, 202, 148] },
    { pos: 0.4, color: [253, 178, 123] },
    { pos: 0.5, color: [252, 140, 89] },
    { pos: 0.6, color: [242, 109, 75] },
    { pos: 0.7, color: [224, 68, 47] },
    { pos: 0.8, color: [201, 29, 19] },
    { pos: 0.9, color: [168, 0, 0] },
    { pos: 1.0, color: [127, 0, 0] },
  ],
  bone: [
    { pos: 0.0, color: [0, 0, 0] },
    { pos: 0.1, color: [22, 22, 30] },
    { pos: 0.2, color: [45, 45, 62] },
    { pos: 0.3, color: [66, 66, 93] },
    { pos: 0.4, color: [89, 92, 121] },
    { pos: 0.5, color: [112, 123, 144] },
    { pos: 0.6, color: [134, 154, 166] },
    { pos: 0.7, color: [157, 185, 188] },
    { pos: 0.8, color: [185, 210, 210] },
    { pos: 0.9, color: [221, 233, 233] },
    { pos: 1.0, color: [255, 255, 255] },
  ],

  RdBu: [
    { pos: 0.0, color: [165, 0, 38] }, // deep red
    { pos: 0.2, color: [215, 48, 39] }, // red
    { pos: 0.4, color: [244, 109, 67] }, // orange-red
    { pos: 0.5, color: [253, 174, 97] }, // orange
    { pos: 0.6, color: [254, 224, 144] }, // yellow
    { pos: 0.8, color: [171, 217, 233] }, // light blue
    { pos: 1.0, color: [49, 54, 149] }, // deep blue
  ],

  RdGn: [
    { pos: 0.0, color: [165, 0, 38] }, // deep red
    { pos: 0.2, color: [215, 48, 39] }, // red
    { pos: 0.4, color: [244, 109, 67] }, // orange-red
    { pos: 0.5, color: [253, 174, 97] }, // orange
    { pos: 0.6, color: [254, 224, 144] }, // yellow
    { pos: 0.8, color: [166, 217, 106] }, // light green
    { pos: 1.0, color: [26, 152, 80] }, // deep green
  ],

  jet: [
    { pos: 0.0, color: [0, 0, 128] },
    { pos: 0.1, color: [0, 0, 241] },
    { pos: 0.2, color: [0, 76, 255] },
    { pos: 0.3, color: [0, 176, 255] },
    { pos: 0.4, color: [41, 255, 206] },
    { pos: 0.5, color: [125, 255, 122] },
    { pos: 0.6, color: [206, 255, 41] },
    { pos: 0.7, color: [255, 196, 0] },
    { pos: 0.8, color: [255, 104, 0] },
    { pos: 0.9, color: [241, 8, 0] },
    { pos: 1.0, color: [128, 0, 0] },
  ],

  pink: [
    { pos: 0.0, color: [30, 0, 0] },
    { pos: 0.1, color: [104, 65, 65] },
    { pos: 0.2, color: [145, 93, 93] },
    { pos: 0.3, color: [175, 114, 114] },
    { pos: 0.4, color: [198, 139, 132] },
    { pos: 0.5, color: [208, 172, 148] },
    { pos: 0.6, color: [218, 198, 161] },
    { pos: 0.7, color: [228, 223, 174] },
    { pos: 0.8, color: [237, 237, 198] },
    { pos: 0.9, color: [247, 247, 229] },
    { pos: 1.0, color: [255, 255, 255] },
  ],

  coolwarm: [
    { pos: 0.0, color: [59, 76, 192] }, // deep blue
    { pos: 0.25, color: [141, 176, 254] },
    { pos: 0.5, color: [221, 220, 220] }, // neutral grey
    { pos: 0.75, color: [244, 152, 122] },
    { pos: 1.0, color: [180, 4, 38] }, // deep red
  ],

  summer: [
    { pos: 0.0, color: [0, 128, 102] }, // t=0   → (0,0.5,0.4)
    { pos: 0.25, color: [64, 159, 102] },
    { pos: 0.5, color: [128, 191, 102] },
    { pos: 0.75, color: [191, 223, 102] },
    { pos: 1.0, color: [255, 255, 102] }, // t=1   → (1,1,0.4)
  ],

  wistia: [
    { pos: 0.0, color: [0, 0, 0] },
    { pos: 0.25, color: [128, 92, 28] },
    { pos: 0.5, color: [255, 192, 64] },
    { pos: 0.75, color: [255, 224, 128] },
    { pos: 1.0, color: [255, 255, 191] },
  ],

  RdYlBu: [
    { pos: 0.0, color: [165, 0, 38] }, // deep red
    { pos: 0.2, color: [215, 48, 39] }, // red
    { pos: 0.4, color: [244, 109, 67] }, // orange-red
    { pos: 0.5, color: [253, 174, 97] }, // orange
    { pos: 0.6, color: [254, 224, 144] }, // yellow
    { pos: 0.8, color: [171, 217, 233] }, // light blue
    { pos: 1.0, color: [49, 54, 149] }, // deep blue
  ],

  RdYlGn: [
    { pos: 0.0, color: [165, 0, 38] }, // deep red
    { pos: 0.2, color: [215, 48, 39] }, // red
    { pos: 0.4, color: [244, 109, 67] }, // orange-red
    { pos: 0.5, color: [253, 174, 97] }, // orange
    { pos: 0.6, color: [254, 224, 139] }, // yellow
    { pos: 0.8, color: [166, 217, 106] }, // light green
    { pos: 1.0, color: [26, 152, 80] }, // deep green
  ],
};

/* ---- helpers & getColor (unchanged) ---- */
const clamp = (x: number, lo = 0, hi = 1) => Math.min(Math.max(x, lo), hi);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRGB = (c1: RGB, c2: RGB, t: number): RGB => [
  Math.round(lerp(c1[0], c2[0], t)),
  Math.round(lerp(c1[1], c2[1], t)),
  Math.round(lerp(c1[2], c2[2], t)),
];
const toHex = ([r, g, b]: RGB) =>
  "#" +
  [r, g, b]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

export function getColor(
  map: ColormapName,
  value: number,
  reverse: boolean = false,
  opacity?: number,
): string {
  const stops = PALETTES[map];
  let t = clamp(value);

  // Invert the value if reverse is true
  if (reverse) {
    t = 1 - t;
  }

  let resultColor: RGB;

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i],
      b = stops[i + 1];
    if (t >= a.pos && t <= b.pos) {
      const tt = (t - a.pos) / (b.pos - a.pos);
      resultColor = lerpRGB(a.color, b.color, tt);
      break;
    }
  }

  // Fallback if no matching stop found
  if (!resultColor!) {
    resultColor = stops[stops.length - 1].color;
  }

  // Apply opacity blending with white if opacity parameter is provided
  if (opacity !== undefined) {
    const clampedOpacity = Math.min(Math.max(opacity, 0), 1); // Clamp between 0 and 1
    const white: RGB = [255, 255, 255];
    resultColor = [
      Math.round(
        resultColor[0] * clampedOpacity + white[0] * (1 - clampedOpacity),
      ),
      Math.round(
        resultColor[1] * clampedOpacity + white[1] * (1 - clampedOpacity),
      ),
      Math.round(
        resultColor[2] * clampedOpacity + white[2] * (1 - clampedOpacity),
      ),
    ] as RGB;
  }

  return toHex(resultColor);
}

// Precomputed decile lookup tables for fast color retrieval
const FAST_CACHE: Record<string, RGB[]> = {};

// Fast color lookup using 11 steps (0.0 to 1.0 inclusive); picks the lowest decile (floor) after clamping
export function getColorFast(
  map: ColormapName,
  value: number,
  reverse: boolean = false,
  opacity?: number,
): string {
  const key = `${map}|${reverse ? "1" : "0"}`;

  let table = FAST_CACHE[key];
  if (!table) {
    const stops = PALETTES[map];
    table = new Array<RGB>(11);

    for (let i = 0; i <= 10; i++) {
      const baseT = i / 10; // 0.0, 0.1, ..., 1.0
      let t = Math.round(baseT * 10) / 10;

      if (reverse) t = 1 - t;

      // Interpolate within stops
      let color: RGB = stops[stops.length - 1].color;
      for (let j = 0; j < stops.length - 1; j++) {
        const a = stops[j],
          b = stops[j + 1];
        if (t >= a.pos && t <= b.pos) {
          const tt = (t - a.pos) / (b.pos - a.pos);
          color = lerpRGB(a.color, b.color, tt);
          break;
        }
      }

      table[i] = color;
    }

    FAST_CACHE[key] = table;
  }

  const t = clamp(value);
  const idx = Math.max(0, Math.min(10, Math.floor(t * 10))); // allow 1.0 → index 10

  let rgb = table[idx];
  if (opacity !== undefined) {
    const clampedOpacity = Math.min(Math.max(opacity, 0), 1);
    const white: RGB = [255, 255, 255];
    rgb = [
      Math.round(rgb[0] * clampedOpacity + white[0] * (1 - clampedOpacity)),
      Math.round(rgb[1] * clampedOpacity + white[1] * (1 - clampedOpacity)),
      Math.round(rgb[2] * clampedOpacity + white[2] * (1 - clampedOpacity)),
    ] as RGB;
  }

  return toHex(rgb);
}

export const DISTANCES_COLORMAP: ColormapName = "retab_rdylgn";
export const CONSENSUS_COLORMAP: ColormapName = "retab_YlOrRd";
export const MISMATCH_COLORMAP: ColormapName = "wistia"; // Yellow/amber scale for mismatches
export const CONSENSUS_INVERSE: boolean = true;
export const DISTANCES_INVERSE: boolean = false;
export const MISMATCH_INVERSE: boolean = false; // 0 = transparent, 1 = amber
export const CONSENSUS_COLORMAP_OPACITY: number = 0.2;
export const DISTANCES_COLORMAP_OPACITY: number = 0.2;

/**
 * Get mismatch color - returns amber for 0 (mismatch), transparent for 1 (not mismatch).
 * Uses the same scale direction as similarity (0 = bad, 1 = good).
 */
export function getMismatchColor(value: number | undefined): string {
  if (value === undefined || value === 1) return "transparent";
  // For value 0 (mismatch), use amber color at 40% opacity blended with white
  // Amber: #F59E0B
  const amber: [number, number, number] = [245, 158, 11];
  const opacity = 0.4;
  const white: [number, number, number] = [255, 255, 255];
  const blended: [number, number, number] = [
    Math.round(amber[0] * opacity + white[0] * (1 - opacity)),
    Math.round(amber[1] * opacity + white[1] * (1 - opacity)),
    Math.round(amber[2] * opacity + white[2] * (1 - opacity)),
  ];
  return (
    "#" +
    blended
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}
