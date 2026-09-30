<template>
  <div
    class="vinyl-artwork"
    :class="{ 'has-cover': artworkUrl, spinning: playing && !hidden }"
    role="img"
    :aria-label="
      artworkUrl
        ? 'Vinyl record and album artwork'
        : 'Waiting to identify the record'
    "
  >
    <div class="disc-position" aria-hidden="true">
      <div class="disc-motion">
        <img :src="recordImage" class="record" alt="" />
        <div class="label"></div>
        <div class="spindle"></div>
      </div>
    </div>
    <img v-if="artworkUrl" :src="artworkUrl" class="sleeve" alt="" />
  </div>
</template>

<script setup lang="ts">
import { useDocumentVisibility } from "@vueuse/core";
import { computed } from "vue";
import recordImage from "@/assets/vinyl-record.png";

defineProps<{ artworkUrl: string | null; playing: boolean }>();
const visibility = useDocumentVisibility();
const hidden = computed(() => visibility.value === "hidden");
</script>

<style scoped>
.vinyl-artwork {
  position: relative;
  width: 100%;
  aspect-ratio: 1.4;
  flex: 0 0 auto;
}
@supports (width: 1cqi) {
  .vinyl-artwork {
    width: min(100cqi, 140cqh);
  }
}
.disc-position {
  position: absolute;
  width: 69%;
  aspect-ratio: 1;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  filter: drop-shadow(7px 7px 12px #0009);
}
.has-cover .disc-position {
  left: 62%;
}
.disc-motion {
  width: 100%;
  height: 100%;
  position: relative;
  animation: vinyl-spin 2.4s linear infinite;
  animation-play-state: paused;
}
.spinning .disc-motion {
  animation-play-state: running;
}
.record {
  width: 100%;
  height: 100%;
  display: block;
}
.label {
  position: absolute;
  width: 33.7%;
  aspect-ratio: 1;
  border-radius: 50%;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  background: #ded6c5;
  border: 1px solid #0005;
}
.label::before {
  content: "";
  position: absolute;
  inset: 12%;
  border: 1px solid #0002;
  border-radius: 50%;
}
.label::after {
  content: "";
  position: absolute;
  width: 20%;
  height: 6%;
  left: 40%;
  top: 25%;
  background: #0005;
  border-radius: 2px;
}
.spindle {
  position: absolute;
  width: 3%;
  aspect-ratio: 1;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: #171719;
}
.sleeve {
  position: absolute;
  width: 71.4%;
  aspect-ratio: 1;
  left: 39%;
  top: 50%;
  transform: translate(-50%, -50%);
  object-fit: contain;
  box-shadow: 0 5px 16px #0008;
  background: #242426;
}
@keyframes vinyl-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .disc-motion {
    animation: none;
  }
}
</style>
