import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useUserPreferences } from "@/composables/userPreferences";
import { getMediaImageUrl } from "@/helpers/utils";
import type { VinylSnapshot } from "@/helpers/vinylNowPlaying";
import api from "@/plugins/api";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { toast } from "vue-sonner";

const ARTWORK_BACKGROUND_PREF = "artwork_background";

/** Use the displayed artwork, never an older recognition or another source. */
export function useArtworkBackground(
  vinyl: MaybeRefOrGetter<VinylSnapshot | null>,
  active: MaybeRefOrGetter<boolean> = true,
) {
  const { getPreference } = useUserPreferences();
  const enabled = getPreference(ARTWORK_BACKGROUND_PREF, true);
  const artworkUrl = computed(() => {
    const player = store.activePlayer;
    if (
      !enabled.value ||
      !toValue(active) ||
      !player ||
      player.powered === false
    ) {
      return null;
    }
    const recognized = toValue(vinyl);
    if (recognized) return recognized.artwork_url;
    return getMediaImageUrl(player.current_media?.image_url) || null;
  });
  const visible = computed(() => !!artworkUrl.value);
  async function toggle() {
    const user = store.currentUser;
    if (!user) return;
    const previous = enabled.value;
    const next = !previous;
    const preferences = {
      ...user.preferences,
      [ARTWORK_BACKGROUND_PREF]: next,
    };
    user.preferences = preferences;
    try {
      await api.updateUser(user.user_id, { preferences });
      toast.success(
        $t(
          next
            ? "settings.artwork_background.enabled"
            : "settings.artwork_background.disabled",
        ),
      );
    } catch {
      // Restore only this key so concurrent preference edits are preserved.
      user.preferences = {
        ...user.preferences,
        [ARTWORK_BACKGROUND_PREF]: previous,
      };
      toast.error($t("settings.artwork_background.save_error"));
    }
  }
  return { enabled, artworkUrl, visible, toggle };
}
