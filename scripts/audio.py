"""audio.py: the game's sound effects, made with ElevenLabs (owner 2026-11-02: "sound, use ElevenLabs from the
neighbouring chat" — Downwell/tools/audio.py, whose key handling, takes and levelling this follows).

The key comes from ELEVENLABS_API_KEY or the macOS keychain (service "elevenlabs") and is never printed or written
anywhere. Credits are shared with CriminalRussia, which keeps RESERVE of them for its voice-over: nothing here runs
if it would dip below that.

Effects land in assets/sfx/<name>.mp3 (mono); raw takes stay in art/sfx (out of git). Each effect is made in TAKES
takes; the one that starts at once and fills its length wins, then silence is cut off its ends, it is levelled to
-18 dBFS RMS (peak at most -1 dBFS) and given a 30 ms fade so it cannot click.

    python3 scripts/audio.py check              # the key works? credits left
    python3 scripts/audio.py sfx [name ...]     # make missing effects (named ones anew), then build them
    python3 scripts/audio.py build name ...     # build effects again from their takes, no credits
"""
import json, os, ssl, subprocess, sys, time, urllib.error, urllib.request

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.environ.get('SFX_TAKES') or os.path.join(ROOT, 'art/sfx')  # a git worktree has no art/: point it at the checkout's
API = 'https://api.elevenlabs.io'
RESERVE = 8000  # CriminalRussia's voice-over reserve (its sfx.py, agreed 2026-10-14)
TAKES = int(os.environ.get('TAKES', 2))
SR = 44100


def _tls() -> ssl.SSLContext:
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


TLS = _tls()
_key: list[str] = []


def key() -> str:
    if not _key:
        k = os.environ.get('ELEVENLABS_API_KEY', '').strip()
        if not k and sys.platform == 'darwin':
            r = subprocess.run(['security', 'find-generic-password', '-s', 'elevenlabs', '-w'], capture_output=True, text=True)
            k = r.stdout.strip() if r.returncode == 0 else ''
        if not k:
            sys.exit('No ElevenLabs key: put it in the keychain (security add-generic-password -a "$USER" -s elevenlabs -w).')
        _key.append(k)
    return _key[0]


def call(method: str, path: str, body: dict | None = None, accept: str = 'application/json', tries: int = 4) -> bytes:
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(tries):
        req = urllib.request.Request(API + path, data=data, method=method,
                                     headers={'xi-api-key': key(), 'Content-Type': 'application/json', 'Accept': accept})
        try:
            with urllib.request.urlopen(req, timeout=240, context=TLS) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            detail = e.read().decode('utf-8', 'replace')[:300]
            if e.code in (429, 500, 502, 503) and attempt < tries - 1:
                time.sleep(4 * (attempt + 1))
                continue
            sys.exit(f'ElevenLabs {method} {path.split("?")[0]}: HTTP {e.code} {detail}')
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < tries - 1:
                time.sleep(4 * (attempt + 1))
                continue
            sys.exit(f'ElevenLabs: network — {e}')
    raise RuntimeError('unreachable')


def credits_left() -> int:
    s = json.loads(call('GET', '/v1/user/subscription'))
    return int(s['character_limit']) - int(s['character_count'])


