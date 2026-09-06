import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useCompactEditorSession,
  EditorDiscardConfirmation,
  editorConfirmationClass,
} from "./use-compact-editor-session";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LocaleProvider } from "@/shared/i18n/locale-provider";

afterEach(cleanup);
function Harness({
  initial = "saved",
  scope = "one",
  save = vi.fn(),
  close = vi.fn(),
}: {
  initial?: string;
  scope?: string;
  save?: (draft: { name: string }) => Promise<unknown>;
  close?: (open: boolean) => void;
}) {
  const session = useCompactEditorSession({
    open: true,
    scopeKey: scope,
    initial: { name: initial },
    busy: false,
    onOpenChange: close,
  });
  return (
    <LocaleProvider initialLocale="en">
      <Dialog open onOpenChange={session.requestClose}>
        <DialogContent
          mobileEditor
          data-confirm-discard={session.confirmDiscard}
          className={editorConfirmationClass}
          aria-describedby={undefined}
        >
          <DialogTitle>Editor</DialogTitle>
          {session.confirmDiscard ? (
            <EditorDiscardConfirmation keep={session.keep} discard={session.discard} />
          ) : null}
          <input
            aria-label="Name"
            value={session.draft.name}
            onChange={(event) => session.setDraft({ name: event.target.value })}
          />
          <button onClick={() => void session.save(save)}>Save</button>
          {session.saveFailed ? <p role="alert">Failed</p> : null}
        </DialogContent>
      </Dialog>
    </LocaleProvider>
  );
}

describe("compact editing session", () => {
  it("retains dirty input on background refresh and replaces it on entity switch", () => {
    const view = render(<Harness />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "draft" } });
    view.rerender(<Harness initial="server refreshed" />);
    expect(screen.getByLabelText("Name")).toHaveValue("draft");
    view.rerender(<Harness scope="two" initial="other entity" />);
    expect(screen.getByLabelText("Name")).toHaveValue("other entity");
  });
  it("guards Escape and restores input focus when continuing", async () => {
    const close = vi.fn();
    render(<Harness close={close} />);
    const input = screen.getByLabelText("Name");
    fireEvent.change(input, { target: { value: "draft" } });
    input.focus();
    fireEvent.keyDown(input, { key: "Escape" });
    const keep = await screen.findByRole("button", { name: "Continue editing" });
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(keep);
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveValue("draft");
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.click(await screen.findByRole("button", { name: "Discard changes" }));
    expect(close).toHaveBeenCalledWith(false);
  });
  it("retains a failed draft and serializes duplicate save attempts", async () => {
    let reject!: (error: Error) => void;
    const save = vi.fn(
      () =>
        new Promise((_, rejectPromise) => {
          reject = rejectPromise;
        }),
    );
    render(<Harness save={save} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "retry draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledTimes(1);
    reject(new Error("offline"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed");
    expect(screen.getByLabelText("Name")).toHaveValue("retry draft");
  });
});
