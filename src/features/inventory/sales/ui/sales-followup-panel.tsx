"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { readInventorySalesWorkflow, runInventorySalesWorkflowCommand } from "@/lib/repairdesk/api";
import { useLocale } from "@/shared/i18n/locale-provider";
import { inventorySalesKeys } from "../api/query-keys";
import { invalidateInventorySales } from "../api/queries";
import {
  inventorySalesWorkflowCommandBodySchema,
  type InventorySalesWorkflowCommandBody,
  type InventorySalesWorkflowReadResult,
} from "../model/workflow-contracts";
import { salesCopy, salesLanguage, type SalesCopyKey } from "./sales-copy";
import { salesWorkflowCopy, type SalesWorkflowCopyKey } from "./sales-workflow-copy";
import {
  commandIdentity,
  romeDateTime,
  romeDateTimeToIso,
  salesErrorKey,
  salesRomeDateTime,
} from "./sales-ui-adapter";
import { Fact, Field, SalesDialog } from "./sales-transaction-dialog";

type Action = InventorySalesWorkflowCommandBody["command"];
const actionLabels: Record<Action, SalesWorkflowCopyKey> = {
  "fiscal.record": "record",
  "fiscal.verify": "verify",
  "followup.set": "followup",
  "issue.open": "openIssue",
  "issue.resolve": "resolve",
};
const selectClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-base lg:text-sm";

