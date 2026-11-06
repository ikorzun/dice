// The act strip (owner's pick В13 A «Акты по пять уровней», 05.11.2026; GPT's production spec,
// art/ai/2026-11-05-acts-production): the five levels of the current act, the fifth a bigger seal where the medal is,
// and where the record stands (digest rule 18: the gap said plainly). The act's second and fourth nodes are doors,
// where a shop opens after the level; the seal says BOSS (GPT's spec, art/ai/2026-11-06-shop-bosses). Worked out from
// the level and the record alone, so a reload draws it as it was.

const ACT = 5;

// level: the level played or just cleared (cleared: true); best: the record, { level } or null.
export function actOf(level, { cleared = false, best = null } = {}) {
  const first = Math.floor((level - 1) / ACT) * ACT + 1;
  const seal = first + ACT - 1;
  const state = (n) => (n < level || (n === level && cleared) ? 'done' : n === level ? 'current' : 'upcoming');
  const nodes = Array.from({ length: ACT - 1 }, (_, k) => state(first + k));
  const sealState = state(seal) === 'done' ? 'cleared' : state(seal);
  // the record: on its node inside the act; past the act, its level and how far; gone once passed
  const reach = cleared ? level + 1 : level;
  const inAct = !!best && best.level >= reach && best.level <= seal;
  const far = !!best && best.level > seal;
  const record = inAct ? { at: best.level - first } : far ? { level: best.level, gap: best.level - level } : null;
  const gap = best ? best.level - level : 0;
  const label = `Levels ${first} to ${seal}. Level ${level} ${cleared ? 'cleared' : 'current'}. Boss and medal at ${seal}.${record ? ` Best ${best.level}${gap ? `, ${gap} level${gap > 1 ? 's' : ''} away` : ''}.` : ''}`;
  return { first, seal, nodes, sealState, record, label };
}

const NODE = '<circle class="ring" cx="6" cy="6" r="4.75"/><circle class="disc" cx="6" cy="6" r="5.2"/><circle class="dot" cx="6" cy="6" r="2.25"/><path class="tick" d="M3.1 6.1 L5.15 8.05 L9.05 3.75"/>';
const DOOR = NODE.replace('<circle class="ring" cx="6" cy="6" r="4.75"/>', '<path class="ring" d="M2 11 V5.4 a4 4 0 0 1 8 0 V11 Z"/>').replace('<circle class="disc" cx="6" cy="6" r="5.2"/>', '<path class="disc" d="M1.4 11.6 V5.4 a4.6 4.6 0 0 1 9.2 0 V11.6 Z"/>');
const SEAL = '<circle class="disc" cx="18" cy="18" r="17.2"/><path class="seams" d="M18 0 L16 9 M36 15 L27 17 M30 33 L24 26 M6 33 L12 26 M0 15 L9 17 M18 36 L19 29"/>'; // the medal's seams

export function actHtml({ seal, nodes, sealState, record }) {
  const links = (k) => `<i class="act-link${(nodes[k + 1] || (sealState === 'cleared' ? 'done' : '')) === 'done' ? ' on' : ''}"></i>`; // white up to a done node
  const door = (k) => k === 1 || k === 3; // the shops after the act's second and fourth levels
  const row = nodes.map((s, k) => `<svg class="act-node ${s}${door(k) ? ' door' : ''}" viewBox="0 0 12 12" aria-hidden="true">${door(k) ? DOOR : NODE}</svg>${links(k)}`).join('');
  const best = !record ? ''
    : record.at == null ? `<span class="act-best far">BEST ${record.level} <i>+${record.gap}</i></span>`
      : `<span class="act-best${record.at === nodes.length ? ' on-seal' : ''}" style="--i: ${record.at}">BEST</span>`;
  return `${row}<span class="act-seal ${sealState}"><svg viewBox="0 0 36 36" aria-hidden="true">${SEAL}</svg><i>BOSS</i><b>${seal}</b></span>${best}`;
}
