<template>
  <Popover v-if="weather">
    <PopoverTrigger as-child>
      <Button
        :variant="pill ? 'ghost-outline' : 'outline'"
        size="xs"
        :title="hoverText"
        :aria-label="hoverText"
      >
        <CloudSun :size="16" />
        <span>{{ temperatureF }}°</span>
        <span v-if="showCondition" class="weather-condition">{{
          weather.weather_condition
        }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent
      :side="pill ? 'bottom' : 'top'"
      align="center"
      :collision-padding="8"
      class="w-64 text-sm"
    >
      <div class="font-semibold">
        {{ $t("listening_habits.weather.title") }}
      </div>
      <div class="mt-1 text-xs opacity-70">{{ observedText }}</div>
      <dl class="weather-details mt-3">
        <div>
          <dt>{{ $t("listening_habits.weather.condition") }}</dt>
          <dd>{{ weather.weather_condition || "—" }}</dd>
        </div>
        <div v-if="feelsLikeF !== null">
          <dt>{{ $t("listening_habits.weather.feels_like") }}</dt>
          <dd>{{ feelsLikeF }}°F</dd>
        </div>
        <div>
          <dt>{{ $t("listening_habits.weather.precipitation") }}</dt>
          <dd>
            {{
              weather.weather_precipitation ||
              $t("listening_habits.weather.none")
            }}
          </dd>
        </div>
        <div v-if="windMph !== null">
          <dt>{{ $t("listening_habits.weather.wind") }}</dt>
          <dd>{{ windMph }} mph</dd>
        </div>
        <div v-if="weather.weather_cloud_cover_pct !== null">
          <dt>{{ $t("listening_habits.weather.cloud_cover") }}</dt>
          <dd>{{ weather.weather_cloud_cover_pct }}%</dd>
        </div>
        <div v-if="status?.weather_source">
          <dt>{{ $t("listening_habits.weather.source") }}</dt>
          <dd class="max-w-36 truncate" :title="status.weather_source">
            {{ status.weather_source }}
          </dd>
        </div>
      </dl>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { CloudSun } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useListeningHabits } from "@/composables/useListeningHabits";
import { $t } from "@/plugins/i18n";

const props = withDefaults(
  defineProps<{ pill?: boolean; compact?: boolean }>(),
  {
    pill: false,
    compact: false,
  },
);
const { status } = useListeningHabits();
const weather = computed(() => status.value?.weather ?? null);
const showCondition = computed(
  () => !props.compact || Boolean(weather.value?.weather_condition),
);
const temperatureF = computed(() =>
  weather.value
    ? Math.round((weather.value.weather_temperature_c * 9) / 5 + 32)
    : null,
);
const feelsLikeF = computed(() => {
  const value = weather.value?.weather_apparent_temperature_c;
  return value == null ? null : Math.round((value * 9) / 5 + 32);
});
const windMph = computed(() => {
  const value = weather.value?.weather_wind_kph;
  return value == null ? null : Math.round(value * 0.621371);
});
const observedText = computed(() => {
  const timestamp = weather.value?.weather_observed_at;
  if (!timestamp) return $t("listening_habits.weather.observed_unknown");
  return $t("listening_habits.weather.observed", {
    time: new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp * 1000)),
  });
});
const hoverText = computed(
  () =>
    `${temperatureF.value}°F · ${weather.value?.weather_condition || ""} · ${observedText.value}`,
);
</script>

<style scoped>
.weather-condition {
  max-width: 9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.weather-details > div {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
}

.weather-details dt {
  opacity: 0.7;
}

.weather-details dd {
  text-align: right;
}
</style>
