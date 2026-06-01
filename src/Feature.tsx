import { useEffect, useState } from "react";
import {
  type MeshConfig,
  type YRoom,
  ConfettiLayer,
  useConfetti,
  useNamedPeer,
  usePerPeerValue,
  usePhase,
  useRoster,
} from "@baditaflorin/mesh-common";
import {
  buildBoard,
  gameStatus,
  guessOutcome,
  otherTeam,
  remaining,
  type GameStatus,
  type Team,
  type TileColor,
} from "./logic";

type Props = { room: YRoom | null; config: MeshConfig };
type Phase = "lobby" | "play" | "over";
type Role = "spymaster" | "operative";
type Seat = { team: Team | ""; role: Role };

const GAME_KEY = "cn:game";
const REVEALED_KEY = "cn:revealed";

/** Shared game pointer: the board seed, whose turn it is, and assassin info. */
function useGame(room: YRoom | null) {
  const [, rerender] = useState(0);
  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap(GAME_KEY);
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    return () => m.unobserve(cb);
  }, [room]);

  const m = room ? room.doc.getMap(GAME_KEY) : null;
  const seed = (m?.get("seed") as number | undefined) ?? 0;
  const currentTeam = (m?.get("currentTeam") as Team | undefined) ?? "red";
  const assassinHitBy = (m?.get("assassinHitBy") as Team | null | undefined) ?? null;

  return {
    seed,
    currentTeam,
    assassinHitBy,
    setCurrentTeam: (t: Team) => m?.set("currentTeam", t),
    setAssassinHitBy: (t: Team) => m?.set("assassinHitBy", t),
    /** Deal a fresh board: new seed, the new board's starting team, no reveals. */
    newGame: () => {
      if (!m || !room) return;
      const seed = Math.floor(Math.random() * 0xffffffff);
      const board = buildBoard(seed);
      room.doc.transact(() => {
        m.set("seed", seed);
        m.set("currentTeam", board.startingTeam);
        m.set("assassinHitBy", null);
        room.doc.getMap<boolean>(REVEALED_KEY).clear();
      });
    },
  };
}

/** Shared reveal state: `revealed[tileIndex] = true`, visible to everyone. */
function useRevealed(room: YRoom | null): {
  flags: boolean[];
  reveal: (i: number) => void;
} {
  const [, rerender] = useState(0);
  useEffect(() => {
    if (!room) return;
    const m = room.doc.getMap<boolean>(REVEALED_KEY);
    const cb = () => rerender((n) => n + 1);
    m.observe(cb);
    return () => m.unobserve(cb);
  }, [room]);

  const m = room ? room.doc.getMap<boolean>(REVEALED_KEY) : null;
  const flags: boolean[] = [];
  for (let i = 0; i < 25; i++) flags[i] = m?.get(String(i)) === true;

  return {
    flags,
    reveal: (i) => m?.set(String(i), true),
  };
}

const TEAM_LABEL: Record<Team, string> = { red: "Red", blue: "Blue" };

