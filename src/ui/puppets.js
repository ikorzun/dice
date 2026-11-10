// Bonus characters alive on their cards, the old-cartoon way (owner, 03.11.2026: «the animation inside the cards
// trembles; another approach, after the joker: a storyboard like old Disney cartoons or Cuphead»; the joker approved
// the same day, «the others the same way»; docs/ANIM-STORYBOARDS.md). A card's picture is a cutout puppet (rig.js)
// shown as held drawings: 12 a second (24 fps on twos), in big poses to a beat of 90 bpm, 8 drawings a beat. Nothing
// moves between drawings, so nothing shimmers. The character rests, its picture as drawn, and now and then takes a
// turn of two beats (owner, 03.11.2026: «the constant animation distracts; reasonable pauses and cycles»): its bounce,
// every other time its act, then it lands and rests again. One card at a time, a pause between turns, and no turn
// while the dice are thrown or counted or just after a tap. The canvas covers the card at the screen's full
// resolution, the parts scaled once to it, and draws only when the drawing changes. A tap moves only the card. One
// loop for every card; a card out of sight is skipped; with reduced motion the picture never leaves its rest.
// Approach 1 (a breath and small events every display frame) is kept in prototypes/char-anim/approach1.js.
import { createPuppet } from './rig.js';

const D = 12; // drawings a second
const BEAT = 8; // drawings a beat: 90 bpm
const FIRST = [2, 5]; // seconds before a card's first turn
const REST = [10, 16]; // seconds a card rests between its turns
const GAP = 3; // seconds between one card's turn and any other's
const CALM = 4; // seconds after a tap before a turn
const row = (table, e) => table[Math.min(e, table.length - 1)];
const mod = (n, m) => ((n % m) + m) % m;

// ×2 ANY HAND: the skeleton knight, a stiff guard on the march (storyboard §1).
// [sy, sx, dy, lean°, pupils dx, pupils dy, tulip°]; the tulip hangs from its stem, + turns it down
const KNIGHT_BEAT = [
  [0.92, 1.05, 6, 0.5, 0, 4, 14], // 1 down on the beat: squashed, a stern look down; the tulip keeps falling
  [0.98, 1.01, 2, 1.5, 0, 2, 8], // 2 push off
  [1.07, 0.96, -8, 2.5, 6, -2, 2], // 3 rise: stretched, the eyes go along
  [1.05, 0.97, -12, 3, 10, -6, -6], // 4 up: the tulip floats up as the head slows
  [1.04, 0.98, -14, 3, 10, -6, -10], // 5 top
  [1.04, 0.98, -13, 2.5, 10, -4, -12], // 6 hang
  [1.06, 0.965, -6, 1.5, 4, 0, -8], // 7 fall: stretched by the speed
  [1, 1, 0, 0.5, 0, 2, 2], // 8 about to land
];
// What was that? He ducks behind the edge, peeks left and right, and pops up.
const KNIGHT_DUCK = [
  [1.05, 0.97, -8, 0, 0, -8, -4], // 1 on the alert: stretched, eyes up
  [0.9, 1.06, 40, 0, 0, -6, -14], // 2 ducks, squashed on the way; the tulip lags up
  [0.95, 1.03, 170, 0, 0, -4, -18], // 3 down: only the helmet shows
  [0.97, 1.02, 200, 0, 0, 0, 10], // 4 the tulip flops after him
  [1, 1, 120, 0, -14, -4, 6], // 5 peeks over the edge: left
  [1, 1, 120, 0, -14, -4, 2], // 6
  [1, 1, 120, 0, 14, -4, 0], // 7 right
  [1, 1, 120, 0, 14, -4, 0], // 8
  [0.94, 1.04, 140, 0, 0, 0, 4], // 9 all clear: sinks to spring
  [1.14, 0.92, -14, 0, 0, -8, 18], // 10 POP, stretched past the rest; the tulip whips down
  [1.08, 0.95, -18, -1.5, 0, -6, 6], // 11
  [1.04, 0.975, -14, -1, 0, -4, -8], // 12 the tulip springs up
  [1.03, 0.985, -10, 0, 0, -2, -10], // 13
  [1.04, 0.98, -6, 0, 0, 0, -4], // 14
  [1.05, 0.97, -2, 0, 0, 2, 0], // 15 falling
  [1, 1, 0, 0, 0, 2, 4], // 16 the next beat lands him
];
// The win (owner's pick В11 A, 04.11.2026; GPT's victory act): he sinks, springs up stiff and upright, the tulip snapped
// up like a salute (drawing 6, the key pose), glances left and right, and lands.
const KNIGHT_WIN = [
  [0.96, 1.04, 18, 0, 0, 2, 8],
  [0.9, 1.08, 34, 0, 0, 4, 14],
  [1.08, 0.95, -18, -2, 0, -6, -12],
  [1.14, 0.92, -42, -4, -4, -8, -18],
  [1.1, 0.94, -50, -3, 8, -8, -24],
  [1.08, 0.95, -52, 0, 0, -10, -30],
  [1.08, 0.95, -52, 0, 0, -10, -30],
  [1.06, 0.96, -46, 3, -12, -7, -18],
  [1.06, 0.96, -46, -3, 12, -7, -10],
  [0.98, 1.02, -30, 0, 0, 2, 16],
  [1.04, 0.98, -36, 0, 0, -4, -8],
  [1.02, 0.99, -24, 0, 0, -2, -4],
  [1.01, 0.995, -14, 0, 0, 0, 2],
  [0.98, 1.02, 4, 0, 0, 2, 6],
  [1.01, 0.99, -3, 0, 0, 0, 2],
  [1, 1, 0, 0, 0, 0, 0],
];
// The paired act (LORE §6 point 8, the owner's pick A of 10.11.2026; GPT's tables, played and checked in the game): when
// the winning hand holds him and the skull, he springs up, leans and looks toward the skull and dips his tulip to it
// like a lowered banner (drawings 4-5), holds and settles. Written for a skull on his right; act.dir mirrors the lean
// and the look when it sits on his left. The tulip dips the same way on either side.
const KNIGHT_PAIR = [
  [0.97, 1.03, 9, -1, 0, 1, -3],
  [0.94, 1.06, 17, -2, 0, 2, -5],
  [1.07, 0.96, -18, 2, 17, -6, 18],
  [1.1, 0.94, -52, 4.5, 22, -8, 30],
  [1.1, 0.94, -52, 4.5, 22, -8, 30],
  [1.08, 0.95, -44, 3, 17, -6, 24],
  [1.04, 0.98, -30, 1.5, 9, -3, 12],
  [1.01, 0.995, -16, 0.5, 4, -1, 4],
  [0.99, 1.01, 0, -0.5, 0, 1, -2],
  [1, 1, 0, 0, 0, 0, 0],
  [1.01, 0.995, -4, 0.5, 0, -1, 2],
  [1, 1, 0, 0, 0, 0, 0],
  [1, 1, 0, 0, 0, 0, 0],
  [1, 1, 0, 0, 0, 0, 0],
  [1, 1, 0, 0, 0, 0, 0],
  [1, 1, 0, 0, 0, 0, 0],
];
function knightPose(k, act) {
  const side = act ? (act.name === 'pair' ? act.dir : 1) : mod(k, 16) < 8 ? 1 : -1;
  const [sy, sx, dy, lean, px, py, tulip] = act ? row(act.name === 'pair' ? KNIGHT_PAIR : act.name === 'win' ? KNIGHT_WIN : KNIGHT_DUCK, act.e) : KNIGHT_BEAT[mod(k, BEAT)];
  const pupil = { dx: px * side, dy: py };
  return { head: { sy, sx, dy, rot: lean * side }, pupilL: pupil, pupilR: pupil, flower: { rot: tulip } };
}

