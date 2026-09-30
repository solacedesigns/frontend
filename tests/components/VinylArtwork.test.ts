import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import VinylArtwork from "@/components/VinylArtwork.vue";
import VinylTrackDetails from "@/components/VinylTrackDetails.vue";

describe("Vinyl presentation", () => {
  it("keeps the spinning record mounted across recognized artwork changes", async () => {
    const wrapper = mount(VinylArtwork, {
      props: { artworkUrl: "https://example.com/one.jpg", playing: true },
    });
    const disc = wrapper.get(".disc-motion").element;
    expect(wrapper.classes()).toContain("has-cover");
    await wrapper.setProps({ artworkUrl: "https://example.com/two.jpg" });
    expect(wrapper.get(".disc-motion").element).toBe(disc);
    expect(wrapper.get(".sleeve").attributes("src")).toContain("two.jpg");
    await wrapper.setProps({ artworkUrl: null, playing: false });
    expect(wrapper.find(".sleeve").exists()).toBe(false);
    expect(wrapper.classes()).not.toContain("spinning");
    wrapper.unmount();
  });
  it("shows title, artist, album and a Vinyl indicator, or an honest waiting state", async () => {
    const vinyl = {
      player_id: "record-room",
      state: "playing" as const,
      source_type: "vinyl" as const,
      title: "Bobby",
      artist: "Phoebe Bridgers",
      album: "Lost Weekend",
      artwork_url: null,
    };
    const wrapper = mount(VinylTrackDetails, { props: { vinyl } });
    for (const label of ["Vinyl", "Bobby", "Phoebe Bridgers", "Lost Weekend"])
      expect(wrapper.text()).toContain(label);
    await wrapper.setProps({
      vinyl: { ...vinyl, title: "", artist: "", album: "" },
    });
    expect(wrapper.text()).toContain("Listening for the record…");
    expect(wrapper.text()).not.toContain("Bobby");
    wrapper.unmount();
  });
});
