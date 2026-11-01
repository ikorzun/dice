// Fire on the dice of a strong hand (four of a kind, five of a kind, straight; owner, 01.11.2026): a WebGL
// fragment shader in one canvas laid over the board, like the 3D dice. After the owner's reference video
// the fire lives on the die, in natural colours: warm wisps flow up across the face (the ridges of a
// domain-warped fbm, the pips show through), the outline glows, and tongues of flame rise from the die and
// taper away by themselves (owner: never cut a flame, even past the screen edge; the canvas leaves room
// and only fades at its own border as a safety net). Embers rise and fade, the die lights the board. Every frame reads the dice's live boxes
// and opacity, so the fire shrinks away with them when the hand burns. No three.js: plain WebGL 1.
// Without WebGL the dice glow instead (body.fire-fallback, CSS).

const MAX_DICE = 9;
const IGNITE_S = 0.25;   // the fire grows on the dice this long
const MAX_PIXELS = 9e5;  // the canvas resolution is capped: soft fire needs no retina pixels

const VERT = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }';
const FRAG = `
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
  // the flow every die shares: warped fbm rising; its ridges are the bright wisps
  vec2 np = vec2(p.x * 2.6, p.y * 1.7 - t * 1.4);
  vec2 w = vec2(fbm(np * 0.7 + vec2(0.0, t * 0.5)), fbm(np * 0.7 + vec2(4.3, 2.1) - vec2(0.0, t * 0.3)));
  // wisps: ridges of a smooth noise stretched up, so they run like flame streaks
  float wisp = pow(1.0 - abs(2.0 * fbm3(vec2(p.x * 3.2, p.y * 1.1 - t * 1.5) + 0.9 * w) - 1.0), 3.5);
  float sheet = smoothstep(0.3, 0.75, fbm(np * 0.6 + w - vec2(0.0, t * 0.4)));
  // tongues: a faster, finer warped noise; where it is low the flame is eaten away
  float n = smoothstep(0.22, 0.78, fbm(vec2(p.x * 4.0, p.y * 1.3 - t * 2.0) + 1.8 * w - vec2(0.0, t * 0.6)));
  float flame = 0.0, aGlow = 0.0, aFace = 0.0, aWisp = 0.0, aRim = 0.0, aEmber = 0.0;
  for (int i = 0; i < ${MAX_DICE}; i++) {
    if (i >= uCount) break;
    vec4 die = uDie[i];
    vec2 q = (gl_FragCoord.xy - die.xy) / max(2.0 * die.z, 1.0); // the die is [-0.5, 0.5]^2
    float d = sdRound(q, 0.5, 0.255);                             // > 0 outside
    float inside = smoothstep(0.004, -0.02, d);
    // levels toned down by the owner (01.11.2026): lower flames, softer wisps, rim and glow, fewer embers
    aGlow = max(aGlow, exp(-max(d, 0.0) * 9.0) * step(0.0, d) * 0.3 * die.w);
    aFace = max(aFace, inside * (0.05 + 0.12 * sheet) * die.w);
    aWisp = max(aWisp, inside * wisp * 0.55 * die.w);
    aRim = max(aRim, exp(-abs(d) * 40.0) * (0.35 + 0.35 * sheet) * die.w);
    // tongues: tall above, up the sides, a lick below; they lap over the edge and taper as they rise
    float reach = 0.1 + 0.42 * smoothstep(-0.3, 1.0, q.y);
    float s = (1.0 - max(d, 0.0) / reach) * smoothstep(-0.1, -0.01, d);
    flame = max(flame, (1.35 * s - (1.0 - n) * (0.75 + 0.6 * clamp(q.y - 0.3, 0.0, 1.0))) * die.w);
    vec2 e = vec2(q.x * 7.0, q.y * 5.0 - t * 2.2 + float(i) * 3.7); // embers: one or none per grid cell, rising
    vec2 h = hash2(floor(e) + float(i) * 17.0);
    vec2 c = fract(e) - (0.2 + 0.6 * h) - vec2(0.15 * sin(t * 3.0 + h.x * 6.28), 0.0);
    float rise = q.y - 0.45;
    float live = step(0.75, h.y) * smoothstep(0.0, 0.08, rise) * smoothstep(1.1, 0.4, rise) * step(abs(q.x), 0.6);
    aEmber = max(aEmber, 0.8 * smoothstep(0.2, 0.05, length(c * vec2(1.0, 0.7))) * live * die.w);
  }
  // natural fire colours, layered back to front (premultiplied)
  vec3 C = vec3(0.0);
  float A = 0.0;
  C = vec3(1.0, 0.35, 0.05) * aGlow; A = aGlow;
  C = mix(vec3(1.0, 0.42, 0.06), vec3(1.0, 0.62, 0.15), sheet) * aFace + C * (1.0 - aFace); A = aFace + A * (1.0 - aFace);
  C = mix(vec3(0.95, 0.25, 0.02), vec3(1.0, 0.62, 0.1), wisp * wisp) * aWisp + C * (1.0 - aWisp); A = aWisp + A * (1.0 - aWisp);
  C = vec3(1.0, 0.6, 0.12) * aRim + C * (1.0 - aRim); A = aRim + A * (1.0 - aRim);
  float k = clamp(flame, 0.0, 1.0);
  vec3 tongue = mix(vec3(0.5, 0.03, 0.0), vec3(1.0, 0.3, 0.02), smoothstep(0.0, 0.4, k));
  tongue = mix(tongue, vec3(1.0, 0.62, 0.12), smoothstep(0.4, 0.75, k));
  tongue = mix(tongue, vec3(1.0, 0.92, 0.65), smoothstep(0.85, 1.0, k));
  float aTongue = 0.72 * smoothstep(0.02, 0.45, k);
  C = tongue * aTongue + C * (1.0 - aTongue); A = aTongue + A * (1.0 - aTongue);
  C = vec3(1.0, 0.82, 0.4) * aEmber + C * (1.0 - aEmber); A = aEmber + A * (1.0 - aEmber);
  // a safety net only: the canvas is roomy enough that no flame reaches its border
  vec2 m = min(gl_FragCoord.xy, uRes - gl_FragCoord.xy) / (0.15 * uCell);
  float edge = smoothstep(0.0, 1.0, min(m.x, m.y));
  gl_FragColor = vec4(C, A) * edge;
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
  let raf = 0;
  const data = new Float32Array(MAX_DICE * 4);

  function setup() {
    canvas = document.createElement('canvas');
    canvas.className = 'fire-layer';
    gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return false;
    const shader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = shader(gl.VERTEX_SHADER, VERT);
    const fs = shader(gl.FRAGMENT_SHADER, FRAG);
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
    const grow = reduce ? 1 : Math.min(1, t / IGNITE_S);
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
    cells.forEach((c) => c.classList.remove('on-fire'));
    cells = [];
    if (canvas) canvas.style.display = 'none';
  }

  return { ignite, out, burning: () => cells.map((c) => Number(c.dataset.index)) };
}