// ×3 STRAIGHT: the grumpy bug keeps time with its staff (storyboard §2). Its feelers follow the head a drawing or
// two late; + throws them down. [sy, sx, dy, lean°, pupils dy, staff dy, staff°]; the staff leans to the head with -
const BUG_BEAT = [
  [0.9, 1.07, 6, 0, 6, 12, 0], // 1 THUMP: the staff strikes the beat, the bug squashes, glaring down
  [0.97, 1.02, 2, 1, 3, 6, -1], // 2
  [1.08, 0.95, -10, 2, -2, 0, -2], // 3 rise: stretched; the staff comes up
  [1.06, 0.965, -14, 2.5, -4, 0, -3], // 4
  [1.05, 0.97, -15, 2.5, -4, 0, -3.5], // 5 top
  [1.05, 0.97, -13, 2, -3, 0, -3], // 6
  [1.07, 0.955, -6, 1, 0, 0, -2], // 7 fall; the staff swings to strike
  [1, 1, 0, 0, 2, 0, 1], // 8
];
const WHIP = [12, 10, 6, -4, -10, -10, -8, 0]; // the feelers on the bounce: thrown down on the landing, up at the top
// HMPH: it winds up, puffs up stiff with its feelers straight up, stamps the staff three times, shakes its head.
// [sy, sx, dy, rot°, pupils scale, feelers°, staff dy, staff°]
const BUG_HMPH = [
  [0.88, 1.08, 8, 0, 0.6, 14, 0, -2], // 1 winds up: sinks, squints
  [0.86, 1.09, 10, 0, 0.6, 16, 0, -6], // 2 lower; the staff swings back
  [1.14, 0.92, -16, 0, 0.7, -14, 18, 2], // 3 HMPH! stiff, feelers up, the staff stamps
  [1.12, 0.93, -18, 0, 0.7, -12, 2, -3], // 4
  [1.12, 0.93, -18, 0, 0.7, -12, 18, 2], // 5 stamp
  [1.11, 0.935, -17, 0, 0.7, -12, 2, -3], // 6
  [1.12, 0.93, -18, 0, 0.7, -12, 18, 2], // 7 stamp
  [1.1, 0.94, -16, 0, 0.75, -10, 8, 0], // 8
  [1.06, 0.96, -12, -5, 0.8, 8, 0, 0], // 9 shakes its head: no
  [1.06, 0.96, -12, 5, 0.8, -8, 0, 0], // 10
  [1.05, 0.97, -10, -4, 0.85, 6, 0, 0], // 11
  [1.05, 0.97, -10, 3, 0.9, -4, 0, 0], // 12
  [1.03, 0.98, -6, 0, 1, 4, 0, 0], // 13 settles; the feelers overshoot
  [1.02, 0.99, -4, 0, 1, -2, 0, 0], // 14
  [1.04, 0.975, -2, 0, 1, 0, 0, -1], // 15 falling
  [1, 1, 0, 0, 1, 0, 0, 0], // 16
];
// The win: it rises glaring and stamps the star staff down, feelers thrown forward (drawing 7), then settles. Same row.
const BUG_WIN = [
  [0.95, 1.04, 18, 2, 0.94, 8, -4, 4],
  [0.9, 1.08, 34, 4, 0.9, 16, -12, 10],
  [1.08, 0.95, -16, -5, 1.08, -10, -24, -12],
  [1.12, 0.93, -38, -8, 1.12, -18, -30, -18],
  [1.08, 0.95, -44, -6, 1.08, -14, -34, -22],
  [1.04, 0.98, -36, 3, 0.98, 10, -12, 10],
  [0.94, 1.05, -18, 0, 1.16, 24, 22, 0],
  [0.94, 1.05, -18, 0, 1.16, 24, 22, 0],
  [1.08, 0.95, -32, -3, 1.06, -8, 2, -8],
  [1.05, 0.97, -28, 2, 1.02, 6, 8, 4],
  [1.02, 0.99, -20, -2, 1, -4, 4, -2],
  [0.98, 1.02, -8, 1, 0.98, 4, 2, 1],
  [1.01, 0.99, -12, 0, 1, 0, 0, 0],
  [0.99, 1.01, 3, 0, 1, 2, 2, 0],
  [1.01, 0.99, -2, 0, 1, 0, 0, 0],
  [1, 1, 0, 0, 1, 0, 0, 0],
];
function bugPose(k, act) {
  const side = mod(k, 16) < 8 ? 1 : -1;
  let head, pupil, staff, feel;
  if (act) {
    const table = act.name === 'win' ? BUG_WIN : BUG_HMPH;
    const [sy, sx, dy, rot, ps, , sd, sr] = row(table, act.e);
    head = { sy, sx, dy, rot };
    pupil = { sx: ps, sy: ps };
    staff = { dy: sd, rot: sr };
    feel = (late) => row(table, Math.max(0, act.e - late))[5];
  } else {
    const [sy, sx, dy, lean, py, sd, sr] = BUG_BEAT[mod(k, BEAT)];
    head = { sy, sx, dy, rot: lean * side };
    pupil = { dy: py };
    staff = { dy: sd, rot: sr };
    feel = (late) => WHIP[mod(k - late, BEAT)];
  }
  return {
    head, pupilL: pupil, pupilR: pupil, staff,
    antL: { rot: -feel(1) }, antM: { rot: 0.8 * feel(2) }, antR: { rot: feel(1) }, // each turns down its own way
    legs: { sy: !act && mod(k, BEAT) === 0 ? 0.97 : 1 },
  };
}

