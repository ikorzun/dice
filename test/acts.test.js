import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actOf, actHtml } from '../src/ui/acts.js';

test('an act is five levels, restarting after every fifth', () => {
  assert.deepEqual([actOf(1).first, actOf(1).seal], [1, 5]);
  assert.deepEqual([actOf(5).first, actOf(5).seal], [1, 5]);
  assert.deepEqual([actOf(6).first, actOf(6).seal], [6, 10]);
  assert.deepEqual([actOf(123).first, actOf(123).seal], [121, 125]);
});

test('nodes: done, current, upcoming; the fifth level is the current seal', () => {
  assert.deepEqual(actOf(3).nodes, ['done', 'done', 'current', 'upcoming']);
  assert.equal(actOf(3).sealState, 'upcoming');
  assert.deepEqual(actOf(5).nodes, ['done', 'done', 'done', 'done']);
  assert.equal(actOf(5).sealState, 'current');
  assert.deepEqual(actOf(6).nodes, ['current', 'upcoming', 'upcoming', 'upcoming']);
});

test('a cleared level is done; a cleared fifth level is the earned seal', () => {
  assert.deepEqual(actOf(3, { cleared: true }).nodes, ['done', 'done', 'done', 'upcoming']);
  assert.equal(actOf(5, { cleared: true }).sealState, 'cleared');
});

test('the record: on its node in the act, its level and gap past the act, gone once passed, none without one', () => {
  assert.deepEqual(actOf(7, { best: { level: 8 } }).record, { at: 2 });
  assert.deepEqual(actOf(7, { best: { level: 7 } }).record, { at: 1 });
  assert.deepEqual(actOf(7, { best: { level: 10 } }).record, { at: 4 });
  assert.deepEqual(actOf(7, { best: { level: 18 } }).record, { level: 18, gap: 11 });
  assert.equal(actOf(7, { best: { level: 6 } }).record, null);
  assert.equal(actOf(7).record, null);
});

test('clearing the record level passes it', () => {
  assert.equal(actOf(7, { cleared: true, best: { level: 7 } }).record, null);
  assert.deepEqual(actOf(7, { cleared: true, best: { level: 8 } }).record, { at: 2 });
});

test('the label says it in one line, the record only when it shows', () => {
  assert.equal(actOf(7, { best: { level: 18 } }).label, 'Levels 6 to 10. Level 7 current. Medal at 10. Best 18, 11 levels away.');
  assert.equal(actOf(1).label, 'Levels 1 to 5. Level 1 current. Medal at 5.');
  assert.equal(actOf(7, { best: { level: 6 } }).label, 'Levels 6 to 10. Level 7 current. Medal at 10.');
});

test('the strip shows no lime and no boss: four nodes, a numbered seal, links white up to a done node', () => {
  const html = actHtml(actOf(3));
  assert.equal(html.match(/class="act-node /g).length, 4);
  assert.equal(html.match(/act-link on/g).length, 1); // node 2 is done, so the link before it is white
  assert.match(html, /<b>5<\/b>/);
  assert.doesNotMatch(html, /BOSS|SHOP|bbf350/);
  assert.match(actHtml(actOf(7, { best: { level: 18 } })), /BEST 18 <i>\+11<\/i>/);
  assert.match(actHtml(actOf(7, { best: { level: 10 } })), /on-seal/);
});
