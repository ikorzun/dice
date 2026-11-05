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
"""
import json, os, ssl, subprocess, sys, time, urllib.error, urllib.request

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'art/sfx')
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
SFX = {
    'roll': (1.0, 'A few ivory dice tossed onto a felt-covered wooden table: a quick rattle, two or three tumbling clacks and a soft settle. Close, crisp, satisfying.' + NO),
    'hold': (0.5, 'A single crisp light tap of an ivory die being picked on a wooden game board: a short bright satisfying tock.' + NO),
    'release': (0.5, 'A single soft muted wooden tuk, a little lower and duller: letting go of a game piece. Very short.' + NO),
    'flip': (0.5, 'A single playing card flipped over quickly on a table: a crisp papery snap.' + NO),
    'on': (0.6, 'A short bright magical power-up chime with a sparkly shimmer: a bonus card switching on in a cozy fantasy card game.' + NO),
    'off': (0.5, 'A short soft descending magic fizzle, a gentle blip switching something off. Light, not sad.' + NO),
    'score': (0.9, 'A satisfying score sound in a fantasy dice game: a bright resonant chime with a short sparkle and a few gold coins clinking.' + NO),
    'fire': (1.0, 'Fire igniting with a quick whoosh and lively crackling flames, short. Cartoon fantasy game.' + NO),
    'burn': (0.6, 'A soft quick magical poof: small dice vanishing in a puff of smoke with a tiny sizzle. Short.' + NO),
    'drop': (0.7, 'A few small ivory dice dropping onto a felt table one after another: quick light clacks. Short.' + NO),
    'bonus': (1.3, 'A triumphant short fantasy fanfare sting: a bright brassy synth hit with sparkling bells, a big score multiplier won in a card game. Exciting.' + NO),
    'refund': (0.8, 'A single gold coin flipped and landing on a wooden counter with a bright clink, and a tiny cheeky bird chirp.' + NO),
    'win': (1.8, 'A short joyful level-complete jingle: a rising arpeggio of warm chimes and a sparkling finish, cozy fantasy card game.' + NO),
    # the lost run's receipt (owner's pick В12 A, GPT's spec): neutral, dry, no chord and no tail
    'tally': (0.5, 'A single dry mechanical click of a small wooden tally counter: one short flat tick, no ring, no echo.' + NO),
    'stop': (0.5, 'A single muted wooden knock, a game piece set down firmly on a felt table: dull, short, no ring, no tail.' + NO),
    'paper': (0.5, 'A short dry slide of a paper receipt across a wooden table: one quick soft papery swish.' + NO),
}  # (a menu click came out as a held tone both takes: the buttons tap with 'hold', higher)


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


def finish(name: str, x: np.ndarray) -> None:
    """Start 10 ms before the sound first comes within 24 dB of its peak (a game sound must start on its event), end
    where it falls 40 dB under it, level the active part to -18 dBFS RMS with the peak at most -1 dBFS, fade the last
    30 ms, mono MP3 96 kbit/s."""
    win = 441
    rms = np.array([np.sqrt(np.mean(x[i:i + win] ** 2)) for i in range(0, len(x), win)]) + 1e-9
    db = 20 * np.log10(rms)
    start = max(0, int(np.nonzero(db > db.max() - 24)[0][0]) - 1)
    on = np.nonzero(db > db.max() - 40)[0]
    y = x[start * win:min(len(x), (on[-1] + 1) * win)].copy()
    g = min(10 ** (-18 / 20) / (np.sqrt(np.mean(y ** 2)) + 1e-9), 10 ** (-1 / 20) / (np.abs(y).max() + 1e-9))
    y *= g
    f = min(len(y), int(0.03 * SR))
    y[-f:] *= np.linspace(1, 0, f)
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
            body = {'text': prompt, 'duration_seconds': dur, 'prompt_influence': 0.6, 'model_id': 'eleven_text_to_sound_v2'}
            audio = call('POST', '/v1/sound-generation?output_format=mp3_44100_128', body, accept='audio/mpeg')
            os.makedirs(RAW, exist_ok=True)
            open(take(name, n), 'wb').write(audio)
        takes = [take(name, n) for n in range(1, TAKES + 1) if os.path.exists(take(name, n))]
        best = max(takes, key=lambda t: score(pcm(t)))
        finish(name, pcm(best))
        print(f'{name}: {os.path.basename(best)}', flush=True)


if __name__ == '__main__':
    cmd, args = (sys.argv[1] if len(sys.argv) > 1 else 'check'), sys.argv[2:]
    if cmd == 'check':
        left = credits_left()
        print(f'key accepted · credits left {left} (reserve for CriminalRussia {RESERVE}, so {left - RESERVE} to spend here)')
    elif cmd == 'sfx':
        sfx(args)
    else:
        sys.exit(__doc__)
