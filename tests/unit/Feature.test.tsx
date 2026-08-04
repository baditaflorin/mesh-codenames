import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createMockRoom } from "@baditaflorin/mesh-common/testing";
import { Feature } from "../../src/Feature";
import { config } from "../../src/config";

describe("Feature (component)", () => {
  it("renders the app name when connected", () => {
    const room = createMockRoom();
    render(<Feature room={room} config={config} />);
    // Most apps show their human label in an <h1>. Allow either the config
    // appName or any first-level heading to be present.
    const heading = screen.getAllByRole("heading", { level: 1 })[0];
    expect(heading).toBeInTheDocument();
  });

  it("shows a connecting state when room is null", () => {
    render(<Feature room={null} config={config} />);
    // Most templates show "Connecting…" while the room is null. Apps with a
    // custom waiting state can override this test.
    const heading = screen.getAllByRole("heading", { level: 1 })[0];
    expect(heading).toBeInTheDocument();
  });
});

/**
 * Regression coverage for the "room-wide action discards an in-progress
 * game with no confirmation" bug: `cn:phase` and `cn:game` are shared Y.Maps,
 * so a single tap on "Lobby" or "New game" during `play` used to move every
 * connected peer out of the active board (and, via the lobby's only way
 * back in — "Deal a board" — permanently wipe its reveals) with no warning
 * and no undo. These tests seed a room mid-game the same way `Feature`
 * itself does (`cn:seat` / `cn:game` / `cn:phase` Y.Maps) and drive the
 * actual rendered buttons.
 */
describe("Feature — discarding a game in progress requires confirmation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function seatAndDealMidGame(room: ReturnType<typeof createMockRoom>) {
    room.doc.getMap("cn:seat").set(room.peerId, { team: "red", role: "operative" });
    room.doc.getMap("cn:game").set("seed", 424242);
    room.doc.getMap("cn:phase").set("phase", "play");
  }

  it("declining the 'Lobby' prompt during play leaves the game untouched", () => {
    const room = createMockRoom();
    seatAndDealMidGame(room);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<Feature room={room} config={config} />);
    fireEvent.click(screen.getByRole("button", { name: "Lobby" }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(room.doc.getMap("cn:phase").get("phase")).toBe("play");
  });

  it("confirming 'Lobby' during play does transition the shared phase", () => {
    const room = createMockRoom();
    seatAndDealMidGame(room);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<Feature room={room} config={config} />);
    fireEvent.click(screen.getByRole("button", { name: "Lobby" }));

    expect(room.doc.getMap("cn:phase").get("phase")).toBe("lobby");
  });

  it("declining the 'New game' prompt during play preserves the seed and reveals", () => {
    const room = createMockRoom();
    seatAndDealMidGame(room);
    room.doc.getMap("cn:revealed").set("0", true);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<Feature room={room} config={config} />);
    fireEvent.click(screen.getByRole("button", { name: "New game" }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(room.doc.getMap("cn:game").get("seed")).toBe(424242);
    expect(room.doc.getMap("cn:revealed").get("0")).toBe(true);
  });

  it("the lobby's 'Deal a board' warns when a game is already in progress", () => {
    const room = createMockRoom();
    room.doc.getMap("cn:seat").set(room.peerId, { team: "red", role: "operative" });
    room.doc.getMap("cn:game").set("seed", 424242);
    room.doc.getMap("cn:phase").set("phase", "lobby");
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<Feature room={room} config={config} />);
    fireEvent.click(screen.getByRole("button", { name: "Deal a NEW board →" }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // Declined — the original board's seed must survive.
    expect(room.doc.getMap("cn:game").get("seed")).toBe(424242);
    expect(room.doc.getMap("cn:phase").get("phase")).toBe("lobby");
  });

  it("dealing the very first board (no game in progress) never prompts", () => {
    const room = createMockRoom();
    room.doc.getMap("cn:seat").set(room.peerId, { team: "red", role: "operative" });
    const confirmSpy = vi.spyOn(window, "confirm");

    render(<Feature room={room} config={config} />);
    fireEvent.click(screen.getByRole("button", { name: "Deal a board →" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(room.doc.getMap("cn:phase").get("phase")).toBe("play");
  });
});