export function Feature({ room, config }: Props) {
  const { name, setName, names, myName } = useNamedPeer(config, room);
  const roster = useRoster(room);
  const phase = usePhase<Phase>(room, "cn:phase", "lobby");
  const seat = usePerPeerValue<Seat>(room, "cn:seat", { team: "", role: "operative" });
  const game = useGame(room);
  const revealed = useRevealed(room);
  const { burst } = useConfetti();

  const board = buildBoard(game.seed);
  const status: GameStatus = gameStatus(board.key, revealed.flags, game.assassinHitBy);
  const left = remaining(board.key, revealed.flags);

  // When the board reaches a win, advance the shared phase + celebrate once.
  useEffect(() => {
    if (!room) return;
    if (status !== "playing" && phase.phase === "play") {
      phase.transition("over", { from: "play" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, phase.phase, room]);

  useEffect(() => {
    if (phase.phase === "over" && status !== "playing") {
      const hue = status === "red-wins" ? [355, 10] : [215, 240];
      burst({ origin: "top", count: 110, hueRange: hue as [number, number] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.phase]);

  // ---- Disconnected ---------------------------------------------------------
  if (!room) {
    return (
      <div className="cn-wrap">
        <h1 className="cn-title">{config.appName}</h1>
        <p className="cn-status">Connecting to the room…</p>
      </div>
    );
  }

  const present = roster.present.length ? roster.present : [room.peerId];
  const nameFor = (id: string) =>
    names[id] || (id === room.peerId ? myName : `peer-${id.slice(0, 4)}`);

  const isSpymaster = seat.my.role === "spymaster";
  const seated = seat.my.team !== "";

  const scoreboard = (
    <div className="cn-score" role="status">
      <span className="cn-score-team cn-red" data-active={game.currentTeam === "red"}>
        Red {left.red} left
      </span>
      <span className="cn-score-dot">·</span>
      <span className="cn-score-team cn-blue" data-active={game.currentTeam === "blue"}>
        Blue {left.blue} left
      </span>
    </div>
  );

  // ---- Lobby: pick a team + role -------------------------------------------
  if (phase.phase === "lobby") {
    // Presence-aware team rosters: only count peers currently in the room.
    const rosterFor = (team: Team) => present.filter((id) => seat.valueOf(id)?.team === team);

    return (
      <div className="cn-wrap">
        <h1 className="cn-title">🕵️ mesh-codenames</h1>
        <p className="cn-tagline">
          A shared 5×5 word grid with a private spymaster key, on every phone. Pick your team and
          role, then deal a board.
        </p>

        {!name.trim() && (
          <label className="cn-name">
            Your name
            <input
              type="text"
              value={name}
              maxLength={24}
              placeholder="e.g. Alex"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}

        <div className="cn-teams">
          {(["red", "blue"] as Team[]).map((team) => (
            <div key={team} className={`cn-team-col cn-${team}`}>
              <h2 className="cn-team-name">{TEAM_LABEL[team]}</h2>
              <ul className="cn-team-roster">
                {rosterFor(team).map((id) => (
                  <li key={id}>
                    {nameFor(id)}
                    {seat.valueOf(id)?.role === "spymaster" ? " 🔑" : ""}
                    {id === room.peerId ? " (you)" : ""}
                  </li>
                ))}
                {rosterFor(team).length === 0 && <li className="cn-empty">— empty —</li>}
              </ul>
              <div className="cn-role-btns">
                <button
                  type="button"
                  className={`cn-seat ${
                    seat.my.team === team && seat.my.role === "operative" ? "is-mine" : ""
                  }`}
                  onClick={() => seat.setMy({ team, role: "operative" })}
                >
                  Join as operative
                </button>
                <button
                  type="button"
                  className={`cn-seat ${
                    seat.my.team === team && seat.my.role === "spymaster" ? "is-mine" : ""
                  }`}
                  onClick={() => seat.setMy({ team, role: "spymaster" })}
                >
                  Join as spymaster 🔑
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="cn-primary"
          disabled={!seated}
          onClick={() => {
            game.newGame();
            phase.transition("play", { from: "lobby" });
          }}
        >
          {seated ? "Deal a board →" : "Pick a team to start"}
        </button>
        <p className="cn-hint">
          Spymasters see the colour key on every tile. Operatives see blank cards until a tile is
          tapped. The key is shared openly with both spymasters — just like the box.
        </p>
      </div>
    );
  }

  // ---- Tile grid (shared by play + over) -----------------------------------
  const showKey = isSpymaster || phase.phase === "over";

  const grid = (
    <div className="cn-grid">
      {board.words.map((word, i) => {
        const color = board.key[i]!;
        const isRevealed = revealed.flags[i]!;
        const tintClass = showKey || isRevealed ? `cn-c-${color}` : "";
        const canTap =
          phase.phase === "play" &&
          status === "playing" &&
          !isRevealed &&
          seat.my.role === "operative" &&
          seat.my.team === game.currentTeam;
        return (
          <button
            key={`${i}-${word}`}
            type="button"
            className={`cn-tile ${tintClass} ${isRevealed ? "is-revealed" : ""} ${
              showKey && !isRevealed ? "is-keyed" : ""
            }`}
            disabled={!canTap}
            aria-label={`${word}${isRevealed ? ` — ${color}` : ""}`}
            onClick={() => {
              if (!canTap) return;
              const outcome = guessOutcome(color, game.currentTeam);
              room.doc.transact(() => {
                revealed.reveal(i);
                if (outcome === "assassin") {
                  game.setAssassinHitBy(game.currentTeam);
                } else if (outcome === "end-turn") {
                  game.setCurrentTeam(otherTeam(game.currentTeam));
                }
              });
            }}
          >
            <span className="cn-tile-word">{word}</span>
          </button>
        );
      })}
    </div>
  );

  // ---- Game over -----------------------------------------------------------
  if (phase.phase === "over") {
    const winner = status === "red-wins" ? "red" : status === "blue-wins" ? "blue" : null;
    const assassinEnded = game.assassinHitBy != null;
    return (
      <div className="cn-wrap cn-stage-over">
        <ConfettiLayer />
        <h1 className={`cn-title cn-${winner ?? "red"}`}>
          {winner ? `${TEAM_LABEL[winner]} wins!` : "Game over"}
        </h1>
        <p className="cn-verdict">
          {assassinEnded
            ? `${TEAM_LABEL[game.assassinHitBy!]} hit the assassin ☠️ — ${
                winner ? TEAM_LABEL[winner] : ""
              } take it.`
            : `All ${winner ? TEAM_LABEL[winner] : ""} agents found.`}
        </p>
        {grid}
        <div className="cn-controls">
          <button
            type="button"
            className="cn-primary"
            onClick={() => {
              game.newGame();
              phase.transition("play", { from: "over" });
            }}
          >
            New game →
          </button>
          <button type="button" className="cn-ghost" onClick={() => phase.transition("lobby")}>
            Back to lobby
          </button>
        </div>
      </div>
    );
  }

  // ---- Play ----------------------------------------------------------------
  const myTurn = seat.my.team === game.currentTeam;
  return (
    <div className="cn-wrap cn-stage-play">
      <ConfettiLayer />
      <h1 className="cn-title cn-sr-title">mesh-codenames</h1>
      {scoreboard}

      <p className="cn-turn">
        <strong className={`cn-${game.currentTeam}`}>{TEAM_LABEL[game.currentTeam]}</strong>{" "}
        {isSpymaster
          ? "spymaster: give a clue out loud."
          : myTurn
            ? "operatives: tap your guesses."
            : "team is guessing…"}
      </p>

      {isSpymaster && (
        <p className="cn-role-note">
          🔑 You are a spymaster — the key is visible to you only. Don’t tap; guide your team out
          loud.
        </p>
      )}

      {grid}

      <div className="cn-controls">
        <button
          type="button"
          className="cn-secondary"
          disabled={!myTurn || seat.my.role !== "operative"}
          onClick={() => game.setCurrentTeam(otherTeam(game.currentTeam))}
        >
          End turn
        </button>
        <button
          type="button"
          className="cn-ghost"
          onClick={() => {
            game.newGame();
          }}
        >
          New game
        </button>
        <button type="button" className="cn-ghost" onClick={() => phase.transition("lobby")}>
          Lobby
        </button>
      </div>
    </div>
  );
}
