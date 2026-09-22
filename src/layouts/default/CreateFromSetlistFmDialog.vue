<template>
  <Dialog v-model:open="showDialog">
    <DialogContent class="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{{ $t("create_playlist_from_setlistfm") }}</DialogTitle>
        <DialogDescription>
          {{ $t("setlistfm_dialog_description") }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <Label for="setlistfm-url">{{ $t("setlistfm_url") }}</Label>
          <Input
            id="setlistfm-url"
            v-model="setlistUrl"
            :placeholder="$t('setlistfm_url_placeholder')"
            type="url"
            @keyup.enter="loadSetlist"
          />
        </div>

        <div class="flex flex-col gap-2">
          <Label for="setlistfm-provider">{{
            $t("setlistfm_target_service")
          }}</Label>
          <Select
            v-model="providerId"
            :disabled="!playlistProviders.length || loading || creating"
            @update:model-value="clearPreview"
          >
            <SelectTrigger id="setlistfm-provider" class="w-full">
              <SelectValue :placeholder="$t('setlistfm_select_service')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="provider in playlistProviders"
                :key="provider.instance_id"
                :value="provider.instance_id"
              >
                {{ provider.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p
            v-if="!playlistProviders.length"
            class="text-sm text-muted-foreground"
          >
            {{ $t("setlistfm_no_supported_services") }}
          </p>
        </div>

        <div v-if="preview" class="flex flex-col gap-3">
          <div class="rounded-md border p-3">
            <p class="font-medium">{{ preview.artist }}</p>
            <p class="text-sm text-muted-foreground">
              {{
                [preview.event_date, preview.venue].filter(Boolean).join(" · ")
              }}
            </p>
          </div>
          <div class="flex flex-col gap-2">
            <Label for="setlistfm-playlist-name">{{
              $t("new_playlist_name")
            }}</Label>
            <Input id="setlistfm-playlist-name" v-model="playlistName" />
          </div>
          <p class="text-sm text-muted-foreground">
            {{
              $t("setlistfm_match_summary", [
                matchedCount,
                preview.tracks.length,
              ])
            }}
          </p>
          <ol
            class="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-md border p-3"
          >
            <li
              v-for="(track, index) in preview.tracks"
              :key="`${index}-${track.name}`"
              class="flex items-start gap-3"
            >
              <span
                class="min-w-6 pt-2 text-right text-sm text-muted-foreground"
              >
                {{ index + 1 }}.
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">
                  {{ track.name }}
                  <span
                    v-if="track.info || track.cover_artist"
                    class="font-normal text-muted-foreground"
                  >
                    ({{
                      [track.info, track.cover_artist]
                        .filter(Boolean)
                        .join(" · ")
                    }})
                  </span>
                </p>
                <Select v-model="selectedTrackUris[index]">
                  <SelectTrigger
                    class="mt-1 w-full"
                    :aria-label="$t('setlistfm_match_for_track', [track.name])"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem :value="SKIP_TRACK_VALUE">
                      {{ $t("setlistfm_skip_track") }}
                    </SelectItem>
                    <SelectItem
                      v-for="candidate in track.candidates"
                      :key="candidate.uri"
                      :value="candidate.uri"
                    >
                      {{ candidateLabel(candidate) }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </li>
          </ol>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="loading || creating"
          @click="showDialog = false"
        >
          {{ $t("close") }}
        </Button>
        <Button
          v-if="!preview"
          :disabled="
            !setlistUrl.trim() ||
            !providerId ||
            loading ||
            !playlistProviders.length
          "
          @click="loadSetlist"
        >
          {{ loading ? $t("setlistfm_loading") : $t("setlistfm_preview") }}
        </Button>
        <Button
          v-else
          :disabled="!playlistName.trim() || !matchedCount || creating"
          @click="createPlaylist"
        >
          {{
            creating ? $t("setlistfm_loading") : $t("setlistfm_create_playlist")
          }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { toast } from "vue-sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/plugins/api";
import {
  MediaType,
  ProviderFeature,
  ProviderType,
  type SetlistFmTrackCandidate,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import router from "@/plugins/router";
import { store } from "@/plugins/store";

const showDialog = ref(false);
const SKIP_TRACK_VALUE = "__skip__";
const setlistUrl = ref("");
const providerId = ref("");
const playlistName = ref("");
const selectedTrackUris = ref<Record<number, string>>({});
const preview = ref<Awaited<ReturnType<typeof api.previewSetlistFm>> | null>(
  null,
);
const loading = ref(false);
const creating = ref(false);

const playlistProviders = computed(() =>
  Object.values(api.providers)
    .filter(
      (provider) =>
        provider.available &&
        provider.type === ProviderType.MUSIC &&
        provider.supported_features.includes(ProviderFeature.SEARCH) &&
        provider.supported_features.includes(
          ProviderFeature.PLAYLIST_TRACKS_EDIT,
        ) &&
        (provider.supported_features.includes(
          ProviderFeature.PLAYLIST_CREATE,
        ) ||
          provider.supported_features.includes(
            ProviderFeature.PLAYLIST_CREATE_TRACKS,
          )),
    )
    .sort((a, b) => a.name.localeCompare(b.name)),
);

const matchedCount = computed(
  () =>
    Object.values(selectedTrackUris.value).filter(
      (uri) => uri && uri !== SKIP_TRACK_VALUE,
    ).length,
);

watch(showDialog, (open) => {
  store.dialogActive = open;
});

onMounted(() => {
  eventbus.on("createSetlistFmPlaylist", openDialog);
});

onBeforeUnmount(() => {
  eventbus.off("createSetlistFmPlaylist", openDialog);
});

function openDialog() {
  setlistUrl.value = "";
  playlistName.value = "";
  preview.value = null;
  selectedTrackUris.value = {};
  providerId.value = playlistProviders.value[0]?.instance_id ?? "";
  showDialog.value = true;
}

function clearPreview() {
  preview.value = null;
  selectedTrackUris.value = {};
}

async function loadSetlist() {
  if (!setlistUrl.value.trim() || !providerId.value) return;
  loading.value = true;
  try {
    const result = await api.previewSetlistFm(
      setlistUrl.value.trim(),
      providerId.value,
    );
    preview.value = result;
    playlistName.value = result.playlist_name;
    selectedTrackUris.value = Object.fromEntries(
      result.tracks.map((track, index) => [
        index,
        track.candidates[0]?.uri ?? SKIP_TRACK_VALUE,
      ]),
    );
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

async function createPlaylist() {
  if (!preview.value || !providerId.value || !playlistName.value.trim()) return;
  const trackUris = preview.value.tracks.flatMap((_, index) =>
    selectedTrackUris.value[index] &&
    selectedTrackUris.value[index] !== SKIP_TRACK_VALUE
      ? [selectedTrackUris.value[index]]
      : [],
  );
  if (!trackUris.length) return;

  creating.value = true;
  try {
    const playlist = await api.createPlaylist(
      playlistName.value.trim(),
      providerId.value,
      [MediaType.TRACK],
    );
    await api.addPlaylistTracks(playlist.item_id, trackUris);
    showDialog.value = false;
    toast.success($t("setlistfm_playlist_adding", [trackUris.length]), {
      action: {
        label: $t("open_playlist"),
        onClick: () => {
          store.showFullscreenPlayer = false;
          router.push({
            name: "playlist",
            params: { itemId: playlist.item_id, provider: playlist.provider },
          });
        },
      },
    });
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    creating.value = false;
  }
}

function candidateLabel(candidate: SetlistFmTrackCandidate): string {
  const artistList = candidate.artists.join(", ");
  return [candidate.name, artistList, candidate.album]
    .filter(Boolean)
    .join(" — ");
}

function errorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  return $t("setlistfm_failed");
}
</script>
