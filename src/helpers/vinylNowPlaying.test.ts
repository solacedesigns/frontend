import { describe, expect, it } from "vitest";
import {
  currentVinylSnapshot,
  isPhonoPlayer,
  VINYL_MAX_AGE_MS,
  type VinylSnapshot,
} from "./vinylNowPlaying";

const player = {
  player_id: "record-room",
  available: true,
  powered: true,
  active_source: "phono",
};
const snapshot: VinylSnapshot = {
  player_id: player.player_id,
  state: "playing",
  source_type: "vinyl",
  title: "Bobby",
  artist: "Phoebe Bridgers",
  album: "Lost Weekend",
  artwork_url: "https://example.com/cover.jpg",
};

describe("Vinyl display eligibility", () => {
  it("requires a physically selected Phono input, not a remembered song", () => {
    expect(isPhonoPlayer(player)).toBe(true);
    expect(
      isPhonoPlayer({
        ...player,
        active_source: "ma-queue",
        current_media: { source_id: "phono" },
      }),
    ).toBe(false);
    expect(
      isPhonoPlayer({
        ...player,
        active_source: null,
        current_media: { source_id: "Phono In" },
      }),
    ).toBe(true);
    expect(
      isPhonoPlayer({ ...player, current_media: null, active_source: null }),
    ).toBe(false);
    expect(isPhonoPlayer({ ...player, powered: false })).toBe(false);
    expect(isPhonoPlayer({ ...player, available: false })).toBe(false);
  });

  it("accepts only the matching player's fresh, explicitly Vinyl snapshot", () => {
    expect(currentVinylSnapshot(player, snapshot, 10000, 10001)).toBe(snapshot);
    expect(
      currentVinylSnapshot(
        { ...player, player_id: "kitchen" },
        snapshot,
        10000,
        10001,
      ),
    ).toBeNull();
    expect(
      currentVinylSnapshot(player, snapshot, 10000, 10000 + VINYL_MAX_AGE_MS),
    ).toBeNull();
    expect(currentVinylSnapshot(player, snapshot, 10000, 9999)).toBeNull();
    expect(
      currentVinylSnapshot(
        { ...player, active_source: "dlna" },
        snapshot,
        10000,
        10001,
      ),
    ).toBeNull();
  });

  it("allows an honest waiting-for-recognition state without old artwork", () => {
    const waiting = {
      ...snapshot,
      title: "",
      artist: "",
      album: "",
      artwork_url: null,
    };
    expect(currentVinylSnapshot(player, waiting, 10000, 10001)).toBe(waiting);
  });
});
