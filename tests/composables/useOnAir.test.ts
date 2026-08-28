import { effectScope, reactive, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MediaType,
  type Player,
  type PlayerMedia,
  type QueueItem,
} from "@/plugins/api/interfaces";

const storeMock = reactive({
  activePlayer: undefined as Player | undefined,
  curQueueItem: undefined as QueueItem | undefined,
});
vi.mock("@/plugins/store", () => ({ store: storeMock }));

const sendCommand = vi.fn();
const apiState = ref("initialized");
vi.mock("@/plugins/api", () => ({
  default: { state: apiState, sendCommand },
  ConnectionState: { INITIALIZED: "initialized" },
}));

// The composable keeps one module-level cache shared by every caller, and
// the "server has no such command" latch is meant to survive unmounts. Reset
// the module per test rather than weakening that.
let useOnAir: typeof import("@/composables/useOnAir").useOnAir;

function playing(media_type: MediaType, title: string | null): Player {
  return {
    player_id: "player-1",
    powered: true,
    current_media: { media_type, title } as PlayerMedia,
  } as Player;
}

/** A resolved radio station sitting in the queue, as MA reports it. */
function radioQueueItem(name: string): QueueItem {
  return {
    queue_item_id: "item-1",
    name,
    media_item: { media_type: MediaType.RADIO, name },
  } as QueueItem;
}

/** Run the composable inside a scope so its interval and watchers clean up. */
async function withOnAir(
  body: (api: ReturnType<typeof useOnAir>) => Promise<void>,
): Promise<void> {
  const scope = effectScope();
  const result = scope.run(() => useOnAir())!;
  try {
    await body(result);
  } finally {
    scope.stop();
  }
}

const BLOCK = {
  station: "the-current",
  show_name: null,
  host_name: "Zach McCormick",
  hosts: [],
  starts_at: "2026-08-28T12:00:00-05:00",
  ends_at: "2026-08-28T15:00:00-05:00",
};

beforeEach(async () => {
  vi.resetModules();
  ({ useOnAir } = await import("@/composables/useOnAir"));
  vi.useFakeTimers();
  sendCommand.mockReset();
  apiState.value = "initialized";
  storeMock.activePlayer = playing(MediaType.RADIO, "89.3 The Current");
  storeMock.curQueueItem = undefined;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useOnAir", () => {
  it("asks about the station the player reports, not a slug", async () => {
    sendCommand.mockResolvedValue(BLOCK);
    await withOnAir(async ({ onAir, onAirLabel }) => {
      await vi.waitFor(() => expect(onAir.value).toBeDefined());
      expect(sendCommand).toHaveBeenCalledWith(
        "listening_habits/on_air",
        { station: "89.3 The Current" },
        expect.objectContaining({ suppressGlobalError: true }),
      );
      expect(onAirLabel.value).toBe("Zach McCormick");
    });
  });

  it("leads with the presenter, since a show name can be ellipsised away", async () => {
    sendCommand.mockResolvedValue({ ...BLOCK, show_name: "Teenage Kicks" });
    await withOnAir(async ({ onAirLabel }) => {
      await vi.waitFor(() =>
        expect(onAirLabel.value).toBe("Zach McCormick • Teenage Kicks"),
      );
    });
  });

  it("does not ask about a track, only a live station", async () => {
    storeMock.activePlayer = playing(MediaType.TRACK, "Iron City");
    await withOnAir(async ({ onAirLabel }) => {
      await Promise.resolve();
      expect(sendCommand).not.toHaveBeenCalled();
      expect(onAirLabel.value).toBe("");
    });
  });

  it("does not ask while the player is off", async () => {
    storeMock.activePlayer = {
      ...playing(MediaType.RADIO, "89.3 The Current"),
      powered: false,
    } as Player;
    await withOnAir(async () => {
      await Promise.resolve();
      expect(sendCommand).not.toHaveBeenCalled();
    });
  });

  it("stops asking once the server says there is no such command", async () => {
    sendCommand.mockRejectedValue(new Error("Unknown command"));
    await withOnAir(async ({ installed, refresh }) => {
      await vi.waitFor(() => expect(installed.value).toBe(false));
      await refresh();
      expect(sendCommand).toHaveBeenCalledTimes(1);
    });
  });

  it("names the station from the queue item, not the player's reported title", async () => {
    // A WiiM over DLNA reports its own state: the ICY track lands in
    // current_media.title and the station is pushed into artist. Trusting the
    // title asked about a song and got nothing back.
    storeMock.activePlayer = playing(
      MediaType.TRACK,
      "The Great Divide-Noah Kahan",
    );
    storeMock.curQueueItem = radioQueueItem("The Current");
    sendCommand.mockResolvedValue(BLOCK);
    await withOnAir(async ({ onAirLabel }) => {
      await vi.waitFor(() => expect(onAirLabel.value).toBe("Zach McCormick"));
      expect(sendCommand).toHaveBeenCalledWith(
        "listening_habits/on_air",
        { station: "The Current" },
        expect.objectContaining({ suppressGlobalError: true }),
      );
    });
  });

  it("does not re-ask when only the song changes on the same station", async () => {
    storeMock.curQueueItem = radioQueueItem("The Current");
    sendCommand.mockResolvedValue(BLOCK);
    await withOnAir(async () => {
      await vi.waitFor(() => expect(sendCommand).toHaveBeenCalledTimes(1));
      // Still typed radio, but the player rewrote the title to the new song.
      storeMock.activePlayer = playing(MediaType.RADIO, "Some Other Song");
      await Promise.resolve();
      await Promise.resolve();
      expect(sendCommand).toHaveBeenCalledTimes(1);
    });
  });

  it("drops a reply that lost a race with a station change", async () => {
    let release: (block: unknown) => void = () => {};
    sendCommand.mockImplementationOnce(
      () => new Promise((resolve) => (release = resolve)),
    );
    await withOnAir(async ({ onAir }) => {
      // Second station wins while the first request is still in flight.
      sendCommand.mockResolvedValue(null);
      storeMock.curQueueItem = radioQueueItem("KEXP");
      await vi.waitFor(() => expect(sendCommand).toHaveBeenCalledTimes(2));
      release(BLOCK);
      await Promise.resolve();
      expect(onAir.value).toBeUndefined();
    });
  });
});
