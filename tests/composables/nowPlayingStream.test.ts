import { reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MediaType,
  type Player,
  type PlayerMedia,
  type QueueItem,
  type StreamMetadata,
} from "@/plugins/api/interfaces";

const storeMock = reactive({
  activePlayer: undefined as Player | undefined,
  curQueueItem: undefined as QueueItem | undefined,
});

vi.mock("@/plugins/store", () => ({ store: storeMock }));

const { useNowPlayingStream } = await import("@/composables/nowPlayingStream");

function player(overrides: Partial<Player> = {}): Player {
  return {
    player_id: "player-1",
    powered: true,
    ...overrides,
  } as Player;
}

/** The server sends every PlayerMedia key, using null where it has no value. */
function playerMedia(overrides: Partial<PlayerMedia> = {}): PlayerMedia {
  return {
    uri: "test://media",
    media_type: MediaType.RADIO,
    title: null,
    artist: null,
    album: null,
    album_artist: null,
    image_url: null,
    palette: null,
    duration: null,
    stream_duration: null,
    source_id: null,
    elapsed_time: null,
    elapsed_time_last_updated: null,
    queue_item_id: "item-1",
    custom_data: null,
    ...overrides,
  };
}

function streamMetadata(overrides: Partial<StreamMetadata> = {}) {
  return {
    title: "Groove Is In The Heart",
    artist: null,
    album: null,
    image_url: null,
    duration: null,
    description: null,
    uri: null,
    elapsed_time: null,
    elapsed_time_last_updated: null,
    ...overrides,
  } satisfies StreamMetadata;
}

function queueItem(meta: StreamMetadata | null): QueueItem {
  return {
    queue_item_id: "item-1",
    streamdetails: meta ? { stream_metadata: meta } : null,
  } as QueueItem;
}

beforeEach(() => {
  storeMock.activePlayer = player({
    current_media: playerMedia({ title: "The Current" }),
  });
  storeMock.curQueueItem = queueItem(streamMetadata());
});

describe("useNowPlayingStream", () => {
  it("surfaces the track on air, which the station title never shows", () => {
    storeMock.curQueueItem = queueItem(
      streamMetadata({ artist: "Deee-Lite", description: "The Local Show" }),
    );
    const { nowPlayingStream } = useNowPlayingStream();
    expect(nowPlayingStream.value).toEqual({
      title: "Groove Is In The Heart",
      artist: "Deee-Lite",
      description: "The Local Show",
    });
  });

  it("stays quiet when the stream only restates the title above it", () => {
    storeMock.activePlayer = player({
      current_media: playerMedia({ title: "Groove Is In The Heart" }),
    });
    const { nowPlayingStream } = useNowPlayingStream();
    expect(nowPlayingStream.value).toBeUndefined();
  });

  it("stays quiet when the queue item is a different item than the media", () => {
    storeMock.curQueueItem = {
      ...queueItem(streamMetadata()),
      queue_item_id: "item-2",
    };
    const { nowPlayingStream } = useNowPlayingStream();
    expect(nowPlayingStream.value).toBeUndefined();
  });

  // A guard written purely as a comparison lets this through: both sides are
  // undefined, so they compare equal and the queue item is then dereferenced.
  // The cast is the point -- a real server always sends queue_item_id, but the
  // partial player fixtures the layout suites mount do not, and the composable
  // has to survive them.
  it("stays quiet when neither the media nor the queue names an item", () => {
    const media = playerMedia();
    delete (media as Partial<PlayerMedia>).queue_item_id;
    storeMock.activePlayer = player({ current_media: media });
    storeMock.curQueueItem = undefined;
    const { nowPlayingStream } = useNowPlayingStream();
    expect(nowPlayingStream.value).toBeUndefined();
  });

  it("stays quiet for a powered-off player", () => {
    storeMock.activePlayer = player({
      powered: false,
      current_media: playerMedia({ title: "The Current" }),
    });
    const { nowPlayingStream } = useNowPlayingStream();
    expect(nowPlayingStream.value).toBeUndefined();
  });

  it("stays quiet when the item carries no stream metadata at all", () => {
    storeMock.curQueueItem = queueItem(null);
    const { nowPlayingStream } = useNowPlayingStream();
    expect(nowPlayingStream.value).toBeUndefined();
  });
});