# ── Effects: name → (seconds, at least 0.5, prompt). One plain event each (the model keeps one event per prompt best).
# The world: ivory dice with black metal pips on a dark table, illustrated characters on cards, drawn fire. ──
NO = ' No voices, no words, no music.'
LUTE = 'A single note plucked on a medieval lute with the fingertip: soft, warm and ringing, with the natural touch of the finger on the string, it rings out naturally.'
HALL = ' A real acoustic instrument recorded with one microphone in a small stone hall, gentle natural room ambience. No synthesizer. No voices, no words.'
ROOM = ' A real object recorded with one close microphone in a small stone hall, gentle natural room ambience. No synthesizer. No voices, no words, no music.'
ONE = ' One strike only, no second hit.'
SFX = {
    # owner 05.11.2026: all of it real objects from the same table and hall as the lute; the old "chime, sparkly, fizzle, poof,
    # magical, cartoon" takes lay over 6 kHz, "muted, lower, whoosh" under 200 Hz, where a phone plays nothing
    'roll': (1.0, 'A handful of small wooden dice thrown onto a thick oak table: quick light wooden knocks tumbling one after another and settling.' + ROOM),
    'hold': (0.5, 'One small wooden die set down on a thick oak table: a single light wooden knock.' + ONE + ROOM),
    'flip': (0.5, 'A stiff card of old parchment turned over and laid on an oak table: one soft quick papery flap.' + ROOM),
    'on': (0.6, 'The small brass clasp of an old book snapping shut: one soft warm click with a short gentle ring.' + ONE + ROOM),
    'off': (0.5, 'A small wooden latch of an old chest lifted: one light wooden knock.' + ONE + ROOM),
    'fire': (1.0, 'A pine torch catching fire in a stone hall: a warm rush of flame with crackling wood knocks, full and close, not hissy.' + ROOM),
    'burn': (0.6, 'A small heap of hot embers collapsing in a stone hearth: a soft dry crumble with a few tiny crackles.' + ROOM),
    'drop': (0.7, 'Two bone dice dropped one after the other onto a thick oak table: quick light wooden knocks.' + ROOM),
    'refund': (0.8, 'A heavy old copper coin dropped on a thick oak table: a dull warm knock and a short low rattle as it settles.' + ROOM),
    'bird': (0.5, 'A small clay water whistle shaped like a bird, with water inside, blown once: one short soft bubbling warble.' + HALL),
    'win': (1.8, 'A short joyful level-complete jingle: a rising arpeggio of warm chimes and a sparkling finish, cozy fantasy card game.' + NO),
    # the count (owner's pick В8 A, like Balatro; owner 05.11.2026: not synthetic, medieval softness and ringing, softer still,
    # like real instruments): a lute's own notes, a bronze bowl, a distant bell, a wax seal
    **{f'lute-{note.lower()}': (1.2, LUTE + f' The note is {note}. One note only, no melody.' + HALL) for note in ('C4', 'G4', 'A4', 'B4', 'C5', 'D5')},
    'mult': (1.0, 'A small bronze bowl touched softly with a felt mallet: a warm round gentle tone that rings out quietly. One strike only, no second hit.' + HALL),
    'crack': (0.7, 'A wax seal gently cracked in two between the fingers: a soft dry snap, close and quiet. One strike only, no second hit.' + HALL),
    'medal': (1.6, 'A bronze chapel bell struck once, heard softly from across a courtyard: warm, round and gentle, with a long natural decay. One strike only, no second hit.' + HALL),
    # the lost run's receipt (owner's pick В12 A, GPT's spec): neutral, dry, no chord and no tail
    'tally': (0.5, 'A single dry mechanical click of a small wooden tally counter: one short flat tick, no ring, no echo.' + NO),
    'stop': (0.5, 'A single muted wooden knock, a game piece set down firmly on a felt table: dull, short, no ring, no tail.' + NO),
    'paper': (0.5, 'A short dry slide of a paper receipt across a wooden table: one quick soft papery swish.' + NO),
}  # (a menu click came out as a held tone both takes: the buttons tap with 'hold', higher)

# What an effect needs beyond levelling. take: the take chosen by measuring it (the note it was asked for, partials down to
# -40 dB up to 6 kHz, the high ones falling faster than the low: "pianissimo" in a prompt gave almost pure tones, which is
# what sounds synthetic); hz: tuned to this pitch, so that all of it is in one key; rate: the same for a bell or a bowl, whose
# loudest low partial is set on a note of the chord (they have no one pitch); hp, lp: cut below or above this (a phone's
# speaker cannot play the low, the softness is in taking off the top); attack: seconds, the touch of the string eased in;
# end, fade: seconds, it stops sooner and softly; influence: how literally the model takes the prompt (one note needs more).
OBJECT = {'hp': 170, 'lp': 5000, 'influence': 0.85}
STRING = {'end': 1.0, 'fade': 0.25, 'lp': 3200, 'attack': 0.003, 'influence': 0.85}
SHAPE = {
    'lute-c4': {'take': 2, 'hz': 261.63, **STRING},
    'lute-g4': {'take': 4, 'hz': 392.0, **STRING},
    'lute-a4': {'take': 1, 'hz': 440.0, **STRING},
    'lute-b4': {'take': 1, 'hz': 493.88, **STRING},
    'lute-c5': {'take': 1, 'hz': 523.25, **STRING},
    'lute-d5': {'take': 1, 'hz': 587.33, **STRING},
    'mult': {'take': 3, 'rate': 0.984, 'hp': 170, 'influence': 0.85},
    'crack': {'take': 3, 'hp': 170, 'lp': 5000, 'influence': 0.85},
    'medal': {'take': 2, 'rate': 0.736, 'lp': 4000, 'influence': 0.85},
    'stop': {'hp': 170},  # 98 % of it lay under 150 Hz: a phone played nothing of the knock
    # objects: the take with its energy where the lute's is and a quick start (measured; "bone", "brass" and "silver" came out over 6 kHz, "wooden knocks" and "copper" where a phone plays them)
    'roll': {'take': 3, **OBJECT, 'lp': 3500},
    'hold': {'take': 2, **OBJECT},
    'flip': {'take': 1, **OBJECT},
    'on': {'take': 1, **OBJECT},
    'off': {'take': 2, **OBJECT},
    'fire': {'take': 3, **OBJECT},
    'burn': {'take': 2, **OBJECT, 'lp': 3500},
    'drop': {'take': 2, **OBJECT},
    'refund': {'take': 2, **OBJECT},
    'bird': {'take': 1, 'hp': 170, 'lp': 4000, 'influence': 0.85},
}

