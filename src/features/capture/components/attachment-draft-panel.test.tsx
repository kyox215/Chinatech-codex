import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AttachmentDraftPanel } from "./attachment-draft-panel";
import {
  getAttachmentValidationIssue,
  type AttachmentDraft,
  type AttachmentDraftKind,
} from "@/features/capture/model/attachment-rules";
import { LocaleProvider } from "@/shared/i18n/locale-provider";

const toastMocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMocks }));

const kindLabels = {
  "zh-CN": {
    device_front: "正面",
    device_back: "背面",
    screen_on: "亮屏",
    fault_photo: "故障",
    signature: "签名",
    other: "其他",
  },
  "it-IT": {
    device_front: "Fronte",
    device_back: "Retro",
    screen_on: "Schermo acceso",
    fault_photo: "Guasto",
    signature: "Firma",
    other: "Altro",
  },
  en: {
    device_front: "Front",
    device_back: "Back",
    screen_on: "Screen on",
    fault_photo: "Fault",
    signature: "Signature",
    other: "Other",
  },
} as const;

function createDraft(kind: AttachmentDraftKind = "fault_photo"): AttachmentDraft {
  return {
    id: "draft-1",
    kind,
    file: new File(["photo"], "客户设备-IMG-01.jpg", { type: "image/jpeg" }),
    previewUrl: "blob:attachment",
    name: "客户设备-IMG-01.jpg",
    size: 5,
    mimeType: "image/jpeg",
    createdAt: "2026-09-01T00:00:00.000Z",
  };
}

describe("AttachmentDraftPanel", () => {
  afterEach(() => {
    cleanup();
    toastMocks.error.mockReset();
    toastMocks.success.mockReset();
  });

  it.each(
    (["zh-CN", "it-IT", "en"] as const).flatMap((locale) =>
      (Object.keys(kindLabels[locale]) as AttachmentDraftKind[]).map(
        (kind) => [locale, kind, kindLabels[locale][kind]] as const,
      ),
    ),
  )("localizes %s %s kind labels while preserving filename", (locale, kind, label) => {
    const draft = createDraft(kind);
    render(
      <LocaleProvider initialLocale={locale}>
        <AttachmentDraftPanel attachments={[draft]} onChange={vi.fn()} />
      </LocaleProvider>,
    );

    expect(screen.getByText(draft.name)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(draft.name) })).toBeInTheDocument();
  });

  it("reports structured validation issues and exposes an accessible delete action", async () => {
    const onChange = vi.fn();
    const draft = createDraft();
    render(
      <LocaleProvider initialLocale="en">
        <AttachmentDraftPanel attachments={[draft]} onChange={onChange} />
      </LocaleProvider>,
    );

    const oversized = new File([new Uint8Array(8 * 1024 * 1024 + 1)], "too-large.png", {
      type: "image/png",
    });
    expect(getAttachmentValidationIssue(oversized)).toEqual({
      code: "file-too-large",
      maxBytes: 8 * 1024 * 1024,
    });
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [oversized] },
    });
    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith(expect.stringContaining("too-large.png")),
    );

    fireEvent.click(screen.getByRole("button", { name: /Delete attachment/ }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