// ×3 PAIRS: the little one hops on every beat, the tall one sways at half the pace, bored (storyboard §3).
// little [sy, sx, dy, lean°, pupils dx, pupils dy]: it leans to the tall one on the first beat, away on the second
const KID_BEAT = [
  [0.86, 1.09, 6, 0, 0, 4], // 1 lands squashed
  [0.95, 1.03, 2, 0, 0, 2], // 2
  [1.12, 0.93, -10, -1.5, 0, -4], // 3 up, stretched
  [1.07, 0.96, -15, -2.5, -4, -6], // 4
  [1.05, 0.97, -16, -2.5, -4, -6], // 5 top
  [1.05, 0.97, -14, -2, -4, -4], // 6
  [1.1, 0.94, -6, -1, 0, 0], // 7 fall
  [1, 1, 0, 0, 0, 2], // 8
];
// tall [sy, sx, dy, lean°] over both beats: it slumps on each, sways once, and holds at each end of the sway
const TALL_BEAT = [
  [0.97, 1.02, 5, -1], [0.97, 1.02, 5, -1], [0.99, 1.005, 2, -2], [0.99, 1.005, 2, -2],
  [1, 1, 0, -2.5], [1, 1, 0, -2.5], [1, 1, 0, -2.5], [0.99, 1.005, 2, -1.5],
  [0.97, 1.02, 5, 0], [0.97, 1.02, 5, 0], [0.99, 1.005, 2, 1], [0.99, 1.005, 2, 1],
  [1, 1, 0, 1.5], [1, 1, 0, 1.5], [1, 1, 0, 1.5], [0.99, 1.005, 2, 0.5],
];
// The leap: the little one crouches and leaps; the tall one sinks out of sight, unimpressed, while the little one
// looks for him; he comes back up. [little: sy, sx, dy, lean°, pupils dx, pupils dy], [tall: dy, sy]
const PAIR_LEAP = [
  [[0.88, 1.08, 8, 0, 0, 6], [5, 0.97]], // 1 crouch
  [[0.82, 1.12, 12, 0, 0, 6], [4, 0.98]], // 2 deeper
  [[1.18, 0.9, -16, 0, 0, -10], [0, 1]], // 3 LEAP
  [[1.12, 0.93, -18, 0, 0, -10], [10, 1]], // 4
  [[1.06, 0.97, -16, 0, 0, -8], [40, 1]], // 5 the tall one starts to sink
  [[1.1, 0.94, -8, 0, 0, -4], [110, 1]], // 6
  [[0.86, 1.09, 6, 0, 0, 4], [200, 1]], // 7 the little one lands
  [[0.98, 1.01, 0, 0, -6, 0], [280, 1]], // 8 the tall one is gone but for his hair and eyelids
  [[1, 1, 0, -3, -10, 0], [300, 1]], // 9 where did he go?
  [[1, 1, 0, -4, -10, 2], [300, 1]], // 10
  [[1, 1, 0, -4, -10, 2], [300, 1]], // 11
  [[1, 1, 0, -2, -6, 0], [220, 1]], // 12 he rises
  [[1, 1, 0, 0, 0, 0], [110, 1.02]], // 13
  [[1, 1, 0, 0, 0, 0], [20, 1.04]], // 14
  [[1.04, 0.98, -4, 0, 0, 0], [-4, 1.03]], // 15
  [[1, 1, 0, 0, 0, 2], [0, 1]], // 16
];
// The win: the little one leaps highest (drawing 5) while the tall one barely lifts, bored. Same row.
const PAIR_WIN = [
  [[0.96, 1.04, 18, 0, 0, 2], [4, 0.99]],
  [[0.9, 1.08, 34, -4, 0, 4], [8, 0.98]],
  [[1.08, 0.95, -32, 8, -4, -6], [-2, 1.01]],
  [[1.14, 0.92, -82, -8, 5, -8], [-5, 1.015]],
  [[1.1, 0.94, -112, 5, 0, -10], [-8, 1.02]],
  [[1.1, 0.94, -112, 5, 0, -10], [-8, 1.02]],
  [[1.06, 0.97, -96, -6, -7, -6], [-6, 1.015]],
  [[1.06, 0.97, -88, 7, 7, -5], [-4, 1.01]],
  [[0.94, 1.05, 12, 0, 0, 4], [2, 0.995]],
  [[1.08, 0.95, -48, -4, -4, -4], [-3, 1.01]],
  [[1.04, 0.98, -34, 3, 4, -2], [-2, 1.005]],
  [[1.02, 0.99, -24, -2, 0, 0], [-1, 1]],
  [[0.98, 1.02, 4, 0, 0, 2], [1, 0.998]],
  [[1.02, 0.99, -10, 1, 0, 0], [0, 1]],
  [[0.99, 1.01, 2, 0, 0, 0], [0, 1]],
  [[1, 1, 0, 0, 0, 0], [0, 1]],
];
function pairPose(k, act) {
  const side = mod(k, 16) < 8 ? 1 : -1;
  let kid, pupil, tall;
  if (act) {
    const [[sy, sx, dy, lean, px, py], [tdy, tsy]] = row(act.name === 'win' ? PAIR_WIN : PAIR_LEAP, act.e);
    kid = { sy, sx, dy, rot: lean };
    pupil = { dx: px, dy: py };
    tall = { dy: tdy, sy: tsy, sx: 2 - tsy };
  } else {
    const [sy, sx, dy, lean, px, py] = KID_BEAT[mod(k, BEAT)];
    kid = { sy, sx, dy, rot: lean * side };
    pupil = { dx: px * side, dy: py };
    const [tsy, tsx, tdy, tlean] = TALL_BEAT[mod(k, 16)];
    tall = { sy: tsy, sx: tsx, dy: tdy, rot: tlean };
  }
  return { tall, kid, kidL: pupil, kidR: pupil };
}

