import { computed, onScopeDispose, ref, watch } from "vue";
import api, { ConnectionState } from "@/plugins/api";
import { MediaType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";

/** One presenter, with a photo when the station publishes one. */
export interface OnAirHost {
  name: string;
  /** camelCase: the plugin passes the station's own scraped shape through. */
  photoUrl?: string | null;
}

/** Reply shape of the `listening_habits/on_air` command. */
export interface OnAir {
  station: string | null;
  /** null for a station's ordinary rotation, which has no show worth naming. */
  show_name: string | null;
  host_name: string | null;
  hosts: OnAirHost[];
  starts_at: string | null;
  ends_at: string | null;
}

// Blocks are hours long and the server caches against each block's own end
// time, so this only has to be frequent enough to catch a handover, not to
// track a song.
const REFRESH_MS = 120000;

const onAir = ref<OnAir | undefined>();
// undefined = not asked yet, false = the server has no such command.
const installed = ref<boolean | undefined>();
let subscribers = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let lastStation: string | undefined;

/**
 * The station name to ask about, or undefined when nothing live is playing.
 *
 * Read from the queue item rather than current_media. The queue item holds the
 * station MA resolved when playback started and no player can overwrite it,
 * whereas current_media is whatever the *player* reports: on a provider that
 * reports its own state (a WiiM over DLNA) the ICY track lands in `title` and
 * the station is pushed into `artist`, so the title names the song instead.
 */
function currentStation(): string | undefined {
  if (store.activePlayer?.powered === false) return undefined;
  const item = store.curQueueItem;
  if (item?.media_item?.media_type === MediaType.RADIO) {
    return item.media_item.name || item.name || undefined;
  }
  // Only reached when the queue item has no resolved media item.
  const media = store.activePlayer?.current_media;
  if (media?.media_type === MediaType.RADIO) return media.title ?? undefined;
  return undefined;
}

async function refresh(): Promise<void> {
  if (installed.value === false) return;
  if (api.state.value !== ConnectionState.INITIALIZED) return;
  const station = currentStation();
  lastStation = station;
  if (!station) {
    onAir.value = undefined;
    return;
  }
  try {
    const result = await api.sendCommand<OnAir | null>(
      "listening_habits/on_air",
      { station },
      // Absent on a stock server, and this is decoration: never toast.
      { suppressGlobalError: true },
    );
    // Drop a reply that lost a race with a station change, rather than
    // captioning the new station with the old station's DJ.
    if (lastStation !== station) return;
    onAir.value = result ?? undefined;
    installed.value = true;
  } catch {
    installed.value = false;
    onAir.value = undefined;
  }
}

/**
 * Composable exposing who is presenting on the live station now playing.
 *
 * MA cannot know this on its own. ICY metadata carries the song and nothing
 * else, and StreamMetadata.description -- the field meant for exactly this --
 * is populated by only a couple of providers. The answer comes from the log
 * server, which already scrapes the station's schedule to attribute plays.
 */
export function useOnAir() {
  subscribers += 1;
  if (!timer) timer = setInterval(refresh, REFRESH_MS);
  void refresh();

  // The station changing is the one event that invalidates this immediately.
  // Watching the resolved name rather than a raw field means a new song on the
  // same station does not trigger a lookup.
  const stopWatch = watch(currentStation, () => void refresh());

  const stopState = watch(api.state, (state) => {
    if (state === ConnectionState.INITIALIZED) {
      installed.value = undefined;
      void refresh();
    }
  });

  onScopeDispose(() => {
    stopWatch();
    stopState();
    subscribers -= 1;
    if (subscribers <= 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  });

  /**
   * "Jill Riley • The Morning Show", "Jill Riley", or "" when nothing is
   * known. Presenter first: show names run long enough to be ellipsised
   * ("The Morning Show -- in the Afternoon -- live from the State Fair"),
   * and the person is the part worth surviving that.
   */
  const onAirLabel = computed(() => {
    const block = onAir.value;
    if (!block) return "";
    return [block.host_name, block.show_name].filter(Boolean).join(" • ");
  });

  return { onAir, onAirLabel, installed, refresh };
}
