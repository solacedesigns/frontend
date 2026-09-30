import { useArtworkBackground } from "@/composables/useArtworkBackground";
import type { VinylSnapshot } from "@/helpers/vinylNowPlaying";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computed, reactive, ref } from "vue";

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  user: { user_id: "test-user", preferences: {} as Record<string, unknown> },
  player: {
    powered: true,
    current_media: { image_url: "https://example.com/native.jpg" },
  },
}));

vi.mock("@/composables/userPreferences", () => ({
  useUserPreferences: () => ({
    getPreference: (key: string, fallback: boolean) =>
      computed(() => mocks.user.preferences[key] ?? fallback),
  }),
}));
vi.mock("@/helpers/utils", () => ({
  getMediaImageUrl: (url?: string) => url,
}));
vi.mock("@/plugins/store", () => ({
  store: {
    get activePlayer() {
      return mocks.player;
    },
    get currentUser() {
      return mocks.user;
    },
  },
}));
vi.mock("@/plugins/api", () => ({ default: { updateUser: mocks.updateUser } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

describe("useArtworkBackground", () => {
  beforeEach(() => {
    mocks.user = reactive({ user_id: "test-user", preferences: {} });
    mocks.player = reactive({
      powered: true,
      current_media: { image_url: "https://example.com/native.jpg" },
    });
    mocks.updateUser.mockReset().mockResolvedValue(undefined);
    mocks.success.mockClear();
    mocks.error.mockClear();
  });

  it("defaults to the same artwork as native streaming playback", () => {
    const background = useArtworkBackground(null);
    expect(background.enabled.value).toBe(true);
    expect(background.artworkUrl.value).toContain("native.jpg");
  });

  it("uses recognized Vinyl artwork rather than the WiiM input image", () => {
    const vinyl = ref<VinylSnapshot | null>({
      player_id: "record-room",
      state: "playing",
      source_type: "vinyl",
      title: "Lost Boys",
      artist: "Phoebe Bridgers",
      album: "Lost Weekend",
      artwork_url: "https://example.com/vinyl.jpg",
    });
    const background = useArtworkBackground(vinyl);
    expect(background.artworkUrl.value).toContain("vinyl.jpg");
    vinyl.value = { ...vinyl.value!, artwork_url: null };
    expect(background.artworkUrl.value).toBeNull();
    vinyl.value = null;
    expect(background.artworkUrl.value).toContain("native.jpg");
  });

  it("removes the background when disabled or the view closes", () => {
    const open = ref(true);
    const background = useArtworkBackground(null, open);
    expect(background.visible.value).toBe(true);
    mocks.user.preferences.artwork_background = false;
    expect(background.artworkUrl.value).toBeNull();
    mocks.user.preferences.artwork_background = true;
    open.value = false;
    expect(background.visible.value).toBe(false);
  });

  it("does not display powered-off player artwork", () => {
    mocks.player.powered = false;
    expect(useArtworkBackground(null).visible.value).toBe(false);
  });

  it("updates the background as native playback changes artwork", () => {
    const background = useArtworkBackground(null);
    expect(background.artworkUrl.value).toContain("native.jpg");
    mocks.player.current_media.image_url = "https://example.com/next.jpg";
    expect(background.artworkUrl.value).toContain("next.jpg");
  });

  it("toggles only the appearance preference and confirms it was saved", async () => {
    mocks.user.preferences.unrelated = "keep";
    const background = useArtworkBackground(null);
    await background.toggle();
    expect(mocks.updateUser).toHaveBeenCalledWith("test-user", {
      preferences: { unrelated: "keep", artwork_background: false },
    });
    expect(background.visible.value).toBe(false);
    expect(mocks.success).toHaveBeenCalledWith(
      "settings.artwork_background.disabled",
    );
  });

  it("restores only its preference and reports a failed save", async () => {
    mocks.updateUser.mockImplementation(async () => {
      mocks.user.preferences.unrelated = "new value";
      throw new Error("offline");
    });
    const background = useArtworkBackground(null);
    await background.toggle();
    expect(background.enabled.value).toBe(true);
    expect(mocks.user.preferences.unrelated).toBe("new value");
    expect(mocks.error).toHaveBeenCalledWith(
      "settings.artwork_background.save_error",
    );
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
