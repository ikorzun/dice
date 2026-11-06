import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { ladder, chord, string, RING_STEP, SOUNDS } from '../src/ui/sound.js';

test('one note per die on the 83 ms grid, each higher and louder than the last', () => {
  const notes = ladder(5);
  assert.equal(notes.length, 5);
  notes.forEach((v, k) => assert.equal(v.at, k * RING_STEP));
  for (let k = 1; k < 5; k++) {
    assert.ok(notes[k].semis > notes[k - 1].semis);
    assert.ok(notes[k].vol > notes[k - 1].vol);
  }
  assert.ok(Math.abs(notes[0].vol - 0.6) < 1e-9);
  assert.ok(Math.abs(notes[4].vol - 1) < 1e-9);
});

test('a stronger hand answers richer: the bass under its last note, then under every note', () => {
  assert.equal(ladder(3, 0).length, 3);
  assert.equal(ladder(3, 1).length, 4);
  assert.equal(ladder(3, 2).length, 6);
  const last = ladder(3, 1);
  assert.equal(last[3].semis, last[2].semis - 12);
});

test('every ladder note comes from a string of its own or one close by, never stretched', () => {
  for (const v of [...ladder(7, 2), ...chord(5)]) {
    const { rate } = string(v.semis);
    assert.ok(rate >= 0.74 && rate <= 1.7, `note ${v.semis} rate ${rate}`);
  }
  for (const v of ladder(3)) assert.equal(string(v.semis).rate, 1); // G4, A4, B4 are sampled as themselves
  assert.deepEqual(string(0), { name: 'lute-c5', rate: 1 });
  assert.equal(string(2).name, 'lute-d5');
});

test('the chord rolls upward from the bare fifth; a stronger hand adds the third and the top', () => {
  assert.deepEqual(chord(3).map((v) => v.semis), [-12, -5, 0]);
  assert.deepEqual(chord(5).map((v) => v.semis), [-12, -5, 0, 4, 7]);
  chord(5).forEach((v, k) => assert.ok(Math.abs(v.at - k * 0.045) < 1e-9));
});

test('every sound has its file and its address in the stylesheet: a missing one stays silent without a word', () => {
  const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
  for (const name of SOUNDS) {
    assert.ok(existsSync(new URL(`../assets/sfx/${name}.mp3`, import.meta.url)), name);
    assert.ok(css.includes(`--sfx-${name}:`), name);
  }
});