// ×3 TRIPS: three heads in one coat, a wobbly tower (storyboard §4). The beat goes up the stack: the bottom one on
// the beat, the middle one a drawing later, the top one two later, each leaning further.
// [sy, sx, dy, lean°] of the bottom one
const TRIO_BEAT = [
  [0.9, 1.07, 6, 0.5], // 1 down on the beat
  [0.97, 1.02, 2, 1.5], // 2
  [1.07, 0.95, -8, 2.5], // 3 up
  [1.05, 0.97, -11, 3], // 4
  [1.04, 0.975, -12, 3], // 5 top
  [1.04, 0.975, -10, 2.5], // 6
  [1.06, 0.96, -5, 1.5], // 7 fall
  [1, 1, 0, 0.5], // 8
];
// The teeter: it leans back, tips over with the top one lagging, nearly loses it, steps back and rights itself past
// the middle. [bottom°, middle°, top° as seen, bottom sy, dy]
const TRIO_TEETER = [
  [-2, -2.5, -3, 0.95, 4], // 1 leans back
  [-3, -4, -5, 0.94, 5], // 2
  [2, 0, -3, 1.04, -6], // 3 tips: the bottom goes first
  [4, 4, 1, 1.05, -8], // 4
  [5, 8, 7, 1.04, -8], // 5
  [6, 11, 13, 1.03, -8], // 6 the top one nearly falls off
  [6, 12, 16, 1.03, -8], // 7
  [5.5, 11, 15, 1.03, -8], // 8
  [3, 8, 14, 1.02, -6], // 9 the bottom one steps back under it
  [0, 3, 8, 1, -4], // 10
  [-3, -2, 0, 0.98, -2], // 11 past the middle
  [-4, -4, -5, 0.97, 0], // 12
  [-2, -3, -5, 0.98, 0], // 13
  [0, -1, -2, 1, 0], // 14
  [1, 1, 1, 1.02, -2], // 15
  [0, 0, 0, 1, 0], // 16
];
// The win: the stack wobbles wildly one way and the other, then snaps into a proud straight tower (drawing 7). Same row.
const TRIO_WIN = [
  [2, -3, 4, 0.96, 14],
  [5, -8, 10, 0.9, 32],
  [-8, 12, -14, 1.08, -18],
  [-13, 17, -20, 1.12, -38],
  [16, -20, 22, 1.08, -48],
  [-18, 22, -24, 1.06, -52],
  [0, 0, 0, 1.1, -54],
  [0, 0, 0, 1.1, -54],
  [12, -14, 16, 0.96, -30],
  [-10, 12, -13, 1.04, -34],
  [7, -8, 9, 1.02, -24],
  [-5, 6, -7, 0.99, -12],
  [3, -4, 4, 1.01, -8],
  [-2, 2, -2, 0.98, 3],
  [1, -1, 1, 1.01, -2],
  [0, 0, 0, 1, 0],
];
function trioPose(k, act) {
  if (act) {
    const [b, m, t, sy, dy] = row(act.name === 'win' ? TRIO_WIN : TRIO_TEETER, act.e).map((v, i) => (i < 3 ? v * act.dir : v));
    return { bot: { rot: b, sy, sx: 2 - sy, dy }, mid: { rot: m - b }, top: { rot: t - m } };
  }
  const at = (late) => { // the bottom one's pose `late` drawings ago, with the lean of its beat
    const j = k - late;
    const [sy, sx, dy, lean] = TRIO_BEAT[mod(j, BEAT)];
    return { sy, sx, dy, lean: lean * (mod(j, 16) < 8 ? 1 : -1) };
  };
  const [b, m, t] = [at(0), at(1), at(2)];
  return {
    bot: { sy: b.sy, sx: b.sx, dy: b.dy, rot: b.lean },
    mid: { sy: m.sy / b.sy, sx: m.sx / b.sx, rot: 1.3 * m.lean - b.lean }, // as seen: its own squash and lean, late
    top: { sy: t.sy / m.sy, sx: t.sx / m.sx, rot: 1.7 * t.lean - 1.3 * m.lean },
  };
}

// ★ JOKER: the skull with a star in its eye (storyboard §5), the whole skull with a jaw on a hinge.
// [sy, sx, dy, lean°, jaw°, star scale, star°]; lean > 0 tips the top to the right, jaw < 0 opens it
const SKULL_BEAT = [
  [0.9, 1.07, 8, 0.5, 0, 1.35, 15], // 1 down: squashed on the beat, the jaw clacks shut, the star goes off
  [0.97, 1.02, 2, 1.5, -2, 1.18, 8], // 2 push off
  [1.08, 0.95, -12, 3, -6, 1.06, 3], // 3 rise: stretched
  [1.05, 0.97, -20, 4, -8, 1, 0], // 4 up
  [1.04, 0.975, -22, 4.2, -8, 1, 0], // 5 top
  [1.035, 0.98, -21, 4, -7, 1, 0], // 6 hang
  [1.06, 0.96, -10, 2.5, -4, 1, 0], // 7 fall: stretched by the speed
  [1, 1, 0, 1, -1, 1, 0], // 8 about to land
];
// The cackle: it sinks, pops up laughing with the jaw flapping, wheezes and falls back into the beat.
// [sy, sx, dy, rot°, jaw°, star scale, star°, eye dy]
const SKULL_CACKLE = [
  [0.88, 1.08, 14, -3, 0, 1, 0, -6], // 1 sinks, squashed, a sly look up
  [0.86, 1.09, 18, -4, 0, 1, 0, -7], // 2 lower still
  [1.12, 0.93, -58, 6, -10, 1.4, 30, -8], // 3 HA! up, the jaw wide open
  [1.06, 0.96, -46, 5, -1, 1.2, 40, -8], // 4 clack
  [1.1, 0.94, -56, 6, -10, 1.35, 55, -8], // 5 HA
  [1.05, 0.965, -44, 5, -1, 1.15, 62, -8], // 6 clack
  [1.1, 0.94, -54, 6, -10, 1.3, 75, -8], // 7 HA
  [1.05, 0.965, -42, 5, -1, 1.1, 80, -8], // 8 clack
  [1.09, 0.945, -50, 5.5, -9, 1.25, 90, -8], // 9 HA
  [1.04, 0.97, -38, 4.5, -1, 1.05, 90, -7], // 10 clack
  [1.06, 0.96, -30, 4, -6, 1, 90, -6], // 11 hee
  [1.03, 0.98, -22, 3, -1, 1, 90, -4], // 12
  [1.04, 0.975, -16, 2, -4, 1, 90, -2], // 13 hee
  [1.02, 0.99, -8, 1, -1, 1, 90, 0], // 14 settling
  [1.05, 0.97, -4, 0.5, 0, 1, 90, 0], // 15 falling, stretched
  [1, 1, 0, 0, 0, 1, 90, 0], // 16 the next beat lands it (a four-point star a quarter turn on looks the same)
];
// The win: it rises into a cackle, jaw wide and the star swelling (drawing 5), and laughs itself back down. Same row.
const SKULL_WIN = [
  [0.96, 1.04, 16, 2, -6, 0.8, -8, 2],
  [0.9, 1.08, 32, -3, -14, 0.7, -16, 4],
  [1.08, 0.95, -24, 6, -24, 1.2, 14, -6],
  [1.12, 0.93, -48, -8, -30, 1.4, -18, -10],
  [1.1, 0.94, -58, 10, -34, 1.55, 24, -12],
  [1.1, 0.94, -58, 10, -34, 1.55, 24, -12],
  [1.06, 0.97, -50, -9, -28, 1.35, -22, -8],
  [1.08, 0.95, -54, 8, -34, 1.6, 28, -10],
  [0.96, 1.04, -30, -6, -20, 1.2, -16, -4],
  [1.06, 0.97, -38, 5, -28, 1.4, 18, -6],
  [1.02, 0.99, -26, -4, -18, 1.18, -10, -3],
  [1.01, 0.995, -18, 3, -12, 1.1, 8, -2],
  [0.98, 1.02, 3, -2, -6, 0.9, -4, 1],
  [1.02, 0.99, -8, 1, -4, 1.05, 2, 0],
  [0.99, 1.01, 2, 0, -2, 1, 0, 0],
  [1, 1, 0, 0, 0, 1, 0, 0],
];
// Its answer in the paired act: it notices the knight (the eye goes to him, drawing 3), bows toward him with the jaw open
// and the star swelling, holds the bow three drawings (5-8) before the black comes, and settles. Written for a knight on
// its left; act.dir mirrors the lean and the look. [sy, sx, dy, rot°, jaw°, star scale, star°, eye dy, eye dx]
const SKULL_PAIR = [
  [0.97, 1.03, 9, 1, 0, 1, 0, 1, 0],
  [0.94, 1.06, 17, 2, 0, 0.96, -3, 2, 0],
  [1.06, 0.97, -16, 0, -6, 1.08, -5, -4, -26],
  [1.09, 0.95, -36, -3.5, -18, 1.28, -12, -7, -34],
  [1.11, 0.93, -48, -5, -26, 1.4, -16, -9, -34],
  [1.12, 0.92, -54, -5.5, -30, 1.45, -18, -10, -34],
  [1.12, 0.92, -54, -5.5, -30, 1.45, -18, -10, -34],
  [1.12, 0.92, -54, -5.5, -30, 1.45, -18, -10, -34],
  [1.06, 0.97, -36, -4, -24, 1.34, -14, -7, -26],
  [1.04, 0.98, -24, -2.5, -16, 1.2, -9, -4, -17],
  [1.02, 0.99, -12, -1, -8, 1.08, -4, -2, -9],
  [1, 1, 0, 0, 0, 1, 0, 0, 0],
  [0.99, 1.01, 3, 0.5, 0, 0.99, 1, 1, 0],
  [1, 1, 0, 0, 0, 1, 0, 0, 0],
  [1, 1, 0, 0, 0, 1, 0, 0, 0],
  [1, 1, 0, 0, 0, 1, 0, 0, 0],
];
function skullPose(k, act) {
  if (act) {
    const [sy, sx, dy, rot, jaw, star, turn, iy, ix] = row(act.name === 'pair' ? SKULL_PAIR : act.name === 'win' ? SKULL_WIN : SKULL_CACKLE, act.e);
    const grip = act.e >= 2 && act.e <= 10 ? (act.e % 2 ? 0.97 : 0.93) : 1; // the fingers squeeze the edge on each HA
    const side = act.name === 'pair' ? act.dir : 1;
    const iris = act.name === 'pair' ? { dx: ix * side, dy: iy } : { dy: iy };
    return { head: { sy, sx, dy, rot: rot * side }, jaw: { rot: jaw }, star: { sx: star, sy: star, rot: turn }, iris, handL: { sy: grip }, handR: { sy: grip } };
  }
  const j = mod(k, 16);
  const side = j < 8 ? 1 : -1;
  const [sy, sx, dy, lean, jaw, star, turn] = SKULL_BEAT[j % 8];
  const press = j % 8 === 0 ? 0.94 : j % 8 === 1 ? 0.97 : 1; // the hand on the leaning side takes the weight
  const lift = j % 8 === 0 ? 1.03 : 1;
  return {
    head: { sy, sx, dy, rot: lean * side },
    jaw: { rot: jaw },
    star: { sx: star, sy: star, rot: turn * side },
    iris: { dx: j % 8 >= 2 && j % 8 <= 6 ? 6 * side : 0, dy: j % 8 >= 3 && j % 8 <= 5 ? -5 : 0 },
    handL: { sy: side < 0 ? press : lift },
    handR: { sy: side > 0 ? press : lift },
  };
}

