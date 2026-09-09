<template>
  <section v-if="visible" class="listening-habits-detail" aria-live="polite">
    <div class="listening-habits-detail-heading">
      {{ $t("listening_habits.stats.title") }}
    </div>
    <div v-if="loading" class="listening-habits-detail-loading">
      {{ $t("listening_habits.stats.loading") }}
    </div>
    <template v-else>
      <div class="listening-habits-detail-count">
        {{ $t("listening_habits.stats.listens", { count: listens }) }}
      </div>
      <div v-if="summary?.listens" class="listening-habits-detail-grid">
        <div>
          <span>{{ $t("listening_habits.stats.first") }}</span>
          <strong>{{ firstListen }}</strong>
        </div>
        <div>
          <span>{{ $t("listening_habits.stats.last") }}</span>
          <strong>{{ lastListen }}</strong>
        </div>
        <div v-if="kind === 'radio'">
          <span>{{ $t("listening_habits.stats.hours") }}</span>
          <strong>{{ hoursListened }}</strong>
        </div>
      </div>
      <div v-else class="listening-habits-detail-empty">
        {{ $t("listening_habits.stats.none") }}
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import api, { ConnectionState } from "@/plugins/api";
import { MediaType, type MediaItemType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { useListeningHabits } from "@/composables/useListeningHabits";

interface DetailSummary {
  listens?: number;
  days?: number;
  first_played_at?: number | null;
  last_played_at?: number | null;
  listened_seconds?: number | null;
}

interface DetailResponse {
  found?: boolean;
  summary?: DetailSummary | null;
}

type DetailKind = "track" | "album" | "artist" | "radio";

const props = defineProps<{
  item: Exclude<MediaItemType, { media_type: MediaType.FOLDER }>;
}>();

const { available, status } = useListeningHabits();
const result = ref<DetailResponse>();
const loading = ref(false);

const itemArtist = computed(() => {
  const item = props.item;
  if (!("artists" in item) || !Array.isArray(item.artists)) return "";
  return item.artists
    .map((artist) => String(artist.name || "").trim())
    .filter(Boolean)
    .join(" and ");
});

const kind = computed<DetailKind | undefined>(() => {
  switch (props.item.media_type) {
    case MediaType.TRACK:
      return "track";
    case MediaType.ALBUM:
      return "album";
    case MediaType.ARTIST:
      return "artist";
    case MediaType.RADIO:
      return "radio";
    default:
      return undefined;
  }
});

const request = computed(() => {
  const currentKind = kind.value;
  if (!currentKind) return undefined;
  if (currentKind === "radio") {
    return { kind: currentKind, station: props.item.name };
  }
  const artist = currentKind === "artist" ? props.item.name : itemArtist.value;
  if (!artist) return undefined;
  if (currentKind === "track") {
    return { kind: currentKind, artist, title: props.item.name };
  }
  if (currentKind === "album") {
    return { kind: currentKind, artist, album: props.item.name };
  }
  return { kind: currentKind, artist };
});

const requestKey = computed(() => JSON.stringify(request.value ?? null));

async function refresh() {
  const params = request.value;
  const key = requestKey.value;
  if (
    !available.value ||
    !params ||
    api.state.value !== ConnectionState.INITIALIZED
  ) {
    result.value = undefined;
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const response = await api.sendCommand<DetailResponse>(
      "listening_habits/stats",
      params,
      { suppressGlobalError: true },
    );
    if (requestKey.value === key) result.value = response;
  } catch {
    if (requestKey.value === key) result.value = undefined;
  } finally {
    if (requestKey.value === key) loading.value = false;
  }
}

watch(
  [available, requestKey, () => status.value?.logged_total],
  () => void refresh(),
  { immediate: true },
);

const summary = computed(() => result.value?.summary ?? null);
const visible = computed(() => Boolean(available.value && kind.value));
const listens = computed(() => Number(summary.value?.listens ?? 0));

function formatTimestamp(value: number | null | undefined) {
  if (!value) return $t("listening_habits.stats.unknown");
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value * 1000));
}

const firstListen = computed(() =>
  formatTimestamp(summary.value?.first_played_at),
);
const lastListen = computed(() =>
  formatTimestamp(summary.value?.last_played_at),
);

function formatHours(value: number) {
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}

const hoursListened = computed(() => {
  const seconds = Math.max(0, Number(summary.value?.listened_seconds ?? 0));
  const days = Math.max(1, Number(summary.value?.days ?? 0));
  const hours = seconds / 3600;
  const perDay = hours / days;
  return $t("listening_habits.stats.hours_value", {
    hours: formatHours(hours),
    perDay: formatHours(perDay),
  });
});
</script>

<style scoped>
.listening-habits-detail {
  margin: 0 14px 10px;
  padding: 8px 11px;
  border: 1px solid rgba(var(--v-theme-primary), 0.28);
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.06);
  color: inherit;
  font-size: 0.82rem;
  max-width: 46rem;
}

.listening-habits-detail-heading {
  font-weight: 600;
  letter-spacing: 0.02em;
  opacity: 0.86;
}

.listening-habits-detail-count {
  margin-top: 3px;
  font-size: 0.95rem;
  font-weight: 600;
}

.listening-habits-detail-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  margin-top: 5px;
}

.listening-habits-detail-grid > div {
  display: flex;
  gap: 5px;
  min-width: 11rem;
}

.listening-habits-detail-grid span {
  opacity: 0.68;
}

.listening-habits-detail-grid strong {
  font-weight: 500;
}

.listening-habits-detail-loading,
.listening-habits-detail-empty {
  margin-top: 3px;
  opacity: 0.68;
}
</style>
