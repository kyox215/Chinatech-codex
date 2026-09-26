import type {
  MemoAssignee,
  MemoChecklistItem,
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
  checklistSearch?: string;
  onToggleChecklistItem?: (item: MemoChecklistItem, completed: boolean) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
};
