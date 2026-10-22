/* ============================================================================
   MALL RUN — tuning & content config.  Tweak gameplay here.
   All distances are in metres (1 world unit = 1 m), times in seconds.
   ============================================================================ */

// ---- speed ----
export const START_SPEED = 6;          // "speed" units; the Starting-speed setting overrides this
export const SPEED_PER_LEVEL = 0.5;
export const MAX_SPEED = 12;
export const SPEED_RAMP = 0.0003;      // speed gained per metre run
export const METRES_PER_SPEED = 2.0;   // speed 6 -> 12 m/s

// ---- areas ----
export const LEVEL_DISTANCE = 800;     // metres between area/theme changes
export const LEVELS = ["Mall Hallway", "Boutique Wing", "Movie Theater", "Food Court", "Parking Garage"];

// ---- score / coin bank (bank fills -> coin value doubles: x1->x2->x4...) ----
export const SCORE_PER_METER = 1;
export const BANK_SIZE = 30;
export const COIN_MULT_TIERS = [1, 2, 4, 8, 16];

// ---- power-ups ----
export const PU_SPEED_TIME = 6;        // speed boost duration; magnitude doubles per stack (capped)
export const PU_SPEED_CAP = 4;
export const PU_IMMUNE_BASE = 5, PU_IMMUNE_CAP = 30;   // 5,10,20,30 s
export const PU_MAGNET_TIME = 15;
export const PU_BIGCOIN = 100;
export const PU_DJ_ARM = 10;           // seconds you have to use a Double-Jump (jump from a side lane)
export const BALCONY_LEN = 110;        // metres you run along the upper level before the barrier
export const EXIT_WINDOW = 24;         // metres before the barrier where a jump drops you back down

// ---- mall geometry ----
export const CW = 12;                  // corridor width, wall to wall
export const LANE = 2.6;               // lane spacing (lanes -1, 0, +1)
export const BAL_W = 2.8;              // upper-level walkway width (each side)
export const VOID_HALF = CW / 2 - BAL_W;   // half-width of the open atrium between the walkways (3.2)
export const UPPER_H = 4.4;            // upper-level floor height
export const SLAB = 0.4;               // walkway slab thickness
export const RAIL_H = 1.05;            // glass railing height
export const STORE_H = 3.0;            // storefront opening height
export const STORE_DEPTH = 7;          // how deep shops go behind the wall
export const ROOF_H = 8.4;             // upper-level ceiling height
export const SKY_H = 9.6;              // skylight ridge height over the atrium
export const BAY = 12;                 // column spacing; storefronts come in 6/12/24 m widths
export const BLOCK = 48;               // straight corridors are built in 48 m blocks (4 bays)
export const TURN_R = CW / 2;          // centre-line radius through a square junction
export const BALCONY_LAT = CW / 2 - BAL_W / 2;  // runner's lateral position on the walkway (4.6)

// ---- turns ----
export const FIRST_STRAIGHT_BLOCKS = 7;
export const STRAIGHT_BLOCKS_MIN = 6, STRAIGHT_BLOCKS_MAX = 10;
export const TURN_LEAD_TIME = 1.6;     // seconds of warning: the TURN prompt (and turn input) opens this long before a corner
export const TURN_WINDOW_MIN = 14;     // ...but never closer than this many metres
export const TURN_WINDOW_MAX = 30;     // ...or further than this
export const TURN_LATE_GRACE = 4;      // metres into the junction a late turn is still accepted

// ---- runner physics ----
export const GRAVITY = 26;
export const JUMP_V = 8.6;             // ~1.4 m hop, ~0.66 s air time
export const ROPE_CLEAR = 0.55;        // feet must be this high when crossing a rope
export const SLIDE_TIME = 0.62;
export const LANE_OMEGA = 16;          // lane-change spring stiffness (higher = snappier)
export const INPUT_BUFFER = 0.16;      // early jump/slide presses are remembered this long

// ---- camera ----
export const CAM_BACK = 6.2;
export const CAM_HEIGHT = 3.0;
export const CAM_LOOK_AHEAD = 7;
export const VIEW_DIST = 190;          // how far ahead the world is built / fog end

// ---- spawning ----
export const SLOT = 4;                 // spawn slot spacing along the path
export const OBSTACLES = ["person", "sample", "rope", "kiosk", "banner"];
export const KIOSK_TYPES = ["toys", "shades", "phones", "jewelry"];
export const POWER_CHANCE = 0.055;
export const POWER_MIN_GAP = 140;      // power-up orbs are never placed closer together than this (m)
export const QUESTION_COOLDOWN = 90;   // after any question, no new question for this many metres
export const REVIVE_IMMUNITY = 3;      // seconds of protection after a revive (so you can't crash straight into another question)
export const OBSTACLE_CHANCE = 0.2;
export const NPC_MAX = 30;

