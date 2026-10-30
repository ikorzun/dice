// Deterministic, seedable PRNG (sfc32) with exactly uniform die rolls (rejection sampling).
// Seeds are strings or numbers, hashed with cyrb53-style mixing. Used for level generation,
// rerolls and simulations so that every board can be reproduced from its seed.

export function hashSeed(input, salt = 0) {
  const str = String(input);
  let h1 = 0xdeadbeef ^ salt;
  let h2 = 0x41c6ce57 ^ salt;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h1 >>> 0, h2 >>> 0];
}

const TWO_32 = 4294967296;
const DIE_LIMIT = Math.floor(TWO_32 / 6) * 6; // rejection bound: faces are exactly equiprobable

export function createRng(seed) {
  const key = String(seed);
  const [a0, b0] = hashSeed(key, 1);
  const [c0, d0] = hashSeed(key, 2);
  let a = a0 | 0;
  let b = b0 | 0;
  let c = c0 | 0;
  let d = d0 | 0;

  function nextUint32() {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  }
  for (let i = 0; i < 15; i++) nextUint32();

  return {
    seed: key,
    nextUint32,
    next: () => nextUint32() / TWO_32,
    int(n) {
      if (!Number.isInteger(n) || n <= 0) throw new Error('int(n) needs a positive integer');
      const limit = Math.floor(TWO_32 / n) * n;
      let x;
      do x = nextUint32(); while (x >= limit);
      return x % n;
    },
    die() {
      let x;
      do x = nextUint32(); while (x >= DIE_LIMIT);
      return 1 + (x % 6);
    },
    fork: (label) => createRng(`${key}/${label}`),
  };
}
