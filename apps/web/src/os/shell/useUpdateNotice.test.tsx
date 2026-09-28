import { act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reloader } from "../../chunks";
import { renderOs } from "../testing";
import { useUpdateNotice } from "./useUpdateNotice";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Probe({ fetchVersion, build }: { fetchVersion: () => Promise<string>; build: string }) {
  useUpdateNotice(fetchVersion, build);
  return null;
}

const settle = () => act(async () => {});

describe("a new version is out (M2.5 spec §10)", () => {
  it("offers Reload while no shift is running, and hides it during one", async () => {
    const { os, incident } = renderOs(<Probe fetchVersion={async () => "new-sha"} build="old-sha" />);
    await settle();
    const notice = () => os().notices.find((n) => n.id === "update");
    expect(notice()?.title).toBe("A new version is out");
    const reload = vi.spyOn(reloader, "reload").mockImplementation(() => {});
    act(() => notice()!.actions[0]!.run());
    expect(reload).toHaveBeenCalled();
    act(() => incident().start());
    expect(notice()).toBeUndefined();
  });

  it("says nothing when the versions match, or in a dev build", async () => {
    const { os } = renderOs(
      <>
        <Probe fetchVersion={async () => "same"} build="same" />
        <Probe fetchVersion={async () => "other"} build="dev" />
      </>,
    );
    await settle();
    expect(os().notices.find((n) => n.id === "update")).toBeUndefined();
  });
});
