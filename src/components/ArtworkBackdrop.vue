<template>
  <div class="artwork-backdrop" aria-hidden="true">
    <img
      v-if="artworkUrl"
      :key="artworkUrl"
      :src="artworkUrl"
      class="artwork-backdrop-image"
      alt=""
      decoding="async"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{ artworkUrl: string | null }>();
</script>

<style scoped>
.artwork-backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  background: #20262a;
}
.artwork-backdrop-image {
  position: absolute;
  inset: -18%;
  width: 136%;
  height: 136%;
  max-width: none;
  object-fit: cover;
  filter: blur(clamp(60px, 8vmin, 140px)) saturate(1.35);
  opacity: 0.76;
}
.artwork-backdrop::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(to bottom, #0a0d1273 0%, #0a0d1280 50%, #06080dd9 100%),
    radial-gradient(ellipse at center, transparent 20%, #03050970 100%);
}
</style>