# Made from takes already here, no credits (LORE §2.4, owner 10.11.2026: carry out the recommendations): only `build` reads
# this, `sfx` never does. mix: (take under art/sfx, dB, at s[, from s, length s]), each part's peak at 0 dB first; then as in
# SHAPE, plus decay: seconds for the sound to fall by e, as a hand or a cloth damps it. Each keeper's rule heard in the count.
DERIVED = {
    # LADY LOWBELL: a six's note, the lute's C5 damped under the palm (sound.js bends it to the ladder's pitch)
    'lute-mute': {'mix': [('lute-c5.1.mp3', 0, 0)], 'hz': 523.25, 'hp': 170, 'lp': 1000, 'decay': 0.06, 'end': 0.3, 'fade': 0.1, 'attack': 0.003},
    # MASON GRUDGE: his chisel takes the five off, a brass click on a ceramic chip, short
    'chisel': {'mix': [('on.1.mp3', 0, 0), ('cand/break_ceramic.2.mp3', -4, 0.004, 0, 0.12)], 'hp': 300, 'lp': 5000, 'decay': 0.05, 'end': 0.2},
    # THE LAST USHER: his scissors cut the third ticket, a reed's snap and a sliver of paper, then the blades meet
    'snip': {'mix': [('cand3/crack_reed.2.mp3', 0, 0), ('paper.2.mp3', -6, 0.005, 0.12, 0.08), ('on.3.mp3', -8, 0.07)], 'hp': 300, 'lp': 5000, 'decay': 0.06, 'end': 0.22},
    # SIR SHORTWIND: the bellows breathe out on his REROLL, the torch take's rush without its low and its crackle
    'bellows': {'mix': [('fire.1.mp3', 0, 0, 0.05, 0.6)], 'hp': 400, 'lp': 3500, 'attack': 0.09, 'decay': 0.2, 'end': 0.5, 'fade': 0.15},
    # BROTHER HUSH: the card's own flip, muffled, when a kept card does not come in
    'flip-hush': {'mix': [('flip.1.mp3', 0, 0)], 'hp': 170, 'lp': 900, 'decay': 0.08, 'end': 0.25},
    # THE CROOKED JUDGE: the multiplier's bronze bowl stopped by a hand, a fourth lower, on a wooden knock: a halved straight
    'thud': {'mix': [('mult.3.mp3', 0, 0), ('hold.2.mp3', -3, 0)], 'rate': 0.75, 'hp': 170, 'lp': 2000, 'decay': 0.07, 'end': 0.3, 'fade': 0.1},
}


def mix(parts: list) -> np.ndarray:
    tracks = []
    for f, db, at, *cut in parts:
        x = pcm(os.path.join(RAW, f))
        if cut:
            x = x[int(cut[0] * SR):int((cut[0] + cut[1]) * SR)]
        x = x / (np.abs(x).max() + 1e-9) * 10 ** (db / 20)
        tracks.append(np.concatenate([np.zeros(int(at * SR), np.float32), x.astype(np.float32)]))
    y = np.zeros(max(map(len, tracks)), np.float32)
    for t in tracks:
        y[:len(t)] += t
    return y


def take(name: str, n: int) -> str:
    return os.path.join(RAW, f'{name}.{n}.mp3')


def pcm(path: str) -> np.ndarray:
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def score(x: np.ndarray) -> float:
    """Higher is better: it starts at once and fills its length (not a silence with a tail)."""
    m = np.abs(x)
    win = 441   # 10 ms
    env = np.array([m[i:i + win].max() for i in range(0, len(m), win)]) + 1e-9
    loud = env > env.max() * 0.2
    return loud.mean() - int(np.argmax(loud)) * 0.03


