import { describe, expect, it } from "vitest";
import {
  buildBoard,
  gameStatus,
  guessOutcome,
  mulberry32,
  otherTeam,
  remaining,
  teamTotal,
  type TileColor,
} from "../../src/logic";
import { WORDS } from "../../src/words";

describe("mulberry32", () => {
  it("is deterministic for the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("produces values in [0, 1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("words list", () => {
  it("has at least 250 distinct uppercase single words", () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(250);
    expect(new Set(WORDS).size).toBe(WORDS.length);
    expect(WORDS.every((w) => /^[A-Z]+$/.test(w))).toBe(true);
  });
});

describe("buildBoard", () => {
  it("deals exactly 25 tiles and 25 key colors", () => {
    const b = buildBoard(123);
    expect(b.words).toHaveLength(25);
    expect(b.key).toHaveLength(25);
  });

  it("uses 25 distinct words drawn from the pool", () => {
    const b = buildBoard(123);
    expect(new Set(b.words).size).toBe(25);
    for (const w of b.words) expect(WORDS).toContain(w);
  });

  it("applies the 9 / 8 / 7 / 1 distribution to the starting team", () => {
    for (const seed of [1, 2, 99, 100000, 0xdeadbeef]) {
      const b = buildBoard(seed);
      const counts: Record<TileColor, number> = { red: 0, blue: 0, neutral: 0, assassin: 0 };
      for (const c of b.key) counts[c]++;
      const other = otherTeam(b.startingTeam);
      expect(counts[b.startingTeam]).toBe(9);
      expect(counts[other]).toBe(8);
      expect(counts.neutral).toBe(7);
      expect(counts.assassin).toBe(1);
      // Sanity: the four buckets sum to the whole grid.
      expect(counts.red + counts.blue + counts.neutral + counts.assassin).toBe(25);
    }
  });

  it("is fully deterministic — same seed → identical board", () => {
    expect(buildBoard(555)).toEqual(buildBoard(555));
  });

  it("differs for different seeds", () => {
    const a = buildBoard(1);
    const b = buildBoard(2);
    // Either the words or the key (or both) must differ.
    expect(a.words.join() !== b.words.join() || a.key.join() !== b.key.join()).toBe(true);
  });

  it("can start either team across seeds", () => {
    const starts = new Set<string>();
    for (let s = 0; s < 30; s++) starts.add(buildBoard(s).startingTeam);
    expect(starts.has("red")).toBe(true);
    expect(starts.has("blue")).toBe(true);
  });
});

describe("remaining", () => {
  it("counts unrevealed team tiles", () => {
    const key: TileColor[] = ["red", "red", "blue", "neutral", "assassin"];
    const revealed = [false, false, false, false, false];
    expect(remaining(key, revealed)).toEqual({ red: 2, blue: 1 });
  });

  it("ignores revealed tiles and non-team colors", () => {
    const key: TileColor[] = ["red", "red", "blue", "blue", "neutral"];
    const revealed = [true, false, true, false, false];
    expect(remaining(key, revealed)).toEqual({ red: 1, blue: 1 });
  });
});

describe("teamTotal", () => {
  it("counts a team's tiles regardless of reveal state", () => {
    const b = buildBoard(7);
    expect(teamTotal(b.key, b.startingTeam)).toBe(9);
    expect(teamTotal(b.key, otherTeam(b.startingTeam))).toBe(8);
  });
});

describe("gameStatus", () => {
  const key: TileColor[] = ["red", "red", "blue", "neutral", "assassin"];

  it("is 'playing' while both teams have tiles left", () => {
    expect(gameStatus(key, [false, false, false, false, false])).toBe("playing");
  });

  it("declares red-wins when all red tiles are revealed", () => {
    expect(gameStatus(key, [true, true, false, false, false])).toBe("red-wins");
  });

  it("declares blue-wins when all blue tiles are revealed", () => {
    expect(gameStatus(key, [false, false, true, false, false])).toBe("blue-wins");
  });

  it("assassin revealed by red → blue wins (red loses)", () => {
    expect(gameStatus(key, [false, false, false, false, true], "red")).toBe("blue-wins");
  });

  it("assassin revealed by blue → red wins (blue loses)", () => {
    expect(gameStatus(key, [false, false, false, false, true], "blue")).toBe("red-wins");
  });

  it("assassin takes precedence even if a team also cleared its tiles", () => {
    // All red revealed AND assassin revealed by red on the same state.
    expect(gameStatus(key, [true, true, false, false, true], "red")).toBe("blue-wins");
  });
});

describe("guessOutcome", () => {
  it("continues the turn when you hit your own color", () => {
    expect(guessOutcome("red", "red")).toBe("continue");
    expect(guessOutcome("blue", "blue")).toBe("continue");
  });

  it("ends the turn on neutral or the opponent's color", () => {
    expect(guessOutcome("neutral", "red")).toBe("end-turn");
    expect(guessOutcome("blue", "red")).toBe("end-turn");
    expect(guessOutcome("red", "blue")).toBe("end-turn");
  });

  it("ends the game on the assassin", () => {
    expect(guessOutcome("assassin", "red")).toBe("assassin");
    expect(guessOutcome("assassin", "blue")).toBe("assassin");
  });
});

describe("otherTeam", () => {
  it("flips the team", () => {
    expect(otherTeam("red")).toBe("blue");
    expect(otherTeam("blue")).toBe("red");
  });
});
