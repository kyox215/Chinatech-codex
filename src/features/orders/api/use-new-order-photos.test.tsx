import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOrder, uploadOrderAttachment } from "@/lib/repairdesk/api";
import { useNewOrderPhotos } from "./use-new-order-photos";

vi.mock("@/lib/repairdesk/api", () => ({ getOrder: vi.fn(), uploadOrderAttachment: vi.fn() }));
const get = vi.mocked(getOrder);
const upload = vi.mocked(uploadOrderAttachment);
const draft = (id: string) => ({
  id,
  kind: "device_front" as const,
  file: new File(["synthetic"], `${id}.png`, { type: "image/png" }),
  previewUrl: `blob:${id}`,
  name: `${id}.png`,
  size: 9,
  mimeType: "image/png",
  createdAt: "2026-09-06",
});
const allowed = { capabilities: { canUploadPhoto: true } } as Awaited<ReturnType<typeof getOrder>>;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("new-order staged photo upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("URL", { revokeObjectURL: vi.fn() });
    get.mockResolvedValue(allowed);
    upload.mockResolvedValue({} as Awaited<ReturnType<typeof uploadOrderAttachment>>);
  });
  afterEach(() => vi.unstubAllGlobals());
  it("does not upload when authoritative permission is absent or unreadable, retaining files", async () => {
    const { result } = renderHook(() => useNewOrderPhotos("store:user", true));
    act(() => result.current.add(draft("one")));
    get.mockResolvedValueOnce({ capabilities: { canUploadPhoto: false } } as typeof allowed);
    await act(async () => {
      expect(await result.current.upload("order-created")).toBe(false);
    });
    expect(upload).not.toHaveBeenCalled();
    expect(result.current.photos[0].file).toBeInstanceOf(File);
    get.mockRejectedValueOnce(new Error("permission read failed"));
    await act(async () => {
      await result.current.upload("order-created");
    });
    expect(upload).not.toHaveBeenCalled();
    expect(result.current.state).toBe("blocked");
  });
  it("never resends successful or uncertain requests and resumes only untouched items for the same created ID", async () => {
    const { result } = renderHook(() => useNewOrderPhotos("store:user", true));
    act(() => {
      result.current.add(draft("one"));
      result.current.add(draft("two"));
      result.current.add(draft("three"));
    });
    upload
      .mockResolvedValueOnce({} as Awaited<ReturnType<typeof uploadOrderAttachment>>)
      .mockRejectedValueOnce(new Error("response lost"));
    await act(async () => {
      expect(await result.current.upload("order-created")).toBe(false);
    });
    expect(result.current.photos.map((item) => item.uploadState)).toEqual([
      "uploaded",
      "uncertain",
      "pending",
    ]);
    await act(async () => {
      expect(await result.current.upload("different-order")).toBe(false);
      await result.current.upload("order-created");
    });
    expect(upload.mock.calls.map(([id, input]) => [id, input.file_name])).toEqual([
      ["order-created", "one.png"],
      ["order-created", "two.png"],
      ["order-created", "three.png"],
    ]);
    expect(result.current.photos[1].uploadState).toBe("uncertain");
    expect(result.current.canRetry).toBe(false);
  });
  it.each(["scope", "active"])(
    "permanently stops an in-flight run after a %s roundtrip",
    async (change) => {
      const pending = deferred<Awaited<ReturnType<typeof uploadOrderAttachment>>>();
      upload.mockImplementationOnce(() => pending.promise);
      const { result, rerender } = renderHook(
        ({ scope, active }) => useNewOrderPhotos(scope, active),
        { initialProps: { scope: "store-a:user", active: true } },
      );
      act(() => {
        result.current.add(draft("one"));
        result.current.add(draft("two"));
      });
      let run!: Promise<boolean>;
      await act(async () => {
        run = result.current.upload("order-created");
      });
      await waitFor(() => expect(upload).toHaveBeenCalledTimes(1));
      rerender({
        scope: change === "scope" ? "store-b:user" : "store-a:user",
        active: change !== "active",
      });
      rerender({ scope: "store-a:user", active: true });
      await act(async () => {
        pending.resolve({} as Awaited<ReturnType<typeof uploadOrderAttachment>>);
        expect(await run).toBe(false);
      });
      expect(upload).toHaveBeenCalledTimes(1);
      expect(result.current.photos[1].uploadState).toBe("pending");
    },
  );
  it("stops after unmount and revokes all previews", async () => {
    const pending = deferred<Awaited<ReturnType<typeof getOrder>>>();
    get.mockReturnValueOnce(pending.promise);
    const { result, unmount } = renderHook(() => useNewOrderPhotos("store:user", true));
    act(() => result.current.add(draft("one")));
    const run = result.current.upload("order-created");
    unmount();
    pending.resolve(allowed);
    await run;
    expect(upload).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:one");
  });
});
