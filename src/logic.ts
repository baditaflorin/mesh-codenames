// Pure, deterministic Codenames logic — no React, no Yjs — so it can be
// unit-tested in isolation and produce an identical board + key on every phone
// from a single shared integer seed.

import { WORDS } from "./words";

export type Team = "red" | "blue";
export type TileColor = Team | "neutral" | "assassin";

/** A dealt game: 25 words, their hidden key colors, and who starts. */
export type Board = {
  words: string[];
  key: TileColor[];
  startingTeam: Team;
};

export const GRID = 25;

/** Mulberry32: tiny, fast, deterministic PRNG seeded by a 32-bit integer. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle of `arr` driven by `rnd`. Mutates and returns `arr`.
 * Pulling all randomness from one seeded `rnd` keeps the deal deterministic.
 */
function shuffleInPlace<T>(arr: T[], rnd: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Deal a full game from a single integer seed. Fully deterministic: the same
 * seed yields the identical words, key, and starting team on every phone, so
 * the room shares only the seed (and which tiles are revealed), never the key.
 *
 * Distribution (standard Codenames): the starting team gets 9 tiles, the other
 * 8, plus 7 neutral and 1 assassin — exactly 25.
 */
export function buildBoard(seed: number): Board {
  const rnd = mulberry32(seed);

  // 1. Pick 25 distinct words by shuffling a copy of the word pool.
  const pool = shuffleInPlace([...WORDS], rnd);
  const words = pool.slice(0, GRID);

  // 2. The seed also decides who starts (gets 9 tiles).
  const startingTeam: Team = rnd() < 0.5 ? "red" : "blue";
  const otherTeam: Team = startingTeam === "red" ? "blue" : "red";

  // 3. Build the multiset of colors, then shuffle it onto the 25 positions.
  const colors: TileColor[] = [];
  for (let i = 0; i < 9; i++) colors.push(startingTeam);
  for (let i = 0; i < 8; i++) colors.push(otherTeam);
  for (let i = 0; i < 7; i++) colors.push("neutral");
  colors.push("assassin");
  const key = shuffleInPlace(colors, rnd);

  return { words, key, startingTeam };
}

/** Count of each team's tiles still hidden. */
export function remaining(key: TileColor[], revealed: boolean[]): { red: number; blue: number } {
  let red = 0;
  let blue = 0;
  for (let i = 0; i < key.length; i++) {
    if (revealed[i]) continue;
    if (key[i] === "red") red++;
    else if (key[i] === "blue") blue++;
  }
  return { red, blue };
}

/** Total tiles a team owns on the board (independent of reveal state). */
export function teamTotal(key: TileColor[], team: Team): number {
  let n = 0;
  for (const c of key) if (c === team) n++;
  return n;
}

export type GameStatus = "playing" | "red-wins" | "blue-wins";

/**
 * Resolve the outcome from the key + reveal state.
 *
 * Win rules (explicit):
 *   1. Assassin revealed → the team that revealed it LOSES, so the OTHER team
 *      wins immediately. We can't infer who tapped it from the board alone, so
 *      the caller passes `assassinHitBy` (the team whose turn it was when the
 *      assassin tile was flipped); the winner is the opposite team.
 *   2. Otherwise, a team wins the instant ALL of its tiles are revealed.
 *   3. Otherwise the game is still "playing".
 *
 * Rule 1 takes precedence: the assassin ends the game even if a team also has
 * all tiles revealed on the same board state.
 */
export function gameStatus(
  key: TileColor[],
  revealed: boolean[],
  assassinHitBy?: Team | null,
): GameStatus {
  const assassinIdx = key.indexOf("assassin");
  if (assassinIdx >= 0 && revealed[assassinIdx]) {
    // Whoever flipped it loses; the opponent wins. Fall back to "the team that
    // does NOT own remaining tiles" only if we somehow lack hit info — but the
    // caller always supplies it, so default to red-loses if unknown.
    const loser: Team = assassinHitBy ?? "red";
    return loser === "red" ? "blue-wins" : "red-wins";
  }
  const left = remaining(key, revealed);
  if (left.red === 0) return "red-wins";
  if (left.blue === 0) return "blue-wins";
  return "playing";
}

/**
 * Classify a guess for turn flow. Revealing your own color continues the turn;
 * neutral or the opponent's color ends it; the assassin ends the game.
 *   "continue"  → same team keeps guessing
 *   "end-turn"  → pass to the other team
 *   "assassin"  → game over, guessing team loses
 */
export function guessOutcome(
  tileColor: TileColor,
  guessingTeam: Team,
): "continue" | "end-turn" | "assassin" {
  if (tileColor === "assassin") return "assassin";
  if (tileColor === guessingTeam) return "continue";
  return "end-turn";
}

/** The other team. */
export function otherTeam(team: Team): Team {
  return team === "red" ? "blue" : "red";
}