// +1 REFUND: the pawnbroker bird bobs like a pigeon (storyboard §6): its head thrusts toward its beak on the beat
// and draws back, the crest and the earring flying the other way; the coin's sparkle flares on every other beat.
// [sy, sx, dx, dy, rot°, crest°, earring°]; crest < 0 droops it, earring < 0 swings it back.
const BIRD_BEAT = [
  [0.94, 1.04, 16, 6, 2, -10, -14], // 1 thrust on the beat, squashed
  [0.97, 1.02, 14, 4, 1.5, -6, -8], // 2
  [1.03, 0.985, 6, 0, 0.5, 4, 6], // 3 draws back, stretched
  [1.04, 0.98, -2, 0, -0.5, 8, 12], // 4
  [1.04, 0.98, -6, 0, -1, 8, 12], // 5 back
  [1.03, 0.985, -6, 0, -1, 4, 6], // 6
  [1, 1, -2, 0, 0, -2, -2], // 7
  [0.98, 1.01, 6, 2, 1, -4, -6], // 8 about to thrust
];
const GLINT = [[1.35, 45], [1.2, 60], [1.05, 75]]; // [scale, °] after the beat; then at rest a quarter turn on
// The count: it leans to its coin and nods over it three times, the sparkle flaring with each, then lifts its
// beak, smug. [sy, sx, dx, dy, rot°, crest°, earring°, sparkle scale, sparkle°]
const BIRD_COUNT = [
  [1.02, 0.99, -10, 2, -1, 6, 8, 1, 90], // 1 leans to the coin
  [1.03, 0.985, -16, 2, -1.5, 8, 12, 1, 90], // 2
  [0.92, 1.05, -18, 10, 2, -10, -16, 1.4, 120], // 3 one
  [1.02, 0.99, -16, 2, -1, 6, 10, 1.05, 135], // 4
  [0.92, 1.05, -18, 10, 2, -10, -16, 1.4, 165], // 5 two
  [1.02, 0.99, -16, 2, -1, 6, 10, 1.05, 180], // 6
  [0.92, 1.05, -18, 10, 2, -10, -16, 1.45, 210], // 7 three
  [1.02, 0.99, -16, 2, -1, 6, 10, 1.05, 225], // 8
  [1.06, 0.97, -6, 2, -3, 12, 14, 1, 240], // 9 the beak goes up: smug
  [1.07, 0.965, 0, 2, -4, 6, 4, 1, 270], // 10
  [1.07, 0.965, 0, 2, -4, 2, -4, 1, 270], // 11
  [1.06, 0.97, 0, 2, -3.5, 0, -6, 1, 270], // 12
  [1.04, 0.98, 0, 1, -2.5, -2, -2, 1, 270], // 13
  [1.02, 0.99, 0, 0, -1, 0, 2, 1, 270], // 14
  [1, 1, 0, 0, 0, 0, 0, 1, 270], // 15
  [0.98, 1.01, 6, 2, 1, -4, -6, 1, 270], // 16 about to thrust
];
// The win: smug, it leans to its coin, crest high, as the sparkle swells to its largest (drawing 5), and settles. Same row.
const BIRD_WIN = [
  [0.97, 1.03, -4, 14, -2, -6, 5, 1, 0],
  [0.92, 1.07, -8, 30, -4, -12, 10, 0.7, -12],
  [1.08, 0.95, 8, -18, 5, 10, -8, 0.9, 18],
  [1.12, 0.93, 14, -38, 8, 16, -12, 1.2, 36],
  [1.08, 0.95, 18, -46, 10, 20, -16, 1.6, 54],
  [1.08, 0.95, 18, -46, 10, 20, -16, 1.6, 54],
  [1.04, 0.98, 10, -38, 5, 12, -10, 1.25, 92],
  [1.02, 0.99, -6, -30, -4, -8, 8, 0.9, 138],
  [0.96, 1.04, -12, -14, -6, -14, 12, 1.4, 180],
  [1.06, 0.97, 8, -28, 4, 10, -8, 1.1, 228],
  [1.03, 0.99, 4, -20, 2, 6, -5, 1, 270],
  [1.01, 0.995, -2, -12, -1, -3, 3, 1, 318],
  [0.98, 1.02, 0, 3, 0, 2, -2, 1, 350],
  [1.02, 0.99, 0, -8, 0, 0, 1, 1, 0],
  [0.99, 1.01, 0, 2, 0, 0, 0, 1, 0],
  [1, 1, 0, 0, 0, 0, 0, 1, 0],
];
function birdPose(k, act) {
  const [sy, sx, dx, dy, rot, crest, earring, g, gr] = act
    ? row(act.name === 'win' ? BIRD_WIN : BIRD_COUNT, act.e)
    : [...BIRD_BEAT[mod(k, BEAT)], ...(GLINT[mod(k, 16)] || [1, 90])];
  return { head: { sy, sx, dx, dy, rot }, crest: { rot: crest }, earring: { rot: earring }, glint: { sx: g, sy: g, rot: gr } };
}