// ---- player customisation ----
export const SHIRT_SWATCHES = ["#3fa89b", "#e39ab4", "#f4f1ea", "#3a4a5a", "#c9784f", "#7a5aa0", "#4a4a4a", "#f0c85a"];
export const PANTS_SWATCHES = ["#33465e", "#4a4a4a", "#222228", "#7a5a3a", "#5a6b7a", "#8a4a5a", "#3a5a4a", "#c9bda0"];
export const SKIN_SWATCHES = ["#f2cfae", "#e8b98c", "#d39b6a", "#b07a4f", "#8a5a3a", "#5e3c26"];
export const HAIR_SWATCHES = ["#1a1a1a", "#3a2a1c", "#5a3a22", "#8a5a2a", "#c9a24a", "#e0c27a", "#a8452a", "#9a9a9a"];
export const HEIGHTS = [{ v: "short", t: "Shorter", h: 1.66 }, { v: "avg", t: "Average", h: 1.76 }, { v: "tall", t: "Taller", h: 1.86 }];
export const BUILDS = [{ v: "slim", t: "Slim", g: 0.86 }, { v: "avg", t: "Average", g: 1 }, { v: "heavy", t: "Heavyset", g: 1.24 }];
export const HAIR_STYLES = [{ v: "short", t: "Short" }, { v: "buzz", t: "Buzz" }, { v: "long", t: "Long" }, { v: "ponytail", t: "Ponytail" },
  { v: "bun", t: "Bun" }, { v: "afro", t: "Curly" }, { v: "cap", t: "Cap" }, { v: "bald", t: "Bald" }];

// shown in shared score cards / posts
export const GAME_NAME = "Mall Run";
export const SHARE_URL = "https://jvanwagner.neocities.org/";

// ---- per-area palettes ----
// floor tile A/B, lower wall, upper wall/fascia, ceiling, trim accent, fog/haze, store-type pool
export const THEMES = [
  { name: "hallway", floorA: "#e4ddcc", floorB: "#cfc6b0", wall: "#d8cdb4", fascia: "#efe8d8", ceil: "#f4efe4", trim: "#3fa89b", haze: "#d9dcd6", sky: "#cfe7ee",
    stores: ["apparel", "shoes", "electronics", "books", "toys", "cafe", "candy", "jewelry", "records", "sports", "florist", "home", "arcade"] },
  { name: "boutique", floorA: "#efe4ef", floorB: "#dccbdc", wall: "#d9c6d8", fascia: "#f3e9f2", ceil: "#f7eff6", trim: "#e39ab4", haze: "#e0d6de", sky: "#f2d9e6",
    stores: ["apparel", "apparel", "shoes", "jewelry", "home", "florist", "cafe", "candy", "books"] },
  { name: "theater", floorA: "#3a3152", floorB: "#2c2540", floorLines: "#7a5aa0", wall: "#3a3358", fascia: "#4a426a", ceil: "#231e36", trim: "#b48ad8", haze: "#2b2740", sky: "#3a2f5e",
    stores: ["theater", "arcade", "candy", "theater", "records", "concessions"] },
  { name: "foodcourt", floorA: "#efe2c6", floorB: "#dcc79a", wall: "#d8c39a", fascia: "#f2e7cc", ceil: "#f6eed8", trim: "#c9784f", haze: "#e2d6b8", sky: "#f6e2bc",
    stores: ["food", "food", "food", "cafe", "candy", "food"] },
  { name: "garage", floorA: "#9fa39c", floorB: "#8f938c", floorLines: "#e8d36a", wall: "#a4a9a2", fascia: "#b8bcb5", ceil: "#8e938c", trim: "#e8c547", haze: "#a8aea8", sky: "#b9c6cf",
    stores: ["parking"] }
];

export const POWER_COLORS = { speed: "#f0c85a", immunity: "#6fe0cf", bigcoin: "#e6b23a", magnet: "#e39ab4", doublejump: "#9a6ad0" };
export const POWER_GLYPH = { speed: "»", immunity: "✦", bigcoin: "$", magnet: "U", doublejump: "↑" };
export const POWER_NAME = { speed: "Speed Boost", immunity: "Immunity", bigcoin: "Big Coin", magnet: "Coin Magnet", doublejump: "Double-Jump" };

export const F_HEAD = '"Termina Test","General Sans","Trebuchet MS",sans-serif';
