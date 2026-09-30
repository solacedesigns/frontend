import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick } from "vue";
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import { useVinylNowPlaying } from "@/composables/useVinylNowPlaying";
import {
  VINYL_REFRESH_MS,
  VINYL_MAX_AGE_MS,
  type VinylSnapshot,
} from "@/helpers/vinylNowPlaying";

vi.mock("@/plugins/api", async () => {
  const { reactive } = await import("vue");
  return {
    default: reactive({
      state: { value: "initialized" },
      sendCommand: vi.fn(),
    }),
    ConnectionState: { INITIALIZED: "initialized" },
  };
});
vi.mock("@/plugins/store", async () => {
  const { reactive } = await import("vue");
  return {
    store: reactive({
      activePlayer: {
        player_id: "record-room",
        active_source: "phono",
        available: true,
        powered: true,
      },
    }),
  };
});

const snapshot: VinylSnapshot = {
  player_id: "record-room",
  state: "playing",
  source_type: "vinyl",
  title: "Bobby",
  artist: "Phoebe Bridgers",
  album: "Lost Weekend",
  artwork_url: "https://example.com/cover.jpg",
};
let scope: ReturnType<typeof effectScope>;
function start() {
  scope = effectScope();
  return scope.run(useVinylNowPlaying)!;
}
async function flush() {
  await Promise.resolve();
  await nextTick();
}

describe("useVinylNowPlaying", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(api.sendCommand).mockReset().mockResolvedValue(snapshot);
    store.activePlayer!.player_id = "record-room";
    store.activePlayer!.active_source = "phono";
  });
  afterEach(() => {
    scope?.stop();
    vi.useRealTimers();
  });

  it("reads decoration only, then refreshes recognized songs without changing the queue", async () => {
    const { vinyl } = start();
    await flush();
    expect(vinyl.value).toEqual(snapshot);
    expect(api.sendCommand).toHaveBeenCalledWith(
      "listening_habits/vinyl_now_playing",
      { player_id: "record-room" },
      { suppressGlobalError: true },
    );
    vi.mocked(api.sendCommand).mockResolvedValue({
      ...snapshot,
      title: "The Outside",
    });
    await vi.advanceTimersByTimeAsync(VINYL_REFRESH_MS);
    expect(vinyl.value?.title).toBe("The Outside");
    expect(api.sendCommand).toHaveBeenCalledTimes(2);
  });
  it("removes Vinyl immediately on a native streaming source switch", async () => {
    const { vinyl } = start();
    await flush();
    store.activePlayer!.active_source = "ma-queue";
    expect(vinyl.value).toBeNull();
    await flush();
    await vi.advanceTimersByTimeAsync(VINYL_REFRESH_MS);
    expect(api.sendCommand).toHaveBeenCalledTimes(1);
  });
  it("discards a late reply after selecting another player", async () => {
    let resolve!: (value: VinylSnapshot) => void;
    vi.mocked(api.sendCommand).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { vinyl } = start();
    store.activePlayer!.player_id = "kitchen";
    await flush();
    resolve(snapshot);
    await flush();
    expect(vinyl.value).toBeNull();
  });
  it("drops old artwork when recognition is waiting or the live bridge fails", async () => {
    const { vinyl } = start();
    await flush();
    vi.mocked(api.sendCommand).mockResolvedValue({
      ...snapshot,
      title: "",
      artist: "",
      album: "",
      artwork_url: null,
    });
    await vi.advanceTimersByTimeAsync(VINYL_REFRESH_MS);
    expect(vinyl.value?.artwork_url).toBeNull();
    vi.mocked(api.sendCommand).mockRejectedValue(new Error("unavailable"));
    await vi.advanceTimersByTimeAsync(VINYL_REFRESH_MS);
    expect(vinyl.value).toBeNull();
  });
  it("expires a snapshot even if the next command hangs, and stops polling on disposal", async () => {
    const { vinyl } = start();
    await flush();
    vi.mocked(api.sendCommand).mockImplementationOnce(
      () => new Promise(() => {}),
    );
    await vi.advanceTimersByTimeAsync(VINYL_MAX_AGE_MS);
    expect(vinyl.value).toBeNull();
    const calls = vi.mocked(api.sendCommand).mock.calls.length;
    scope.stop();
    await vi.advanceTimersByTimeAsync(VINYL_REFRESH_MS * 3);
    expect(api.sendCommand).toHaveBeenCalledTimes(calls);
  });
});