def f0(x: np.ndarray) -> float:
    """The note's pitch: the strongest autocorrelation peak between 100 and 2500 Hz in the 100 ms after its start."""
    w = x[:4410] * np.hanning(4410)
    r = np.fft.irfft(np.abs(np.fft.rfft(w, n=8820)) ** 2)
    a, b = SR // 2500, SR // 100
    k = a + int(np.argmax(r[a:b]))
    return SR / (k + (r[k - 1] - r[k + 1]) / (2 * (r[k - 1] - 2 * r[k] + r[k + 1])))


def finish(name: str, x: np.ndarray) -> None:
    """Start 10 ms before the sound first comes within 24 dB of its peak (a game sound must start on its event), end
    where it falls 40 dB under it, level the active part to -18 dBFS RMS with the peak at most -1 dBFS, fade the last
    30 ms, mono MP3 96 kbit/s."""
    shape = SHAPE.get(name) or DERIVED.get(name, {})
    if 'hp' in shape or 'lp' in shape:
        f = ','.join(([f"highpass=f={shape['hp']},highpass=f={shape['hp']}"] if 'hp' in shape else []) + ([f"lowpass=f={shape['lp']}"] if 'lp' in shape else []))
        x = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', f, '-f', 'f32le', '-'],
                                         input=x.astype(np.float32).tobytes(), capture_output=True, check=True).stdout, dtype=np.float32)
    win = 441
    rms = np.array([np.sqrt(np.mean(x[i:i + win] ** 2)) for i in range(0, len(x), win)]) + 1e-9
    db = 20 * np.log10(rms)
    start = max(0, int(np.nonzero(db > db.max() - 24)[0][0]) - 1)
    on = np.nonzero(db > db.max() - 40)[0]
    y = x[start * win:min(len(x), (on[-1] + 1) * win)].copy()
    ratio = shape['hz'] / f0(y) if 'hz' in shape else shape.get('rate')
    if ratio:
        y = np.interp(np.arange(0, len(y) - 1, ratio), np.arange(len(y)), y)
    if 'end' in shape:
        y = y[:int(shape['end'] * SR)]
    if 'decay' in shape:
        y = y * np.exp(-np.arange(len(y)) / (shape['decay'] * SR))
    g = min(10 ** (-18 / 20) / (np.sqrt(np.mean(y ** 2)) + 1e-9), 10 ** (-1 / 20) / (np.abs(y).max() + 1e-9))
    y *= g
    f = min(len(y), int(shape.get('fade', 0.03) * SR))
    y[-f:] *= np.linspace(1, 0, f)
    if 'attack' in shape:
        f = int(shape['attack'] * SR)
        y[:f] *= np.linspace(0, 1, f)
    out = os.path.join(ROOT, 'assets/sfx', f'{name}.mp3')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame',
                    '-b:a', '96k', out], input=y.astype(np.float32).tobytes(), check=True)


def sfx(names: list[str]) -> None:
    for name in names or list(SFX):
        dur, prompt = SFX[name]
        for n in range(1, TAKES + 1):
            if os.path.exists(take(name, n)) and not names:
                continue
            if credits_left() < RESERVE + 2000:
                sys.exit(f'stopped at {name}: keeping the {RESERVE}-credit reserve')
            body = {'text': prompt, 'duration_seconds': dur, 'prompt_influence': SHAPE.get(name, {}).get('influence', 0.6), 'model_id': 'eleven_text_to_sound_v2'}
            audio = call('POST', '/v1/sound-generation?output_format=mp3_44100_128', body, accept='audio/mpeg')
            os.makedirs(RAW, exist_ok=True)
            open(take(name, n), 'wb').write(audio)
        build(name)


def build(name: str) -> None:
    if name in DERIVED:
        finish(name, mix(DERIVED[name]['mix']))
        print(f"{name}: {' + '.join(p[0] for p in DERIVED[name]['mix'])}", flush=True)
        return
    takes =[take(name, n) for n in range(1, TAKES + 1) if os.path.exists(take(name, n))]
    best = take(name, SHAPE[name]['take']) if 'take' in SHAPE.get(name, {}) else max(takes, key=lambda t: score(pcm(t)))
    finish(name, pcm(best))
    print(f'{name}: {os.path.basename(best)}', flush=True)


if __name__ == '__main__':
    cmd, args = (sys.argv[1] if len(sys.argv) > 1 else 'check'), sys.argv[2:]
    if cmd == 'check':
        left = credits_left()
        print(f'key accepted · credits left {left} (reserve for CriminalRussia {RESERVE}, so {left - RESERVE} to spend here)')
    elif cmd == 'sfx':
        sfx(args)
    elif cmd == 'build':
        for name in args:
            build(name)
    else:
        sys.exit(__doc__)
