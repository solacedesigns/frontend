<template>
  <div
    v-if="actionsAvailable && track && marks"
    class="listening-habits-marks"
    :class="{ 'listening-habits-marks--pill': pill }"
  >
    <TooltipProvider :delay-duration="200">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost-outline"
            :size="showLabel ? 'xs' : 'icon-xs'"
            :class="[pillClass, marks?.favorite ? activePillClass : '']"
            :disabled="!!busyKind"
            :aria-label="favoriteLabel"
            :aria-pressed="marks?.favorite ?? false"
            @click.stop="toggle('favorite')"
          >
            <Heart
              :size="16"
              :fill="marks?.favorite ? 'currentColor' : 'none'"
            />
            <span v-if="showLabel">{{
              $t("listening_habits.marks.favorite")
            }}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="z-[10001]">
          {{ favoriteLabel }}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost-outline"
            :size="showLabel ? 'xs' : 'icon-xs'"
            :class="[pillClass, marks?.disliked ? activePillClass : '']"
            :disabled="!!busyKind"
            :aria-label="dislikeLabel"
            :aria-pressed="marks?.disliked ?? false"
            @click.stop="toggle('dislike')"
          >
            <ThumbsDown
              :size="16"
              :fill="marks?.disliked ? 'currentColor' : 'none'"
            />
            <span v-if="showLabel">{{
              $t("listening_habits.marks.dislike")
            }}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="z-[10001]">
          {{ dislikeLabel }}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost-outline"
            :size="showLabel ? 'xs' : 'icon-xs'"
            :class="[pillClass, marks?.memory ? activePillClass : '']"
            :disabled="!!busyKind || !marks?.memory_available"
            :aria-label="memoryLabel"
            :aria-pressed="marks?.memory ?? false"
            @click.stop="toggle('memory')"
          >
            <Flag :size="16" :fill="marks?.memory ? 'currentColor' : 'none'" />
            <span v-if="showLabel">{{
              $t("listening_habits.marks.memory")
            }}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" class="z-[10001] max-w-[260px]">
          {{ memoryLabel }}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { toast } from "vue-sonner";
import { Flag, Heart, ThumbsDown } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { $t } from "@/plugins/i18n";
import {
  type ListeningHabitsMarkKind,
  useListeningHabitsMarks,
} from "@/composables/useListeningHabitsMarks";
import { store } from "@/plugins/store";

const props = withDefaults(defineProps<{ pill?: boolean }>(), { pill: false });

const { track, marks, busyKind, actionsAvailable, setMark } =
  useListeningHabitsMarks();

const showLabel = computed(() => props.pill && !store.mobileLayout);
const pillClass = "relative";
const activePillClass =
  "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground dark:bg-primary dark:hover:bg-primary/90";

const favoriteLabel = computed(() =>
  marks.value?.favorite
    ? $t("listening_habits.marks.favorite_remove")
    : $t("listening_habits.marks.favorite_add"),
);
const dislikeLabel = computed(() =>
  marks.value?.disliked
    ? $t("listening_habits.marks.dislike_remove")
    : $t("listening_habits.marks.dislike_add"),
);
const memoryLabel = computed(() => {
  if (!marks.value?.memory_available) {
    return $t("listening_habits.marks.memory_waiting");
  }
  return marks.value.memory
    ? $t("listening_habits.marks.memory_remove")
    : $t("listening_habits.marks.memory_add");
});

async function toggle(kind: ListeningHabitsMarkKind) {
  try {
    await setMark(kind);
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : $t("listening_habits.marks.failed"),
    );
  }
}
</script>

<style scoped>
.listening-habits-marks {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.listening-habits-marks--pill {
  gap: 6px;
}
</style>
