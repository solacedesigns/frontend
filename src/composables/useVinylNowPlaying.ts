import { computed, onScopeDispose, ref, watch } from "vue";
import api, { ConnectionState } from "@/plugins/api";
import { store } from "@/plugins/store";
import {
  currentVinylSnapshot,
  isPhonoPlayer,
  VINYL_REFRESH_MS,
  type VinylSnapshot,
} from "@/helpers/vinylNowPlaying";

/** Read-only presentation overlay; never mutates MA's player or queue data. */
export function useVinylNowPlaying() {
  const snapshot = ref<VinylSnapshot | null>(null);
  const receivedAt = ref(0);
  const now = ref(Date.now());
  let generation = 0;
  let loading = false;
  let disposed = false;

  async function refresh() {
    now.value = Date.now();
    const player = store.activePlayer;
    if (
      disposed ||
      !isPhonoPlayer(player) ||
      api.state?.value !== ConnectionState.INITIALIZED
    ) {
      snapshot.value = null;
      return;
    }
    if (loading) return;
    loading = true;
    const requestGeneration = generation;
    try {
      const result = await api.sendCommand<VinylSnapshot | null>(
        "listening_habits/vinyl_now_playing",
        { player_id: player!.player_id },
        { suppressGlobalError: true },
      );
      if (disposed || requestGeneration !== generation) return;
      snapshot.value = result;
      receivedAt.value = Date.now();
      now.value = receivedAt.value;
    } catch {
      // Decoration is optional on stock servers. A failed read must remove
      // the overlay, not retain an old recognized song or interrupt playback.
      if (requestGeneration === generation) snapshot.value = null;
    } finally {
      loading = false;
    }
  }

  const stopWatch = watch(
    () => [
      store.activePlayer?.player_id,
      store.activePlayer?.active_source,
      api.state?.value,
    ],
    () => {
      generation += 1;
      snapshot.value = null;
      void refresh();
    },
    { immediate: true },
  );
  const timer = setInterval(() => void refresh(), VINYL_REFRESH_MS);
  onScopeDispose(() => {
    disposed = true;
    generation += 1;
    clearInterval(timer);
    stopWatch();
  });

  return {
    vinyl: computed(() =>
      currentVinylSnapshot(
        store.activePlayer,
        snapshot.value,
        receivedAt.value,
        now.value,
      ),
    ),
  };
}