// By bonus kind. frame: the card picture's frame in the 1024 px drawing, laid like the picture it replaces (contain,
// centre bottom in .art, moved by its --drop); edge: where the card's edge cuts the `clip` parts. Parts back to
// front, cut by art/bonuses/anim/cartoon-fix.py (half size in assets/ui/bonuses/cartoon/). acts: { name: table of
// 16 drawings }; pose(k, act) gives the bones of the bounce's drawing k, or of the act's drawing act.e.
export const CHARACTERS = {
  x2_any: {
    name: 'knight',
    frame: [14, 210, 997, 814],
    edge: 884,
    parts: [
      { name: 'head', at: [152, 210], size: [759, 715], pivot: [512, 884], clip: true },
      { name: 'pupilL', at: [368, 676], size: [82, 94], pivot: [411, 720], parent: 'head', clip: true },
      { name: 'pupilR', at: [574, 672], size: [81, 98], pivot: [613, 720], parent: 'head', clip: true },
      { name: 'flower', at: [756, 276], size: [195, 226], pivot: [812, 303], parent: 'head' },
      { name: 'gear', at: [14, 578], size: [997, 345], pivot: [512, 884] },
    ],
    acts: { duck: KNIGHT_DUCK },
    pose: knightPose,
  },
  x3_straight: {
    name: 'bug',
    frame: [24, 16, 1000, 1008],
    edge: 950,
    parts: [
      { name: 'head', at: [190, 356], size: [633, 635], pivot: [450, 950], clip: true },
      { name: 'antL', at: [24, 248], size: [339, 293], pivot: [350, 465], parent: 'head' },
      { name: 'antM', at: [372, 16], size: [259, 445], pivot: [428, 452], parent: 'head' },
      { name: 'antR', at: [506, 152], size: [289, 282], pivot: [522, 428], parent: 'head' },
      { name: 'pupilL', at: [346, 820], size: [38, 56], pivot: [364, 848], parent: 'head', clip: true },
      { name: 'pupilR', at: [614, 764], size: [39, 58], pivot: [633, 792], parent: 'head', clip: true },
      { name: 'legs', at: [28, 598], size: [969, 409], pivot: [512, 950] },
      { name: 'staff', at: [752, 108], size: [272, 883], pivot: [810, 770], clip: true },
    ],
    acts: { hmph: BUG_HMPH },
    pose: bugPose,
  },
  x3_pairs: {
    name: 'pair',
    frame: [25, 226, 989, 798],
    edge: 905,
    parts: [
      { name: 'tall', at: [24, 226], size: [622, 720], pivot: [300, 905], clip: true },
      { name: 'kid', at: [536, 474], size: [478, 472], pivot: [780, 905], clip: true },
      { name: 'kidL', at: [652, 686], size: [32, 55], pivot: [670, 716], parent: 'kid', clip: true },
      { name: 'kidR', at: [826, 726], size: [27, 54], pivot: [842, 752], parent: 'kid', clip: true },
      { name: 'gear', at: [24, 796], size: [975, 184], pivot: [512, 905] },
    ],
    acts: { leap: PAIR_LEAP },
    pose: pairPose,
  },
  x3_trips: {
    name: 'trio',
    frame: [37, 7, 950, 1017],
    edge: 958,
    parts: [
      { name: 'top', at: [124, 6], size: [673, 613], pivot: [540, 560], parent: 'mid' },
      { name: 'mid', at: [312, 480], size: [426, 379], pivot: [540, 790], parent: 'bot' },
      { name: 'bot', at: [288, 680], size: [516, 319], pivot: [560, 958], clip: true },
      { name: 'gear', at: [36, 476], size: [951, 523], pivot: [512, 958] },
    ],
    acts: { teeter: TRIO_TEETER },
    pose: trioPose,
  },
  joker: {
    name: 'skull',
    frame: [18, 60, 986, 868], // the peeking picture's, 96 px higher: the whole skull was drawn in under it
    edge: 803,
    parts: [
      { name: 'cavity', at: [364, 662], size: [518, 240], pivot: [520, 803], parent: 'head', clip: true },
      { name: 'jaw', at: [362, 688], size: [538, 238], pivot: [870, 650], parent: 'head', clip: true },
      { name: 'head', at: [16, 56], size: [923, 711], pivot: [520, 803], clip: true },
      { name: 'star', at: [346, 362], size: [117, 131], pivot: [404, 428], parent: 'head' },
      { name: 'iris', at: [616, 488], size: [207, 116], pivot: [720, 546], parent: 'head' },
      { name: 'handL', at: [16, 670], size: [450, 178], pivot: [200, 803] },
      { name: 'handR', at: [678, 674], size: [330, 170], pivot: [840, 803] },
    ],
    acts: { cackle: SKULL_CACKLE },
    pose: skullPose,
  },
  refund: {
    name: 'bird',
    frame: [0, 224, 1011, 800],
    edge: 881,
    parts: [
      { name: 'crest', at: [22, 320], size: [352, 247], pivot: [355, 430], parent: 'head' },
      { name: 'head', at: [180, 224], size: [818, 698], pivot: [560, 881], clip: true },
      { name: 'beak', at: [640, 780], size: [371, 182], pivot: [560, 881], parent: 'head' }, // over the edge, uncut
      { name: 'earring', at: [406, 418], size: [110, 134], pivot: [455, 418], parent: 'head' },
      { name: 'gear', at: [0, 542], size: [1005, 449], pivot: [512, 881] },
      { name: 'glint', at: [218, 680], size: [104, 121], pivot: [268, 742] },
    ],
    acts: { count: BIRD_COUNT },
    pose: birdPose,
  },
};

