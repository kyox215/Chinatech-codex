import type {
  MemoAssignee,
  MemoCreateInput,
  MemoUpdateInput,
  StoreMemo,
} from "@/features/memos/model/contracts";

export type MemoEditorSaveInput = MemoCreateInput | MemoUpdateInput;

export type MemoEditorProps = {
  open: boolean;
  memo?: StoreMemo | null;
  latestVersion?: number;
  assignees: MemoAssignee[];
  canAssignAny: boolean;
  membershipId?: string;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: MemoEditorSaveInput) => Promise<void>;
  onReloadLatest?: () => void;
  onClaim?: () => Promise<void>;
  onArchive?: () => Promise<void>;
  onRestore?: () => Promise<void>;
};

export function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
