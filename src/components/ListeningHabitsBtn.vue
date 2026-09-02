<template>
  <!-- Listening Habits ingest status -->
  <Popover v-if="available">
    <PopoverTrigger as-child>
      <Button
        :variant="pill ? 'ghost-outline' : 'outline'"
        size="xs"
        :title="$t('listening_habits.details')"
        :aria-label="ariaLabel"
      >
        <span
          class="listening-habits-dot"
          :style="{ backgroundColor: dotColor }"
        ></span>
        <span class="tracking-wide">{{ label }}</span>
      </Button>
    </PopoverTrigger>

    <PopoverContent
      :side="pill ? 'bottom' : 'top'"
      align="center"
      :collision-padding="8"
      class="listening-habits-popover"
      :aria-label="$t('listening_habits.details')"
    >
      <div class="listening-habits-body">
        <div class="listening-habits-heading">
          {{ $t("listening_habits.title") }}
        </div>
        <!-- the error is the whole point of the chip when there is one, so it
             leads rather than sitting at the bottom of the stat list -->
        <div v-if="status?.last_error" class="listening-habits-error">
          {{ status.last_error }}
        </div>
        <dl class="listening-habits-stats">
          <div v-if="status?.last_logged?.title">
            <dt>{{ $t("listening_habits.last_logged") }}</dt>
            <dd>
              {{ status.last_logged.artist }} &mdash;
              {{ status.last_logged.title }}
            </dd>
          </div>
          <div v-if="status?.last_logged?.at">
            <dt>{{ $t("listening_habits.last_logged_at") }}</dt>
            <dd>{{ formatLoggedAt(status.last_logged.at) }}</dd>
          </div>
          <div>
            <dt>{{ $t("listening_habits.logged_total") }}</dt>
            <dd>{{ status?.logged_total ?? 0 }}</dd>
          </div>
          <div v-if="status?.failed_total">
            <dt>{{ $t("listening_habits.failed_total") }}</dt>
            <dd>{{ status.failed_total }}</dd>
          </div>
          <div v-if="status?.backlog">
            <dt>{{ $t("listening_habits.queued") }}</dt>
            <dd>{{ status.backlog }}</dd>
          </div>
          <div v-if="status?.endpoint">
            <dt>{{ $t("listening_habits.endpoint") }}</dt>
            <dd class="listening-habits-endpoint">{{ status.endpoint }}</dd>
          </div>
        </dl>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { $t } from "@/plugins/i18n";
import { useListeningHabits } from "@/composables/useListeningHabits";

// match the rounded "pill" styling of the fullscreen player header controls
defineProps<{ pill?: boolean }>();

const { status, available } = useListeningHabits();

const formatLoggedAt = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(timestamp * 1000));

// Amber, not red, for a backlog: nothing is lost, the retry loop owns it and
// will drain it. Red is reserved for pushes that actually failed.
const dotColor = computed(() => {
  if (!status.value?.healthy) return "rgb(239 68 68)";
  if (status.value.backlog > 0) return "rgb(245 158 11)";
  return "rgb(34 197 94)";
});

const label = computed(() => {
  if (!status.value?.healthy) return $t("listening_habits.not_logging");
  if (status.value.backlog > 0)
    return $t("listening_habits.queued_count", { count: status.value.backlog });
  return $t("listening_habits.logging");
});

const ariaLabel = computed(
  () => `${$t("listening_habits.title")}: ${label.value}`,
);
</script>

<style scoped>
.listening-habits-popover {
  width: min(28rem, calc(100vw - 16px));
}

.listening-habits-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  flex: none;
}

.listening-habits-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 0.8125rem;
}

.listening-habits-heading {
  font-weight: 600;
}

.listening-habits-error {
  color: rgb(239 68 68);
  overflow-wrap: anywhere;
}

.listening-habits-stats > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.listening-habits-stats dt {
  opacity: 0.7;
  white-space: nowrap;
}

.listening-habits-stats dd {
  text-align: right;
  overflow-wrap: anywhere;
}

/* an endpoint URL has no spaces to wrap on and would otherwise widen the
   popover past the screen */
.listening-habits-endpoint {
  font-family: monospace;
  font-size: 0.75rem;
  white-space: nowrap;
}

@media (max-width: 480px) {
  .listening-habits-endpoint {
    overflow-wrap: anywhere;
    white-space: normal;
  }
}
</style>