const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const live = new Set();
const images = {};
let urlOf = () => null;
let busy = () => false; // the dice being thrown or counted
let raf = 0;
let calm = 0; // the drawing (on the page's count) before which no card starts a turn
let lastTap = -Infinity;
if (typeof addEventListener === 'function') {
  for (const type of ['pointerdown', 'keydown']) addEventListener(type, () => { lastTap = performance.now(); }, { capture: true, passive: true });
}

export function setupPuppets(urls, isBusy) {
  urlOf = urls;
  if (isBusy) busy = isBusy;
}

// A turn from drawing turn.k0 (on a beat): two beats of the bounce, or the act turn.act; then it lands on the next
// beat's squash, settles halfway and rests, the picture as drawn ({}: every part at rest).
export const TURN = 2 * BEAT + 2;
export function turnPose(c, turn, k) {
  const e = k - turn.k0;
  if (e < 0 || e >= TURN) return {};
  if (e < 2 * BEAT) return c.pose(k, turn.act ? { name: turn.act, e, dir: turn.dir } : null);
  const land = c.pose(turn.k0 + 2 * BEAT, null);
  return e === 2 * BEAT ? land : toward(land, 0.5);
}
// A pose `f` of the way from rest.
const toward = (bones, f) => Object.fromEntries(Object.entries(bones).map(([part, b]) => [part,
  Object.fromEntries(Object.entries(b).map(([key, v]) => [key, key === 'sx' || key === 'sy' ? 1 + (v - 1) * f : v * f]))]));

function load(kind) {
  const c = CHARACTERS[kind];
  if (!images[kind]) {
    images[kind] = Promise.all(c.parts.map((p) => new Promise((ok, fail) => {
      const im = new Image();
      im.onload = () => ok([p.name, im]);
      im.onerror = fail;
      im.src = urlOf(c.name, p.name);
    }))).then(Object.fromEntries);
  }
  return images[kind];
}

// The parts scaled once to the size they are drawn at (device px a drawing unit), halving first: no engine's
// default filter aliases them.
export function prescale(imgs, parts, scale) {
  const out = {};
  for (const p of parts) {
    let src = imgs[p.name];
    let w = src.naturalWidth || src.width;
    let h = src.naturalHeight || src.height;
    const tw = Math.max(1, Math.round(p.size[0] * scale));
    const th = Math.max(1, Math.round(p.size[1] * scale));
    while (w / 2 >= tw) {
      const c = document.createElement('canvas');
      c.width = Math.round(w / 2);
      c.height = Math.round(h / 2);
      const x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.drawImage(src, 0, 0, c.width, c.height);
      src = c;
      w = c.width;
      h = c.height;
    }
    const c = document.createElement('canvas');
    c.width = tw;
    c.height = th;
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, tw, th);
    out[p.name] = c;
  }
  return out;
}

// The drawing's place on a card w × h px whose picture box (.art) is at left, top, aw × ah, moved down by drop px:
// the view in drawing units that the whole card shows, and px a unit.
export function cardView(c, { w, h, left, top, aw, ah, drop }) {
  const [fx, fy, fw, fh] = c.frame;
  const s = Math.min(aw / fw, ah / fh);
  const ox = left + (aw - fw * s) / 2;
  const oy = top + drop + ah - fh * s;
  return { view: [fx - ox / s, fy - oy / s, w / s, h / s], s };
}

// Gives the picture in `art` (a card's .art) its puppet, or takes it away (kind without one, or null).
export function animateArt(art, kind) {
  if (!art || art.dataset.puppet === (kind || '')) return;
  art.querySelector('canvas')?.remove();
  art.classList.remove('live');
  const c = CHARACTERS[kind];
  const ready = Boolean(c && urlOf(c.name, c.parts[0].name));
  art.dataset.puppet = ready ? kind : ''; // no parts to reach yet (the stylesheet still loading): the next call tries again
  if (!ready) return;
  const canvas = document.createElement('canvas');
  load(kind).then((imgs) => {
    if (art.dataset.puppet !== kind) return; // the card changed while the parts loaded
    art.append(canvas);
    art.classList.add('live');
    live.add({ art, canvas, c, imgs, phase: 2 * Math.floor(Math.random() * 4), turn: null, turns: 0, next: null, drawn: null, size: '' });
    if (!raf) raf = requestAnimationFrame(frame);
  }).catch(() => {}); // parts that fail to load leave the drawn picture
}

// Lays a character's canvas over the whole card of its .art (layout sizes: a tap's scale is not layout) at the
// screen's full resolution and gives it its puppet; pose(k) gives the bones of drawing k.
export function layPuppet(art, canvas, c, imgs, pose) {
  const card = art.offsetParent;
  const dpr = devicePixelRatio || 1;
  const w = card.clientWidth;
  const h = card.clientHeight;
  const t = getComputedStyle(art).transform;
  const drop = t && t !== 'none' ? new DOMMatrixReadOnly(t).m42 : 0;
  const { view, s } = cardView(c, { w, h, left: art.offsetLeft, top: art.offsetTop, aw: art.offsetWidth, ah: art.offsetHeight, drop });
  Object.assign(canvas.style, { left: `${-art.offsetLeft}px`, top: `${-art.offsetTop - drop}px`, width: `${w}px`, height: `${h}px` });
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const puppet = createPuppet(canvas, { ...c, view }, prescale(imgs, c.parts, (canvas.width / w) * s), pose);
  canvas.getContext('2d').imageSmoothingQuality = 'high';
  return puppet;
}

// Lays the card's canvas anew when the card's size or the screen's resolution changed. True when it did.
function fit(p) {
  const card = p.art.offsetParent;
  if (!card) return false;
  const size = `${card.clientWidth}x${card.clientHeight}@${devicePixelRatio || 1}`;
  if (size === p.size) return false;
  p.size = size;
  p.puppet = layPuppet(p.art, p.canvas, p.c, p.imgs, (k) => (p.turn ? turnPose(p.c, p.turn, k) : {}));
  return true;
}

const wait = ([lo, hi]) => Math.round((lo + Math.random() * (hi - lo)) * D);

