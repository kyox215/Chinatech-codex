import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadOrderAttachment } from "./order.repository";
import type { AuditActor, OrderAttachmentUploadInput } from "@/lib/repairdesk/types";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  storageFrom: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  signed: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/server/supabase", () => ({
  getSupabaseAdmin: () => ({
    from: mocks.from,
    rpc: mocks.rpc,
    storage: { from: mocks.storageFrom },
  }),
}));
const store = "00000000-0000-4000-8000-000000048700";
const order = "00000000-0000-4000-8000-000000048730";
const actor = {
  id: "00000000-0000-4000-8000-000000048701",
  storeId: store,
  storeRole: "owner",
  role: "owner",
  displayName: "Synthetic",
  email: "synthetic@example.test",
} as AuditActor;
const input: OrderAttachmentUploadInput = {
  operation_id: "00000000-0000-4000-8000-000000048901",
  kind: "fault_photo",
  file_name: "synthetic.jpg",
  mime_type: "image/jpeg",
  file_size: 4,
  data_base64: "/9j/AA==",
};
function receipt(args: Record<string, unknown>) {
  return {
    ok: true,
    code: "created",
    attachment: {
      ...(args.p_attachment as object),
      id: input.operation_id,
      store_id: store,
      order_id: order,
      uploaded_by: "Synthetic",
      created_at: "2026-09-17T10:00:00Z",
      updated_at: "2026-09-17T10:00:00Z",
    },
    replayed: false,
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue({
      data: { id: order, status: "new", record_state: "active" },
      error: null,
    }),
  };
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  mocks.from.mockReturnValue(q);
  mocks.storageFrom.mockReturnValue({
    upload: mocks.upload,
    download: mocks.download,
    createSignedUrl: mocks.signed,
    remove: mocks.remove,
  });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.download.mockResolvedValue({
    data: { arrayBuffer: async () => Uint8Array.from([255, 216, 255, 0]).buffer },
    error: null,
  });
  mocks.signed.mockResolvedValue({
    data: { signedUrl: "https://example.test/synthetic-signed" },
    error: null,
  });
  mocks.rpc.mockImplementation(async (_name, args) => ({
    data: args.p_check_only ? { ok: true, code: "pending" } : receipt(args),
    error: null,
  }));
});

describe("attachment immutable upload and atomic receipt", () => {
  it("uses stable ID, bytes hash and one atomic finalize, without separate metadata/event writes", async () => {
    const result = await uploadOrderAttachment(order, input, actor);
    expect(result.attachment.id).toBe(input.operation_id);
    expect(mocks.rpc.mock.calls.map((call) => call[1].p_check_only)).toEqual([true, false]);
    expect(mocks.rpc.mock.calls[1][0]).toBe("repairdesk_finalize_order_attachment_v1");
    const args = mocks.rpc.mock.calls[1][1];
    expect(args).toMatchObject({
      p_store_id: store,
      p_actor_id: actor.id,
      p_order_id: order,
      p_operation_id: input.operation_id,
    });
    expect(args.p_attachment.content_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.upload).toHaveBeenCalledWith(
      `${store}/${order}/${input.operation_id}-${args.p_attachment.content_sha256}.jpg`,
      expect.any(Buffer),
      { contentType: "image/jpeg", upsert: false },
    );
    expect(mocks.from.mock.calls.map((call) => call[0])).toEqual(["repair_orders"]);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("recovers a committed-but-lost finalize response through preflight and does not upload twice", async () => {
    let committed: ReturnType<typeof receipt> | undefined;
    mocks.rpc.mockImplementation(async (_name, args) => {
      if (args.p_check_only)
        return {
          data: committed ? { ...committed, replayed: true } : { ok: true, code: "pending" },
          error: null,
        };
      committed = receipt(args);
      return { data: null, error: { message: "Synthetic lost response" } };
    });
    await expect(uploadOrderAttachment(order, input, actor)).rejects.toMatchObject({
      status: 503,
      code: "attachment_result_unknown",
    });
    await expect(uploadOrderAttachment(order, input, actor)).resolves.toMatchObject({
      replayed: true,
      attachment: { id: input.operation_id },
    });
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.rpc.mock.calls[0][1].p_request_hash).toBe(
      mocks.rpc.mock.calls[2][1].p_request_hash,
    );
  });
  it("recovers an unknown Storage response by verifying existing bytes on the same path", async () => {
    mocks.upload
      .mockResolvedValueOnce({ error: { message: "Synthetic response lost", statusCode: "503" } })
      .mockResolvedValueOnce({
        error: { message: "The resource already exists", statusCode: "409" },
      });
    await expect(uploadOrderAttachment(order, input, actor)).rejects.toMatchObject({
      code: "attachment_result_unknown",
    });
    await expect(uploadOrderAttachment(order, input, actor)).resolves.toHaveProperty(
      "attachment.id",
      input.operation_id,
    );
    expect(mocks.upload.mock.calls[0][0]).toBe(mocks.upload.mock.calls[1][0]);
    expect(mocks.download).toHaveBeenCalledWith(mocks.upload.mock.calls[0][0]);
    expect(mocks.rpc.mock.calls.filter((call) => call[1].p_check_only === false)).toHaveLength(1);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("never finalizes a duplicate Storage object with different bytes", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "Already exists", statusCode: "409" } });
    mocks.download.mockResolvedValue({
      data: { arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer },
      error: null,
    });
    await expect(uploadOrderAttachment(order, input, actor)).rejects.toMatchObject({
      status: 409,
      code: "attachment_content_conflict",
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("binds the receipt hash to actual bytes and metadata", async () => {
    await uploadOrderAttachment(order, input, actor);
    await uploadOrderAttachment(order, { ...input, data_base64: "/9j/AQ==" }, actor);
    await uploadOrderAttachment(order, { ...input, note: "Different intent" }, actor);
    expect(
      new Set(
        mocks.rpc.mock.calls
          .filter((call) => call[1].p_check_only)
          .map((call) => call[1].p_request_hash),
      ).size,
    ).toBe(3);
  });
  it.each(["actor_forbidden", "idempotency_conflict"])(
    "rejects %s before Storage",
    async (code) => {
      mocks.rpc.mockResolvedValue({ data: { ok: false, code }, error: null });
      await expect(uploadOrderAttachment(order, input, actor)).rejects.toMatchObject({ code });
      expect(mocks.upload).not.toHaveBeenCalled();
      expect(mocks.remove).not.toHaveBeenCalled();
    },
  );
  it("rechecks revocation after Storage succeeds and retains the unassociated object", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: { ok: true, code: "pending" }, error: null })
      .mockResolvedValueOnce({ data: { ok: false, code: "actor_forbidden" }, error: null });
    await expect(uploadOrderAttachment(order, input, actor)).rejects.toMatchObject({
      status: 403,
      code: "actor_forbidden",
    });
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("keeps a successful receipt successful when signed URL creation is unavailable", async () => {
    mocks.signed.mockResolvedValue({ data: null, error: { message: "Unavailable" } });
    await expect(uploadOrderAttachment(order, input, actor)).resolves.toMatchObject({
      attachment: { id: input.operation_id },
    });
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("does not invent a replacement ID for an obsolete client", async () => {
    await expect(
      uploadOrderAttachment(order, { ...input, operation_id: "" }, actor),
    ).rejects.toMatchObject({ status: 400, code: "attachment_operation_required" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
