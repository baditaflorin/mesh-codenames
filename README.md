# mesh-codenames

[![pages](https://img.shields.io/badge/live-baditaflorin.github.io%2Fmesh-codenames-7b6ef6)](https://baditaflorin.github.io/mesh-codenames/)
[![version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/baditaflorin/mesh-codenames/blob/main/package.json)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

> Codenames — shared 5x5 word grid with a private spymaster key, on every phone

**Live → https://baditaflorin.github.io/mesh-codenames/**

**Source → https://github.com/baditaflorin/mesh-codenames**

**Tip the dev (buy a coffee) → https://www.paypal.com/paypalme/florinbadita**

---

![screenshot](docs/screenshot.png)

> Two peers, side-by-side, in the same room. Drop a `tests/demo/scenario.mjs`
> exporting `default async (a, b) => …` and run `npm run demo` to regenerate
> `docs/preview.png` plus `docs/demo-a.webm` / `docs/demo-b.webm` clips.

![preview](docs/preview.png)

## What it is

A **rootless-computing** peer-to-peer browser app. No backend of its own beyond the self-hosted WebRTC stack listed below. State lives in a Yjs mesh shared by everyone in the same room.

Read the principles → **https://baditaflorin.github.io/rootless-computing/principles.html**

## How to play

Codenames for the room, with no card table and no shared screen — the board lives on every phone at once. One person opens the link, everyone else scans the room QR (⚙ → invite) or opens the same link.

1. **Pick a team and a role.** Tap **Red** or **Blue**, then **operative** or **spymaster**. Each team wants two roles: one or two spymasters who can see the key, and the rest as operatives who guess.
2. **Deal a board.** Anyone hits **Deal a board**. All 25 words and their hidden colours are derived from one shared random seed, so every phone shows the identical grid — no card to pass around. The starting team (chosen by the seed) gets **9** agents, the other team **8**, with **7** bystanders and **1** assassin.
3. **Spymasters see the key.** On a spymaster's phone every tile is tinted with its true colour. On an operative's phone the tiles are blank word cards until tapped. (Sharing the key openly with both spymasters is exactly how the boxed game works — deriving it from a public seed is the same thing.)
4. **Give clues and guess.** The current team's spymaster gives a one-word clue **out loud** (the app stays out of this, like the real game). Their operatives tap tiles to guess:
   - Tap one of **your** colours → it flips to that colour for everyone and your team keeps going.
   - Tap a **bystander** or the **other team's** colour → the turn passes to the other team.
   - Tap the **assassin** → your team loses instantly.
   - Done early? Hit **End turn** to pass.
5. **Win** by being the first team to reveal all of your agents — or by surviving while the other team hits the assassin. The scoreboard reads **Red 9 left · Blue 8 left** and updates live on every phone.

**New game** deals a fresh seed and clears the board for everyone; **Lobby** lets people change teams.

## Quickstart

Open the live URL on two devices in the same room (set in ⚙ settings, or scan the room QR). Everything else is in-app.

For local hacking:

```bash
git clone https://github.com/baditaflorin/mesh-common
git clone https://github.com/baditaflorin/mesh-codenames
cd mesh-codenames
npm install
npm run dev
```

`mesh-common` must sit as a **sibling** directory because `package.json` references it via `file:../mesh-common`.

## Self-hosted infrastructure

| Repo                                              | Endpoint                               | Purpose                     |
| ------------------------------------------------- | -------------------------------------- | --------------------------- |
| https://github.com/baditaflorin/signaling-server  | `wss://turn.0docker.com/ws`            | y-webrtc signaling fan-out  |
| https://github.com/baditaflorin/turn-token-server | `https://turn.0docker.com/credentials` | HMAC TURN creds, 1-hour TTL |
| https://github.com/baditaflorin/coturn-hetzner    | `turn:turn.0docker.com:3479`           | TURN relay                  |

## Settings overrides

The settings drawer lets the user override signaling and TURN endpoints. localStorage keys:

- `mesh-codenames:signalingUrl`
- `mesh-codenames:turnTokenUrl`
- `mesh-codenames:iceServers`
- `mesh-codenames:room`

If endpoints are blank or unreachable, the app falls back to STUN-only.

## Version + commit on every screen

The bottom-right footer on every screen of the live app shows:

- `source` → this repo
- `tip ♥` → PayPal
- `vX.Y.Z · <short-sha>` — version from `package.json` plus the build-time git commit

## Build & deploy

GitHub Pages serves the committed `docs/` directory on the `main` branch. There is no GitHub Actions build workflow; local Husky-style hooks gate formatting / typecheck / smoke build before each push.

```bash
npm run smoke                                    # build + sanity-check docs/
bash ../mesh-common/scripts/screenshot-app.sh    # regenerate docs/screenshot.png
```

## Privacy

<!-- mesh:privacy-section:start -->

Everything you publish to a room is visible to every peer in that room. Your local device's name, key, and choices stay local. Cryptographic signatures prove **who** wrote each entry; they do **not** prevent peers from reading or copying entries. The room URL is the access control — share it deliberately.

See `docs/privacy.md` for the full threat model — capabilities used, what other peers in the mesh see, what the self-hosted infra sees, what stays local.

<!-- mesh:privacy-section:end -->

## License

MIT — see `LICENSE`.
