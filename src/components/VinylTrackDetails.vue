<template>
  <div
    class="flex min-w-0 flex-col items-center gap-2 px-5 text-center"
    data-vinyl-details
  >
    <Badge
      variant="outline"
      class="border-transparent bg-background/40 text-inherit backdrop-blur-md"
    >
      <Disc3 :size="14" aria-hidden="true" /> Vinyl
    </Badge>
    <div class="max-w-full font-semibold" :style="{ fontSize: titleFontSize }">
      {{ vinyl.title || "Listening for the record…" }}
    </div>
    <div
      v-if="vinyl.artist"
      class="max-w-full opacity-80"
      :style="{ fontSize: subtitleFontSize }"
    >
      {{ vinyl.artist }}
    </div>
    <div
      v-if="vinyl.album"
      class="max-w-full opacity-65"
      :style="{ fontSize: subtitleFontSize }"
    >
      {{ vinyl.album }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Disc3 } from "@lucide/vue";
import type { VinylSnapshot } from "@/helpers/vinylNowPlaying";

withDefaults(
  defineProps<{
    vinyl: VinylSnapshot;
    titleFontSize?: string;
    subtitleFontSize?: string;
  }>(),
  {
    titleFontSize: "clamp(1.25rem, 3vw, 3rem)",
    subtitleFontSize: "clamp(1rem, 2vw, 2rem)",
  },
);
</script>