// The card that has waited longest since its rest ended takes the next turn, on its beat, if no other card has
// moved for GAP seconds, the dice are still and nothing was tapped for CALM seconds; every other turn is its act.
function cue(seen, d, now) {
  let up = null;
  for (const p of seen) {
    const k = d + p.phase;
    if (p.next == null) p.next = k + wait(FIRST);
    if (!p.turn && k >= p.next && (!up || p.next - p.phase < up.next - up.phase)) up = p;
  }
  if (!up || d < calm || now - lastTap < CALM * 1000 || busy()) return;
  const k = d + up.phase;
  if (mod(k, BEAT)) return; // it waits for its beat
  const acts = Object.keys(up.c.acts);
  up.turn = { k0: k, act: up.turns++ % 2 ? acts[Math.floor(Math.random() * acts.length)] : null, dir: Math.random() < 0.5 ? -1 : 1 };
  up.next = k + TURN + wait(REST);
  calm = d + TURN + GAP * D;
}

// How the card itself moves with its character's victory act (GPT's spec): keys at drawings 1..16 of
// [drawing, dx px, dy px, rotate°, scale x, scale y] at the phone's card size, held between drawings like the act.
// The trio's card also rocks against its top head (cardRock).
export const WIN_CARD = {
  x2_any: [[1, 0, 0, 0, 1, 1], [6, 0, -9, -1.5, 1.06, 1.06], [7, 0, -9, -1.5, 1.06, 1.06], [16, 0, 0, 0, 1, 1]],
  x3_straight: [[1, 0, 0, 0, 1, 1], [5, 0, -7, -2, 1, 1], [6, 0, -7, -2, 1, 1], [7, 0, -3, 0, 1.035, 0.97], [8, 0, -3, 0, 1, 1], [16, 0, 0, 0, 1, 1]],
  x3_pairs: [[1, 0, 0, 0, 1, 1], [5, 0, -8, 2, 1, 1], [6, 0, -8, 2, 1, 1], [16, 0, 0, 0, 1, 1]],
  x3_trips: [[1, 0, 0, 0, 1, 1], [7, 0, -8, 0, 1, 1], [8, 0, -8, 0, 1, 1], [16, 0, 0, 0, 1, 1]],
  joker: [[1, 0, 0, 0, 1, 1], [5, 0, -9, 3, 1, 1], [6, 0, -9, 3, 1, 1], [7, 0, -8, -2, 1, 1], [16, 0, 0, 0, 1, 1]],
  refund: [[1, 0, 0, 0, 1, 1], [5, 3, -7, 2.5, 1.045, 1.045], [6, 3, -7, 2.5, 1.045, 1.045], [16, 0, 0, 0, 1, 1]],
};
export const cardRock = (kind, d) => (kind === 'x3_trips' ? -Math.max(-2.5, Math.min(2.5, TRIO_WIN[d - 1][2] / 8)) : 0);
// The two cards in the paired act follow their characters: rise 0.14 of the character's, tilt 0.55 of its lean (the
// ratios of GPT's first design), never sink. Written for the knight left of the skull; the caller mirrors the tilt.
export const WIN_CARD_PAIR = {
  x2_any: [[1, 0, 0, -0.55, 1, 1], [2, 0, 0, -1.1, 1, 1], [3, 0, -2.5, 1.1, 1.017, 1.017], [4, 0, -7.3, 2.48, 1.049, 1.049],
    [5, 0, -7.3, 2.48, 1.049, 1.049], [6, 0, -6.2, 1.65, 1.041, 1.041], [7, 0, -4.2, 0.83, 1.028, 1.028], [8, 0, -2.2, 0.28, 1.015, 1.015],
    [9, 0, 0, -0.28, 1, 1], [10, 0, 0, 0, 1, 1], [11, 0, -0.6, 0.28, 1.004, 1.004], [12, 0, 0, 0, 1, 1], [16, 0, 0, 0, 1, 1]],
  joker: [[1, 0, 0, 0.55, 1, 1], [2, 0, 0, 1.1, 1, 1], [3, 0, -2.2, 0, 1.015, 1.015], [4, 0, -5, -1.93, 1.033, 1.033],
    [5, 0, -6.7, -2.75, 1.045, 1.045], [6, 0, -7.6, -3.03, 1.051, 1.051], [8, 0, -7.6, -3.03, 1.051, 1.051], [9, 0, -5, -2.2, 1.033, 1.033],
    [10, 0, -3.4, -1.38, 1.023, 1.023], [11, 0, -1.7, -0.55, 1.011, 1.011], [12, 0, 0, 0, 1, 1], [13, 0, 0, 0.28, 1, 1], [14, 0, 0, 0, 1, 1], [16, 0, 0, 0, 1, 1]],
};
// The skull answers this many ms after the knight starts: its bow then holds three drawings before the black comes.
export const PAIR_SKULL_START = 42;

// The level is won (owner's pick В11 A, 04.11.2026): the card's character plays its victory act at once, off the
// beat, then lands and rests; the other cards keep still for a while. False when the card has no puppet yet.
// act 'pair' with dir 1 or -1 is the knight's and the skull's paired act (1: the skull sits right of the knight).
export function cheer(art, act = 'win', dir = 1) {
  const p = [...live].find((q) => q.art === art);
  if (!p || still) return false;
  const d = Math.floor((performance.now() / 1000) * D);
  p.turn = { k0: d + p.phase, act, dir };
  p.next = p.turn.k0 + TURN + wait(REST);
  p.drawn = null;
  calm = d + TURN + GAP * D;
  if (!raf) raf = requestAnimationFrame(frame);
  return true;
}

function frame(now) {
  raf = 0;
  const d = Math.floor((now / 1000) * D);
  const seen = [];
  for (const p of live) {
    if (!p.canvas.isConnected) { live.delete(p); continue; }
    const r = p.canvas.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > innerHeight) continue; // hidden or out of sight
    if (fit(p)) p.drawn = null;
    if (p.turn && d + p.phase - p.turn.k0 >= TURN) p.turn = null;
    seen.push(p);
  }
  const open = document.querySelectorAll('.overlay:not([hidden])'); // screens over the board: the later one on top,
  const over = document.querySelector('.sheet-up:not([hidden])') || open[open.length - 1]; // the bonus sheet over all
  if (!still) cue(over ? seen.filter((p) => over.contains(p.canvas)) : seen, d, now); // only its cards take turns
  for (const p of seen) {
    const k = d + p.phase;
    const drawing = p.turn ? k : 'rest';
    if (drawing === p.drawn) continue; // the drawing is held, or the card rests
    p.drawn = drawing;
    p.puppet.draw(k);
  }
  if (live.size && (!still || [...live].some((p) => p.drawn == null))) raf = requestAnimationFrame(frame); // still: each drawn once
}
