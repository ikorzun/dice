# DICEFOOL on CrazyGames — requirements report (18.11.2026)

Status: **build ready, nothing uploaded, nothing committed**. Checked 18.11 (muted): `npm test` 176/176, `npm run build`, `npm run smoke` OK in Chromium and in WebKit (both include the CrazyGames block: portrait phone, landscape phone, desktop). No developer-portal account, submission or upload was made (owner's rule).
Build: `npm run build` → `dist/crazygames/` (index.html + `vendor/` + `acts/` + `portal/`, 89 files, 41 MB).
Layer: `src/ui/platform.js` (the CrazyGames branch runs when `window.CrazyGames.SDK` exists; the page only has it in this build).
Check: `npm run smoke` (the CrazyGames block runs the build against a stand-in SDK in phone portrait, phone landscape, desktop);
also run once against the real SDK in local mode (`http://localhost`, environment `local`, demo ad shown).

Sources (all docs.crazygames.com): [SDK intro](https://docs.crazygames.com/sdk/intro/), [Game](https://docs.crazygames.com/sdk/game/),
[Video ads](https://docs.crazygames.com/sdk/video-ads/), [Data](https://docs.crazygames.com/sdk/data/),
[Technical](https://docs.crazygames.com/requirements/technical/), [Gameplay](https://docs.crazygames.com/requirements/gameplay/),
[Ads](https://docs.crazygames.com/requirements/ads/), [Quality](https://docs.crazygames.com/requirements/quality/),
[Game covers](https://docs.crazygames.com/requirements/game-covers/), [Requirements intro](https://docs.crazygames.com/requirements/intro/),
[First frame](https://docs.crazygames.com/resources/getting-to-the-first-frame/).
(The pages were read through a summarising fetch tool; re-read the originals before submitting.)

## SDK v3

| Requirement | Status | Where / note |
|---|---|---|
| Script `https://sdk.crazygames.com/crazygames-sdk-v3.js` in `<head>` before game code | ✅ | `scripts/build.mjs` (`SDK`) |
| `await SDK.init()` before use | ✅ | `setupCrazy` (15 s guard, then plays on without the SDK) |
| `environment`: local / crazygames / disabled (disabled: calls throw) | ✅ | `disabled` → treated as a plain browser |
| `game.loadingStart` / `loadingStop` (optional) | ✅ | start after init, stop at first tappable frame (`gameReady`) |
| `gameplayStart` / `gameplayStop` at each break | ✅ | start at level start, stop at level end and during an ad (via `tellLevel`); not on focus loss |
| `ad.requestAd('midgame', {adStarted, adFinished, adError})` | ✅ | `interstitial()` in `onNext` (between levels / after a lost run) |
| Pause + mute in `adStarted`, resume in `adFinished`/`adError` | ✅ | game held from the request (UI/timers), silent only once the ad plays; 15 s guard if neither fires |
| Handle every `adError` code (`adsDisabled`, `unfilled`, `adblock`, `adCooldown`, `other`) | ✅ | one path: the game goes on |
| Midgame not on menu/settings/shop buttons; SDK enforces 3 min cooldown | ✅ | only the "next level" tap asks; the shop is not a trigger |
| `requestAd('rewarded')` | ➖ not used | no rewarded offer in the game (see decisions) |
| Banners | ➖ not used | |
| `data` module (`getItem/setItem/removeItem/clear`, same API as localStorage, < 1 MB) | ✅ | saves via `SDK.data`; falls back to localStorage if the module is off |
| `Progress Save` toggle in the submission | ⚠️ owner/portal step | must be ON, else the data module throws `dataModuleDisabled` (fallback keeps the game working) |
| `muteAudio` setting beats the in-game toggle | ✅ | `settings.muteAudio` + change listener → `setHostSilent` |
| `game.happytime()` for rare achievements | ✅ | new best run and a keeper beaten (not for every level) |
| User module / login | ➖ | not needed: no accounts in the game; progress follows the SDK data module |
| Leaderboards | ➖ | the game keeps its device table (board.js); CrazyGames' leaderboard module is optional |

Save size: measured in the real-SDK run, keys are the 4 game keys; see "Open" for the 1 MB check on a long run.

## Technical requirements

| Requirement | Status | Note |
|---|---|---|
| Initial download ≤ 50 MB (≤ 20 MB for the mobile homepage), measured up to the first `gameplayStart` | ✅ | measured 4.8 MB uncompressed before any gameplay: index.html 3.83 MB (2.4 MB gzip) + three.js 0.64 MB (0.16 MB gzip) + the SDK script. The hero acts (33 MB with the portal's files in the folder) are fetched on demand, none before level 1 |
| Total ≤ 250 MB, ≤ 1500 files | ✅ | 41 MB, 89 files |
| Relative paths only | ✅ | `acts/…`, `portal/…`, `vendor/…` |
| Nothing from outside but the SDK | ✅ | build fails otherwise (fonts are inlined, three.js vendored) |
| Chrome/Edge work; Safari not "poor" | ✅ checked in Chromium + WebKit (smoke), not on a real iPhone yet | |
| Mouse, keyboard, touch | ✅ | |
| Portrait allowed (black bars/background on desktop) | ✅ | the game's own desktop layout; owner's mockups |
| No orientation-lock logic | ✅ | none in the game |
| `user-select: none` on `body` | ⚠️ | set on the board/cards in styles.css:292; not on `body`. One-line change, left for owner's word (shared styles.css) |
| Mobile safe areas (CrazyGames App) | ✅ | layout already insets for notches |
| iOS AudioContext `resume()` inside a gesture | ⚠️ sound.js calls `ctx.resume()` when the context is suspended/interrupted (sound.js:80, 123, 138); re-verify on a real iPhone | |
| Privacy/T&C notice if personal data beyond SDK events | ✅ none collected | the game stores only saves |

## Gameplay / ads / quality rules

| Rule | Status | Note |
|---|---|---|
| Land new players in gameplay (max 1 click) | ✅ | 3 s splash, then the board with the tutorial; no title screen |
| No cross-promotion, no external/app-store links | ✅ | no links in the game (checked: no `href=http`, `window.open`) |
| English localisation | ✅ | the game is English; `lang="en"` |
| No custom fullscreen button | ✅ | none |
| PEGI 12 / 13+ audience | ✅ | dice puzzle; skeleton/skull keepers are cartoon, no gore (owner to confirm) |
| Works with AdBlock | ✅ | `adError` path |
| Block UI during ad request and playback | ✅ | `holdGame` + silent |
| Rewarded rules | ➖ | none used |
| Avoid Escape/Ctrl+W bindings | ✅ | keys are Enter/Space on a cell only; no Escape, no Ctrl combinations |
| Original name/assets; not confusable with another game | ⚠️ owner | "DICEFOOL" name check before submission |
| One aesthetic style, no compression artefacts | ✅ | owner's art |

## Open for the owner (decisions)

1. **Basic or Full Launch?** The layer is Full Launch (ads, data, gameplay events). Basic Launch disables ads and revenue; the build still works (adError `adsDisabled`).
2. **Rewarded ad?** Not built. Natural place: «reroll / extra life after a loss». Rules forbid pairing it with a midgame between the same two levels. Say if wanted.
3. **`body { user-select:none }`** — add (one line in styles.css)? Touches a shared file, so held back.
4. **Save size** on a long run vs the 1 MB data limit: measure on a level-60 run before release.
5. **Preview video** (≤ 50 MB) is optional on the portal; none made.
6. **Covers** (see list below) — drawn only on your word (GPT Image only for pictures).
7. **Language of the card**: English (required).
8. **Real-device check** on an iPhone and Android before the upload.
9. **Do not upload** anything until you say so.

## Cover images (CrazyGames "Game covers")

Three covers with the same visuals; only the game's title as text (no "New/Play"), no borders, no icons or store logos, not blurry.
- Landscape 16:9 — 1920×1080
- Portrait 2:3 — 800×1200
- Square 1:1 — 800×800
Formats and file-size limit for covers are not stated on that page (the 50 MB figure there is for the preview video). Proposal: the card's portraits (knight, skeleton, monkey) with the DICEFOOL title and a die; not drawn yet.

## Store card text (English, draft)

**Title:** DICEFOOL

**Short description (≈ 100 chars):**
Roll nine dice, play the best hand and hit the target. Cards and keepers make every level a new puzzle.

**Description:**
DICEFOOL is a dice puzzle on a 3×3 board. Reroll, hold what you like and press PLAY: the game scores your best poker-style hand — pairs, trips, straights, full houses — against the level's target. Miss it and the run ends; clear it and you pick an upgrade.

Collect hero cards that act and double your hands, spend bells in the shop on things that change the rules, and beat a new keeper every fifth level. How far can you get?

**How to play:**
- Tap a die to hold it, tap REROLL to roll the rest.
- Press PLAY to score your hand. Reach the target to clear the level.
- Tap a card to switch it on before you play. Cards act once.
- A missed target ends the run; your best level is saved.

**Controls:** mouse or touch. **Genre:** puzzle / dice / roguelike. **Tags:** dice, cards, puzzle, poker, roguelike, strategy, casual.
**Age:** 13+ (PEGI 12 compliant).