export function SalesFollowupPanel({
  saleOrderId,
  storeId,
}: {
  saleOrderId: string;
  storeId: string;
}) {
  const { locale } = useLocale();
  const t = (key: SalesWorkflowCopyKey) => salesWorkflowCopy(locale, key);
  const c = (key: SalesCopyKey) => salesCopy(locale, key);
  const query = useQuery({
    queryKey: [...inventorySalesKeys.store(storeId), "workflow", saleOrderId],
    queryFn: () => readInventorySalesWorkflow({ sale_order_id: saleOrderId }),
    retry: false,
  });
  const [editor, setEditor] = useState<{
    action: Action;
    snapshot: InventorySalesWorkflowReadResult;
    issueId?: string;
  } | null>(null);
  const open = (action: Action, issueId?: string) => {
    if (query.data) setEditor({ action, snapshot: query.data, issueId });
  };
  if (query.isPending)
    return (
      <p role="status" className="text-xs">
        {c("loading")}
      </p>
    );
  if (!query.data || query.isError)
    return (
      <div role="alert" className="space-y-2 text-xs">
        <p>{c(salesErrorKey(query.error))}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          {c("retry")}
        </Button>
      </div>
    );
  const data = query.data;
  const { fiscal, followup, issues } = data.workflow;
  return (
    <section className="grid min-w-0 gap-3 border-t border-border pt-3" data-ui="sales-followup">
      <h3 className="text-sm font-semibold">{t("title")}</h3>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="grid min-w-0 content-start gap-2 rounded-lg bg-muted/30 p-3">
          <h4 className="text-xs font-semibold">{t("fiscal")}</h4>
          <p className="break-words text-sm">
            {fiscal ? `${t(fiscal.document_type)} · ${fiscal.reference}` : t("missing")}
          </p>
          {fiscal ? (
            <p className="text-xs text-muted-foreground">
              {salesRomeDateTime(fiscal.issued_at, salesLanguage(locale))} ·{" "}
              {t(fiscal.verified_at ? "verified" : "unverified")}
              {fiscal.verified_by_name ? ` · ${fiscal.verified_by_name}` : ""}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">{t("fiscalHelp")}</p>
          <div className="flex flex-wrap gap-2">
            {data.capabilities.can_edit ? (
              <Button variant="outline" className="min-h-11" onClick={() => open("fiscal.record")}>
                {t(fiscal ? "correct" : "record")}
              </Button>
            ) : null}
            {fiscal && !fiscal.verified_at && data.capabilities.can_verify ? (
              <Button variant="outline" className="min-h-11" onClick={() => open("fiscal.verify")}>
                {t("verify")}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid min-w-0 content-start gap-2 rounded-lg bg-muted/30 p-3">
          <h4 className="text-xs font-semibold">{t("followup")}</h4>
          <p className="text-sm">{followup.assignee_name ?? t("unassigned")}</p>
          {followup.follow_up_at ? (
            <p className="text-xs">
              {salesRomeDateTime(followup.follow_up_at, salesLanguage(locale))}
            </p>
          ) : null}
          {followup.note ? (
            <p className="whitespace-pre-wrap break-words text-xs">{followup.note}</p>
          ) : null}
          {data.capabilities.can_edit ? (
            <Button
              variant="outline"
              className="min-h-11 w-fit"
              onClick={() => open("followup.set")}
            >
              {t("followup")}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-semibold">{t("issues")}</h4>
          {data.capabilities.can_edit ? (
            <Button variant="outline" className="min-h-11" onClick={() => open("issue.open")}>
              {t("openIssue")}
            </Button>
          ) : null}
        </div>
        {issues.map((issue) => (
          <div key={issue.id} className="grid gap-1 rounded-lg border border-border p-2 text-xs">
            <p className="font-semibold">
              {t(issue.kind)} · {t(issue.status)}
            </p>
            <p className="whitespace-pre-wrap break-words">{issue.summary}</p>
            {issue.resolution ? (
              <p className="whitespace-pre-wrap break-words text-muted-foreground">
                {t("resolution")} · {issue.resolution}
              </p>
            ) : null}
            {issue.status === "open" && data.capabilities.can_edit ? (
              <Button
                variant="ghost"
                className="min-h-11 w-fit"
                onClick={() => open("issue.resolve", issue.id)}
              >
                {t("resolve")}
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      <details className="text-xs">
        <summary className="min-h-11 cursor-pointer py-3 font-medium">
          {t("history")} · {data.history.length}
        </summary>
        <ol className="grid gap-2">
          {data.history.map((event) => (
            <li key={event.id} className="grid gap-1 border-l-2 border-border pl-2">
              <p>
                {t(actionLabels[event.command as Action] ?? "history")} · {event.actor_name} ·{" "}
                {salesRomeDateTime(event.created_at, salesLanguage(locale))}
              </p>
              {event.payload.previous_fiscal &&
              typeof event.payload.previous_fiscal === "object" &&
              "reference" in event.payload.previous_fiscal &&
              typeof event.payload.previous_fiscal.reference === "string" ? (
                <p className="break-words text-muted-foreground">
                  {t("previousReference")} · {event.payload.previous_fiscal.reference}
                </p>
              ) : null}
              {["reference", "correction_reason", "summary", "resolution", "note"].map((key) =>
                typeof event.payload[key] === "string" ? (
                  <p key={key} className="whitespace-pre-wrap break-words text-muted-foreground">
                    {String(event.payload[key])}
                  </p>
                ) : null,
              )}
            </li>
          ))}
        </ol>
      </details>
      {data.truncated.history || data.truncated.issues ? (
        <p className="text-xs text-muted-foreground">{t("recentOnly")}</p>
      ) : null}
      {editor ? (
        <SalesWorkflowEditor
          key={`${editor.action}:${editor.snapshot.workflow.version}:${editor.issueId ?? ""}`}
          {...editor}
          storeId={storeId}
          onClose={() => setEditor(null)}
          onReload={async () => {
            const fresh = await query.refetch();
            if (fresh.data) setEditor({ ...editor, snapshot: fresh.data });
          }}
        />
      ) : null}
    </section>
  );
}

function SalesWorkflowEditor({
  action,
  snapshot,
  issueId,
  storeId,
  onClose,
  onReload,
}: {
  action: Action;
  snapshot: InventorySalesWorkflowReadResult;
  issueId?: string;
  storeId: string;
  onClose: () => void;
  onReload: () => Promise<void>;
}) {
  const { locale } = useLocale();
  const t = (key: SalesWorkflowCopyKey) => salesWorkflowCopy(locale, key);
  const c = (key: SalesCopyKey) => salesCopy(locale, key);
  const { fiscal, followup } = snapshot.workflow;
  const [reference, setReference] = useState(fiscal?.reference ?? "");
  const [documentType, setDocumentType] = useState<"receipt" | "invoice" | "other">(
    fiscal?.document_type ?? "receipt",
  );
  const [issued, setIssued] = useState(() =>
    romeDateTime(fiscal ? new Date(fiscal.issued_at) : new Date()),
  );
  const [reason, setReason] = useState("");
  const [assignee, setAssignee] = useState(followup.assignee_membership_id ?? "");
  const [due, setDue] = useState(
    followup.follow_up_at ? romeDateTime(new Date(followup.follow_up_at)) : "",
  );
  const [note, setNote] = useState(action === "followup.set" ? (followup.note ?? "") : "");
  const [kind, setKind] = useState<
    "payment_mismatch" | "fiscal_document" | "customer_request" | "delivery" | "other"
  >("customer_request");
  const [description, setDescription] = useState("");
  const [dirty, setDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState<SalesCopyKey | "invalid" | null>(null);
  const lock = useRef(false);
  const identity = useRef<ReturnType<typeof commandIdentity> | null>(null);
  const client = useQueryClient();
  const mutation = useMutation({ mutationFn: runInventorySalesWorkflowCommand });
  const close = () => {
    if (!mutation.isPending) {
      if (dirty) setDiscard(true);
      else onClose();
    }
  };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    setError(null);
    let body: InventorySalesWorkflowCommandBody;
    try {
      const payload =
        action === "fiscal.record"
          ? {
              document_type: documentType,
              reference,
              issued_at: romeDateTimeToIso(issued),
              ...(fiscal ? { correction_reason: reason } : {}),
            }
          : action === "fiscal.verify"
            ? { expected_fiscal_revision: fiscal?.revision, ...(note.trim() ? { note } : {}) }
            : action === "followup.set"
              ? {
                  assignee_membership_id: assignee || null,
                  follow_up_at: due ? romeDateTimeToIso(due) : null,
                  note,
                }
              : action === "issue.open"
                ? { kind, summary: description }
                : { issue_id: issueId, resolution: description };
      const input = {
        command: action,
        sale_order_id: snapshot.workflow.sale_order_id,
        expected_workflow_version: snapshot.workflow.version,
        payload,
      };
      identity.current = commandIdentity(identity.current, input);
      body = inventorySalesWorkflowCommandBodySchema.parse({
        ...input,
        idempotency_key: identity.current.key,
      });
    } catch {
      setError("invalid");
      return;
    }
    lock.current = true;
    try {
      await mutation.mutateAsync(body);
      await Promise.allSettled([invalidateInventorySales(client, storeId)]);
      onClose();
    } catch (cause) {
      setError(salesErrorKey(cause));
    } finally {
      lock.current = false;
    }
  }
  return (
    <SalesDialog
      title={t(actionLabels[action])}
      description={
        action.startsWith("issue.")
          ? t("issueHelp")
          : action.startsWith("fiscal.")
            ? t("fiscalHelp")
            : t("noteHelp")
      }
      onClose={close}
      pending={mutation.isPending}
    >
      {discard ? (
        <div className="grid gap-3 p-3">
          <p>{c("discardTitle")}</p>
          <Button onClick={() => setDiscard(false)}>{c("continueEditing")}</Button>
          <Button variant="outline" onClick={onClose}>
            {c("discard")}
          </Button>
        </div>
      ) : (
        <form
          onSubmit={save}
          onChange={() => setDirty(true)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <fieldset
            disabled={mutation.isPending}
            className="grid min-h-0 gap-3 overflow-y-auto p-3"
          >
            {action === "fiscal.record" ? (
              <>
                <Field label={t("documentType")}>
                  <select
                    aria-label={t("documentType")}
                    className={selectClass}
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value as typeof documentType)}
                  >
                    {(["receipt", "invoice", "other"] as const).map((value) => (
                      <option key={value} value={value}>
                        {t(value)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("reference")}>
                  <Input
                    aria-label={t("reference")}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    required
                    maxLength={128}
                  />
                </Field>
                <Field label={t("issued")}>
                  <Input
                    aria-label={t("issued")}
                    type="datetime-local"
                    value={issued}
                    onChange={(e) => setIssued(e.target.value)}
                    required
                  />
                </Field>
                {fiscal ? (
                  <>
                    <p className="text-xs text-muted-foreground">{t("correctionHelp")}</p>
                    <Field label={t("reason")}>
                      <Textarea
                        aria-label={t("reason")}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required
                        maxLength={1000}
                      />
                    </Field>
                  </>
                ) : null}
              </>
            ) : action === "fiscal.verify" ? (
              <>
                <Fact label={t("reference")} value={fiscal?.reference ?? "—"} />
                <Fact
                  label={t("issued")}
                  value={fiscal ? salesRomeDateTime(fiscal.issued_at, salesLanguage(locale)) : "—"}
                />
                <Field label={t("note")}>
                  <Textarea
                    aria-label={t("note")}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={1000}
                  />
                </Field>
              </>
            ) : action === "followup.set" ? (
              <>
                <Field label={t("assignee")}>
                  <select
                    aria-label={t("assignee")}
                    className={selectClass}
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                  >
                    <option value="">{t("unassigned")}</option>
                    {snapshot.assignees.map((person) => (
                      <option key={person.membership_id} value={person.membership_id}>
                        {person.display_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("due")}>
                  <Input
                    aria-label={t("due")}
                    type="datetime-local"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </Field>
                <Field label={t("note")}>
                  <Textarea
                    aria-label={t("note")}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={1000}
                  />
                </Field>
              </>
            ) : (
              <>
                {action === "issue.open" ? (
                  <Field label={t("issueKind")}>
                    <select
                      aria-label={t("issueKind")}
                      className={selectClass}
                      value={kind}
                      onChange={(e) => setKind(e.target.value as typeof kind)}
                    >
                      {(
                        [
                          "payment_mismatch",
                          "fiscal_document",
                          "customer_request",
                          "delivery",
                          "other",
                        ] as const
                      ).map((value) => (
                        <option key={value} value={value}>
                          {t(value)}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <p className="text-sm">
                    {snapshot.workflow.issues.find((issue) => issue.id === issueId)?.summary}
                  </p>
                )}
                <Field label={t(action === "issue.open" ? "summary" : "resolution")}>
                  <Textarea
                    aria-label={t(action === "issue.open" ? "summary" : "resolution")}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    maxLength={1000}
                  />
                </Field>
              </>
            )}
            {error ? (
              <div role="alert" className="space-y-2 text-sm text-destructive">
                <p>{error === "invalid" ? t("invalid") : c(error)}</p>
                {error === "conflict" ? (
                  <Button type="button" variant="outline" onClick={() => void onReload()}>
                    {c("refresh")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </fieldset>
          <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-border p-3">
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={close}>
              {c("cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {c(mutation.isPending ? "pending" : "save")}
            </Button>
          </footer>
        </form>
      )}
    </SalesDialog>
  );
}
