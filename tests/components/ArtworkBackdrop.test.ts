import ArtworkBackdrop from "@/components/ArtworkBackdrop.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

describe("ArtworkBackdrop", () => {
  it("is decorative and cannot intercept player controls", () => {
    const wrapper = mount(ArtworkBackdrop, {
      props: { artworkUrl: "https://example.com/first.jpg" },
    });
    expect(wrapper.attributes("aria-hidden")).toBe("true");
    expect(wrapper.get("img").attributes("alt")).toBe("");
    wrapper.unmount();
  });

  it("replaces the old image on a cover change and clears it while waiting", async () => {
    const wrapper = mount(ArtworkBackdrop, {
      props: { artworkUrl: "https://example.com/first.jpg" },
    });
    const first = wrapper.get("img").element;
    await wrapper.setProps({ artworkUrl: "https://example.com/next.jpg" });
    expect(wrapper.get("img").element).not.toBe(first);
    expect(wrapper.get("img").attributes("src")).toContain("next.jpg");
    await wrapper.setProps({ artworkUrl: null });
    expect(wrapper.find("img").exists()).toBe(false);
    wrapper.unmount();
  });
});
