// ───────────────────────── helpers & tuning ─────────────────────────
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeInOut = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
const dampAngle = (a, b, k, dt) => a + angDiff(a, b) * (1 - Math.exp(-k * dt));

function makeRng(seed) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    f,
    range: (lo, hi) => lo + (hi - lo) * f(),
    int: (lo, hi) => lo + Math.floor(f() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(f() * arr.length)],
    chance: (p) => f() < p,
    weighted(list) {
      let tot = 0;
      for (const it of list) tot += it[0];
      let r = f() * tot;
      for (const it of list) { r -= it[0]; if (r <= 0) return it[1]; }
      return list[list.length - 1][1];
    },
  };
}

// Track geometry (metres). The path is three lanes wide.
const LANE_W = 1.9;          // distance between lane centres
const FLOOR_HALF = 2.85;     // half width of the walkable floor
const CURB_W = 0.35;
const HJ = 3.2;              // half size of a junction square
const ROW = 2.4;             // length of one row of floor slabs
const WATER_Y = -6.5;

// Movement
const GRAVITY = 34;
const JUMP_V = 11.4;
const AIR_T = (2 * JUMP_V) / GRAVITY;            // ~0.67 s in the air
const JUMP_H = (JUMP_V * JUMP_V) / (2 * GRAVITY); // ~1.9 m
const SLIDE_T = 0.72;
const DECK_H = 2.2;          // how high a raised walkway stands: out of reach of a plain jump, within reach of springs or a bounce pad
const RAMP_LEN = 5.5;        // length of the steps up to one
const STEP_UP = 0.45;        // the most he can step or scramble up without help
const PAD_V = 15.4;          // launch speed off a bounce pad (about 3.5 m up)
const PAD_AIR = (2 * PAD_V) / GRAVITY;
const SPEED_MIN = 11, SPEED_MAX = 29;

// Levels. A level is a few stretches of track, and you move up one at a corner. Each level is faster and more
// tightly packed than the one before by a fixed ratio, so the difficulty compounds instead of creeping up.
const LEVEL_STRETCHES = 4;
const SPEED_GROW = 1.1;       // +10 % running speed per level, up to SPEED_MAX
const GAP_SHRINK = 0.93;      // -7 % clear running between obstacles per level …
const GAP_MIN = 0.52;         // … down to about half a second
const levelOf = (depth) => 1 + Math.floor(depth / LEVEL_STRETCHES);
const levelSpeed = (L) => Math.min(SPEED_MAX, SPEED_MIN * Math.pow(SPEED_GROW, L - 1));
const levelGap = (L) => Math.max(GAP_MIN, 1.3 * Math.pow(GAP_SHRINK, L - 1));

// Two places to run, chosen on the home screen: the ruins on a dry day, or the same ruins at high tide, under water
// from the temple door onward. In both, the time of day moves on one step with every level.
const MAPS = {
  ruins: { name: 'Jungle Ruins', levels: ['Jungle Ruins', 'Sunset Ruins', 'Moonlit Ruins', 'Dawn Ruins'] },
  tide: { name: 'High Tide', levels: ['High Tide', 'Sunset Tide', 'Moonlit Tide', 'Dawn Tide'], sea: true },
};
const MAP_ORDER = ['ruins', 'tide'];
let MAP = 'ruins'; // the one in play
const atSea = () => !!MAPS[MAP].sea;
const levelName = (L) => MAPS[MAP].levels[(L - 1) % 4];

// Headings: 0 = north (-Z), 1 = east (+X), 3 = west (-X). The path never heads south,
// which guarantees it can never cross itself.
const DIRS = {
  0: { fx: 0, fz: -1, rx: 1, rz: 0 },
  1: { fx: 1, fz: 0, rx: 0, rz: 1 },
  3: { fx: -1, fz: 0, rx: 0, rz: -1 },
};
const yawOf = (h) => (h === 0 ? 0 : h === 1 ? -Math.PI / 2 : Math.PI / 2);
const laneX = (i) => (i - 1) * LANE_W; // lane index 0,1,2 → x

// Power-ups. Each has six levels; bananas buy the next level in the shop, and a level means it lasts longer.
const POWERS = {
  magnet: { name: 'Banana magnet', short: 'Magnet', blurb: 'Pulls in every banana nearby', t: [8, 10, 12, 15, 18, 22] },
  double: { name: 'Double score', short: 'Double', blurb: 'Everything scores twice', t: [8, 10, 12, 15, 18, 22] },
  shield: { name: 'Bubble shield', short: 'Shield', blurb: 'Soaks up one crash', t: [12, 15, 18, 22, 26, 30] },
  springs: { name: 'Super springs', short: 'Springs', blurb: 'Jump clean over totems and beams', t: [8, 10, 12, 15, 18, 22] },
  rocket: { name: 'Coconut rocket', short: 'Rocket', blurb: 'Fly high above the ruins', t: [5, 6, 7, 8.5, 10, 12] },
};
const POWER_KINDS = ['magnet', 'double', 'shield', 'springs', 'rocket'];
const UP_COST = [100, 250, 600, 1200, 2500]; // bananas for level 2, 3, 4, 5, 6
const MAX_LEVEL = 6;
const FLY_Y = 3.6;          // cruising height with the rocket
const SPRING_K = 1.34;      // jump speed multiplier with springs (about 3.4 m high)

const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const fmt = (n) => Math.floor(n).toLocaleString('en-US');
