// Fire on the dice of a strong hand (four of a kind, five of a kind, straight; owner, 01.11.2026): a WebGL
// fragment shader in one canvas laid over the board, like the 3D dice. Drawn in the style of the game's
// illustrations (owner): flat bands from the art palette, no outline (owner) and no glow.
// Rising, domain-warped fbm noise is cut into tongues by each die's rounded-square distance: they lap over
// the die's edges and rise from it, tapering by themselves (never cut, even past the screen edge; the
// canvas leaves room and only fades at its own border as a safety net); flat embers rise and fade.
// Every frame reads the dice's live boxes and opacity, so the fire shrinks away with them when the hand
// burns. No three.js: plain WebGL 1. Without WebGL the dice glow instead (body.fire-fallback, CSS).

const MAX_DICE = 9;
const IGNITE_S = 0.25;   // the fire grows on the dice this long
const MAX_PIXELS = 9e5;  // the canvas resolution is capped: soft fire needs no retina pixels
const FLARE = [90, 220, 0.25]; // a flare: up over 90 ms, back by 220 ms, a quarter past full (the won level's PLAY)

const VERT = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }';
const frag = (derivatives) => `${derivatives ? '#extension GL_OES_standard_derivatives : enable' : '#define fwidth(x) 0.02'}
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform float uTime;           // seconds since ignition
uniform float uCell;           // a die's side at ignition (canvas px): the scale of the noise
uniform vec2 uRes;             // the canvas size (px)
uniform vec4 uDie[${MAX_DICE}]; // centre x, y (canvas px, y up), half side (px), strength 0..1
uniform int uCount;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + vec2(3.1, 1.7); a *= 0.5; }
  return v;
}
float fbm3(vec2 p) { return 0.57 * noise(p) + 0.29 * noise(p * 2.02 + vec2(3.1, 1.7)) + 0.14 * noise(p * 4.1 + vec2(1.3, 7.9)); }
float sdRound(vec2 q, float h, float r) { vec2 d = abs(q) - vec2(h - r); return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
vec2 hash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }

void main() {
  float t = uTime;
  vec2 p = gl_FragCoord.xy / uCell;                              // die sides, y up
  vec2 np = vec2(p.x * 2.6, p.y * 1.7 - t * 1.4);
  vec2 w = vec2(fbm(np * 0.7 + vec2(0.0, t * 0.5)), fbm(np * 0.7 + vec2(4.3, 2.1) - vec2(0.0, t * 0.3)));
  // tongues: a fast, warped noise; where it is low the flame is eaten away
  float n = smoothstep(0.22, 0.78, fbm(vec2(p.x * 4.0, p.y * 1.3 - t * 2.0) + 1.8 * w - vec2(0.0, t * 0.6)));
  float flame = -1.0, ember = -1.0, own = -1.0, dmin = 1e3;
  for (int i = 0; i < ${MAX_DICE}; i++) {
    if (i >= uCount) break;
    vec4 die = uDie[i];
    vec2 q = (gl_FragCoord.xy - die.xy) / max(2.0 * die.z, 1.0); // the die is [-0.5, 0.5]^2
    float d = sdRound(q, 0.5, 0.255);                             // > 0 outside
    // tall above, up the sides, a lick below; they lap over the edge (the pips stay clear) and taper
    float reach = 0.1 + 0.42 * smoothstep(-0.3, 1.0, q.y);
    float s = (1.0 - max(d, 0.0) / reach) * smoothstep(-0.16, -0.02, d);
    float f = 1.35 * s - (1.0 - n) * (0.75 + 0.6 * clamp(q.y - 0.3, 0.0, 1.0));
    f = f * die.w - (1.0 - die.w) * 0.6;                           // dying down: the shape shrinks
    flame = max(flame, f);
    if (d < 0.0) own = f;                                          // the die this pixel is on
    dmin = min(dmin, d);
    vec2 e = vec2(q.x * 7.0, q.y * 5.0 - t * 2.2 + float(i) * 3.7); // embers: one or none per grid cell, rising
    vec2 h = hash2(floor(e) + float(i) * 17.0);
    vec2 c = fract(e) - (0.2 + 0.6 * h) - vec2(0.15 * sin(t * 3.0 + h.x * 6.28), 0.0);
    float rise = q.y - 0.45;
    float live = step(0.75, h.y) * step(0.02, rise) * step(rise, 0.9) * step(abs(q.x), 0.6) * step(0.3, die.w);
    ember = max(ember, (0.14 * (1.0 - rise) - length(c * vec2(1.0, 0.7))) * live - (1.0 - live));
  }
  // a die stands in front of the flames rising behind it: on its face only its own flames lap
  if (dmin < 0.0) flame = own;
  // flat bands from the art palette, cut crisply, with no outline (owner, 01.11.2026)
  float px = max(fwidth(flame), 1e-4);
  vec3 col = vec3(0.992, 0.306, 0.235);                                                   // red #fd4e3c
  col = mix(col, vec3(1.0, 0.478, 0.102), clamp((flame - 0.3) / px + 0.5, 0.0, 1.0));    // orange #ff7a1a
  col = mix(col, vec3(1.0, 0.714, 0.153), clamp((flame - 0.58) / px + 0.5, 0.0, 1.0));   // amber #ffb627
  col = mix(col, vec3(1.0, 0.914, 0.659), clamp((flame - 0.86) / px + 0.5, 0.0, 1.0));   // cream #ffe9a8
  float a = clamp(flame / px + 0.5, 0.0, 1.0);
  float ea = clamp(ember / max(fwidth(ember), 1e-4) + 0.5, 0.0, 1.0) * (1.0 - a) * step(0.0, dmin);
  vec3 C = col * a + vec3(1.0, 0.918, 0.227) * ea;                                        // yellow #ffea3a
  float A = a + ea;
  // a safety net only: the canvas is roomy enough that no flame reaches its border
  vec2 m = min(gl_FragCoord.xy, uRes - gl_FragCoord.xy) / (0.15 * uCell);
  gl_FragColor = vec4(C, A) * smoothstep(0.0, 1.0, min(m.x, m.y));
}`;

