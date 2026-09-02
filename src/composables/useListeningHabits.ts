import { computed, onScopeDispose, ref, watch } from "vue";
import api, { ConnectionState } from "@/plugins/api";
import { store } from "@/plugins/store";

/** Reply shape of the `listening_habits/status` command. */
export interface ListeningHabitsStatus {
  configured: boolean;
  endpoint: string | null;
  healthy: boolean;
  backlog: number;
  logged_total: number;
  failed_total: number;
  last_result: string | null;
  last_error: string | null;
  last_logged: { artist?: string; title?: string; at?: number } | null;
  weather: ListeningHabitsWeather | null;
  weather_entity: string | null;
  weather_source: string | null;
}

export interface ListeningHabitsWeather {
  weather_observed_at: number;
  weather_temperature_c: number;
  weather_apparent_temperature_c: number | null;
  weather_condition: string | null;
  weather_precipitation: string | null;
  weather_symbol: string | null;
  weather_cloud_cover_pct: number | null;
  weather_wind_kph: number | null;
}

const REFRESH_MS = 30000;

// Module-level, not per-component: the OSD and the fullscreen player both want
// this and there is no reason for two of them to poll the same server.
const status = ref<ListeningHabitsStatus | undefined>();
// undefined = not asked yet, false = the server has no such command (stock
// build, or the provider is unloaded) and we should stop bothering it.
const installed = ref<boolean | undefined>();
let subscribers = 0;
let timer: ReturnType<typeof setInterval> | undefined;

async function refresh(): Promise<void> {
  if (installed.value === false) return;
  if (api.state.value !== ConnectionState.INITIALIZED) return;
  try {
    status.value = await api.sendCommand<ListeningHabitsStatus>(
      "listening_habits/status",
      undefined,
      // This provider is not part of a stock server, so "no such command" is a
      // perfectly normal answer here and must not raise an error toast.
      { suppressGlobalError: true },
    );
    installed.value = true;
  } catch {
    installed.value = false;
    status.value = undefined;
  }
}

/**
 * Composable exposing Listening Habits ingest health.
 *
 * Deliberately not per-track. The provider logs a play on *completion*, so
 * asking "was this song logged?" mid-song always answers no and means nothing.
 * What a listener can act on is whether the pipe is open and whether plays are
 * piling up behind it.
 */
export function useListeningHabits() {
  subscribers += 1;
  if (!timer) {
    timer = setInterval(refresh, REFRESH_MS);
  }
  void refresh();

  // A finished track is the moment the backlog and totals can change, so take
  // the queue item turning over as a cue rather than waiting out the interval.
  const stopWatch = watch(
    () => store.curQueueItem?.queue_item_id,
    () => void refresh(),
  );

  onScopeDispose(() => {
    stopWatch();
    subscribers -= 1;
    if (subscribers <= 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  });

  // A reconnect is also the moment a previously-absent provider may appear
  // (the DEV add-on rebuilds), so let the next poll try again.
  watch(api.state, (state) => {
    if (state === ConnectionState.INITIALIZED) {
      installed.value = undefined;
      void refresh();
    }
  });

  const available = computed(
    () => installed.value === true && status.value?.configured === true,
  );

  return { status, installed, available, refresh };
}
