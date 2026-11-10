// The leaderboard (questionnaire В3 A, В4 A, 04.11.2026): Playgama's Bridge SaaS leaderboard, ranked by the furthest
// level, ties by the run's points. A score there is one whole number, so a run packs into it as level · 10⁷ + points.
// Until the game is released on Playgama there is no shared table (`bridge.leaderboards.type` is `not_available`
// outside it, and the Bridge script only ships in the Playgama build): the screen shows the best runs on this device.
// The table around the player, not a top 100 (digest rule 22: low places in a global table demotivate).

import { platformBridge } from './platform.js';

export const BOARD_ID = 'furthest_level';
const STEP = 1e7;
export const RUNS_KEPT = 5; // the best runs a device keeps

export const packRun = (level, points) => level * STEP + Math.min(Math.max(0, Math.round(points)), STEP - 1);
export const unpackRun = (score) => ({ level: Math.floor(score / STEP), points: score % STEP });

// The list of a device's best runs with this run in it: furthest level, then points; newest first among equals.
export function withRun(runs, run) {
  const better = (a, b) => b.level - a.level || b.score - a.score;
  return [run, ...runs].sort(better).slice(0, RUNS_KEPT);
}

// The rows to show: the player and `reach` places either side, the leader kept on top (rule 22: neighbours and a fixed
// goal). Rows come in rank order.
export function around(entries, id, reach = 2) {
  const at = entries.findIndex((e) => e.id === id);
  if (at < 0) return entries.slice(0, 2 * reach + 1);
  const from = Math.max(0, Math.min(at - reach, entries.length - (2 * reach + 1)));
  const near = entries.slice(from, from + 2 * reach + 1);
  return from > 0 ? [entries[0], ...near] : near;
}

let api = null;
let me = null;

// The Bridge once platform.js has it ready (the Playgama build, its script first in <head>); a page without it, or a
// platform with no table, plays on with the device's runs.
export function setupBoard() {
  const bridge = platformBridge();
  if (!bridge) return;
  try {
    if (bridge.leaderboards.type === 'in_game') { api = bridge.leaderboards; me = bridge.player.id; }
  } catch { api = null; }
}

export const hasBoard = () => !!api;
export const submitRun = (level, points) => (api ? api.setScore(BOARD_ID, packRun(level, points)).catch(() => {}) : Promise.resolve());

// The rows around the player, or null when the table cannot be read.
export async function fetchBoard() {
  if (!api) return null;
  try {
    const rows = await api.getEntries(BOARD_ID);
    const list = rows.map((e) => ({ id: e.id, name: e.name, rank: e.rank, ...unpackRun(Number(e.score)) }));
    return around(list, me).map((e) => ({ ...e, me: e.id === me }));
  } catch { return null; }
}