// The fire layer for `board`. ignite(cells) sets those cell elements on fire, out() puts it out at once
// (call it when the dice have burnt away), burning() lists the burning cells' indexes.
export function createFire(board) {
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let gl = null;
  let canvas = null;
  let failed = false;
  let uniforms = null;
  let cells = [];
  let started = 0;
  let flared = -1e9; // when the last flare began
  let raf = 0;
  const data = new Float32Array(MAX_DICE * 4);

  function setup() {
    canvas = document.createElement('canvas');
    canvas.className = 'fire-layer';
    gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return false;
    const derivatives = !!gl.getExtension('OES_standard_derivatives');
    if (!gl) return false;
    const shader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = shader(gl.VERTEX_SHADER, VERT);
    const fs = shader(gl.FRAGMENT_SHADER, frag(derivatives));
    if (!vs || !fs) return false;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one triangle covers the canvas
    const a = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    uniforms = { time: gl.getUniformLocation(prog, 'uTime'), cell: gl.getUniformLocation(prog, 'uCell'), res: gl.getUniformLocation(prog, 'uRes'), die: gl.getUniformLocation(prog, 'uDie'), count: gl.getUniformLocation(prog, 'uCount') };
    return true;
  }

  // The canvas covers the board plus room for the flames (they rise up to ~0.8 of a die and may leave
  // the screen; the page does not scroll, html and body hide overflow): 1.4 dice above, 0.7 at the sides.
  function place() {
    const b = board.getBoundingClientRect();
    const cell = cells[0].getBoundingClientRect().width;
    const box = { left: -0.7 * cell, top: -1.4 * cell, width: b.width + 1.4 * cell, height: b.height + 1.75 * cell };
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(MAX_PIXELS / (box.width * box.height)));
    Object.assign(canvas.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`, display: 'block' });
    canvas.width = Math.round(box.width * ratio);
    canvas.height = Math.round(box.height * ratio);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uniforms.cell, cell * ratio);
    gl.uniform2f(uniforms.res, canvas.width, canvas.height);
  }

  function frame(now) {
    const t = (now - started) / 1000;
    const box = canvas.getBoundingClientRect();
    const k = canvas.width / box.width;
    const since = now - flared; // a flare: past full strength the flames grow taller and hotter, then settle
    const boost = reduce || since > FLARE[1] ? 1 : 1 + FLARE[2] * (since < FLARE[0] ? since / FLARE[0] : 1 - (since - FLARE[0]) / (FLARE[1] - FLARE[0]));
    const grow = (reduce ? 1 : Math.min(1, t / IGNITE_S)) * boost;
    data.fill(0);
    cells.forEach((c, i) => {
      const r = c.getBoundingClientRect();
      const strength = grow * Number(getComputedStyle(c).opacity);
      data.set([(r.left + r.width / 2 - box.left) * k, (box.bottom - r.top - r.height / 2) * k, (r.width / 2) * k, strength], i * 4);
    });
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uniforms.time, reduce ? 0.6 : t); // less motion: the flames hold still
    gl.uniform4fv(uniforms.die, data);
    gl.uniform1i(uniforms.count, cells.length);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  }

  function ignite(list) {
    if (raf && list.length === cells.length && list.every((c) => cells.includes(c))) return; // already burning
    out();
    cells = list.slice(0, MAX_DICE);
    cells.forEach((c) => c.classList.add('on-fire'));
    if (!failed && !gl) failed = !setup();
    if (failed) {
      document.body.classList.add('fire-fallback');
      return;
    }
    if (!canvas.isConnected) board.appendChild(canvas); // the board is rebuilt between runs
    place();
    started = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function out() {
    cancelAnimationFrame(raf);
    raf = 0;
    cells.forEach((c) => c.classList.remove('on-fire'));
    cells = [];
    if (canvas) canvas.style.display = 'none';
  }

  return { ignite, out, flare: () => { flared = performance.now(); }, burning: () => cells.map((c) => Number(c.dataset.index)) };
}
