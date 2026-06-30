import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

import RepoPicker from "../components/loops/RepoPicker.vue";

describe("RepoPicker", () => {
  it("browses directories and emits selected folder", async () => {
    const browseDirectory = vi.fn(async (path?: string) => {
      if (!path || path === "/tmp/workspace") {
        return {
          path: "/tmp/workspace",
          parent: "/tmp",
          entries: [{ name: "repo", path: "/tmp/workspace/repo" }]
        };
      }
      if (path === "/tmp") {
        return {
          path: "/tmp",
          parent: "/",
          entries: [{ name: "workspace", path: "/tmp/workspace" }]
        };
      }
      return {
        path,
        parent: "/tmp/workspace",
        entries: []
      };
    });
    const wrapper = mount(RepoPicker, {
      props: {
        modelValue: "/tmp/workspace",
        options: [{ label: "Workspace", path: "/tmp/workspace" }],
        defaultPath: "/tmp/workspace",
        browseDirectory
      }
    });

    await wrapper.get("button").trigger("click");
    expect(wrapper.get("#repo-browser-path").text()).toBe("/tmp/workspace");

    await wrapper.get(".repo-dir").trigger("click");
    expect(wrapper.get("#repo-browser-path").text()).toBe("/tmp/workspace/repo");

    await wrapper.get("#repo-parent").trigger("click");
    expect(browseDirectory).toHaveBeenCalledWith("/tmp/workspace");

    await wrapper.get("#repo-parent").trigger("click");
    expect(browseDirectory).toHaveBeenCalledWith("/tmp");

    await wrapper.get("#repo-use").trigger("click");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual(["/tmp"]);
    expect(wrapper.text()).toContain("Repository folder selected.");
  });
});
