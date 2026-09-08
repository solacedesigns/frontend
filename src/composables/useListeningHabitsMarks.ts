import { computed, effectScope, readonly, ref, watch } from "vue";
import api, { ConnectionState } from "@/plugins/api";
import { MediaType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { useListeningHabits } from "@/composables/useListeningHabits";

export type ListeningHabitsMarkKind = "favorite" | "dislike" | "memory";

export interface ListeningHabitsMarks {
  artist: string;
  title: string;
  favorite: boolean;
  disliked: boolean;
  memory: boolean;
  memory_available: boolean;
  memory_pending?: boolean;
}

interface CurrentTrack {
  artist: string;
  title: string;
  playerId: string;
  queueItemId: string | null;
}

let shared: ReturnType<typeof createListeningHabitsMarks> | undefined;

function currentTrack(): CurrentTrack | undefined {
  const player = store.activePlayer;
  const media = player?.current_media;
  if (!player || player.powered === false || !media) return undefined;

  const queueItem = store.curQueueItem;
  const streamMetadata = queueItem?.streamdetails?.stream_metadata;
  const isRadio =
    media.media_type === MediaType.RADIO ||
    queueItem?.media_item?.media_type === MediaType.RADIO;
  const queueArtist =
    queueItem?.media_item && "artist" in queueItem.media_item
      ? queueItem.media_item.artist
      : undefined;
  const title = String(
    (isRadio ? streamMetadata?.title : undefined) ||
      media.title ||
      queueItem?.media_item?.name ||
      queueItem?.name ||
      "",
  ).trim();
  const artist = String(
    (isRadio ? streamMetadata?.artist : undefined) ||
      media.artist ||
      queueArtist ||
      "",
  ).trim();
  if (!artist || !title) return undefined;

  return {
    artist,
    title,
    playerId: player.player_id,
    queueItemId: media.queue_item_id ?? queueItem?.queue_item_id ?? null,
  };
}

function normalizeMarks(
  result: Partial<ListeningHabitsMarks>,
): ListeningHabitsMarks {
  return {
    artist: String(result.artist ?? ""),
    title: String(result.title ?? ""),
    favorite: result.favorite === true,
    disliked: result.disliked === true,
    memory: result.memory === true,
    memory_available: result.memory_available !== false,
    memory_pending: result.memory_pending === true,
  };
}

function createListeningHabitsMarks() {
  const { available } = useListeningHabits();
  const marks = ref<ListeningHabitsMarks>();
  const loading = ref(false);
  const busyKind = ref<ListeningHabitsMarkKind>();
  const actionsInstalled = ref<boolean | undefined>();
  const track = computed(currentTrack);
  const trackKey = computed(() => {
    const value = track.value;
    return value
      ? `${value.playerId}:${value.queueItemId ?? ""}:${value.artist}\u0000${value.title}`
      : "";
  });
  const actionsAvailable = computed(
    () => available.value && actionsInstalled.value !== false,
  );

  async function refresh() {
    const value = track.value;
    const key = trackKey.value;
    if (
      !actionsAvailable.value ||
      !value ||
      api.state.value !== ConnectionState.INITIALIZED
    ) {
      marks.value = undefined;
      return;
    }

    loading.value = true;
    try {
      const result = await api.sendCommand<ListeningHabitsMarks>(
        "listening_habits/marks",
        {
          artist: value.artist,
          title: value.title,
          player_id: value.playerId,
          queue_item_id: value.queueItemId,
        },
        { suppressGlobalError: true },
      );
      if (trackKey.value === key) {
        marks.value = normalizeMarks(result);
        actionsInstalled.value = true;
      }
    } catch {
      if (trackKey.value === key) {
        marks.value = undefined;
        actionsInstalled.value = false;
      }
    } finally {
      if (trackKey.value === key) loading.value = false;
    }
  }

  async function setMark(kind: ListeningHabitsMarkKind) {
    const value = track.value;
    const current = marks.value;
    if (
      !value ||
      !current ||
      !actionsAvailable.value ||
      (kind === "memory" && !current.memory_available) ||
      busyKind.value
    ) {
      return;
    }

    const wanted = !current[kind === "dislike" ? "disliked" : kind];
    const key = trackKey.value;
    busyKind.value = kind;
    try {
      const result = await api.sendCommand<ListeningHabitsMarks>(
        "listening_habits/set_mark",
        {
          artist: value.artist,
          title: value.title,
          kind,
          wanted,
          player_id: value.playerId,
          queue_item_id: value.queueItemId,
        },
        { suppressGlobalError: true },
      );
      if (trackKey.value === key) marks.value = normalizeMarks(result);
    } finally {
      if (trackKey.value === key) busyKind.value = undefined;
    }
  }

  watch(trackKey, () => {
    marks.value = undefined;
    void refresh();
  });
  watch(available, (isAvailable) => {
    if (isAvailable) {
      actionsInstalled.value = undefined;
      void refresh();
    } else {
      marks.value = undefined;
    }
  });
  watch(api.state, (state) => {
    if (state === ConnectionState.INITIALIZED) {
      actionsInstalled.value = undefined;
      void refresh();
    }
  });

  void refresh();

  return {
    track,
    marks: readonly(marks),
    loading: readonly(loading),
    busyKind: readonly(busyKind),
    actionsAvailable,
    refresh,
    setMark,
  };
}

/** Shared LHS song verdicts and exact-play memory for every now-playing surface. */
export function useListeningHabitsMarks() {
  // Keep the watcher alive while the app is open, just like the existing
  // current-item favorite composable, so fullscreen and compact surfaces do
  // not race each other when the queue turns over.
  shared ??= effectScope(true).run(createListeningHabitsMarks)!;
  return shared;
}
