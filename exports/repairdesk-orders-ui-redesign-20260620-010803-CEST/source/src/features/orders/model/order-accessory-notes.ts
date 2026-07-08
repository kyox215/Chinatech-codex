export const ACCESSORY_NOTE_OPTIONS = [
  "无",
  "SIM卡",
  "SIM卡托",
  "手机壳",
  "保护膜",
  "充电器",
  "数据线",
  "盒子",
  "其他",
] as const;

export type AccessoryNoteOption = (typeof ACCESSORY_NOTE_OPTIONS)[number];

const NONE_OPTION: AccessoryNoteOption = "无";
const OTHER_OPTION: AccessoryNoteOption = "其他";
const fixedOptions = new Set<string>(
  ACCESSORY_NOTE_OPTIONS.filter((option) => option !== OTHER_OPTION),
);

export type AccessoryNotesSelection = {
  selected: AccessoryNoteOption[];
  customText: string;
};

export function parseAccessoryNotes(value?: string | null): AccessoryNotesSelection {
  const raw = value?.trim();
  if (!raw) return { selected: [], customText: "" };
  const parts = raw
    .split(/[、，,;；]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const selected: AccessoryNoteOption[] = [];
  const customParts: string[] = [];

  for (const part of parts) {
    if (fixedOptions.has(part)) {
      selected.push(part as AccessoryNoteOption);
      continue;
    }
    if (part === OTHER_OPTION) {
      selected.push(OTHER_OPTION);
      continue;
    }
    if (part.startsWith("其他：") || part.startsWith("其他:")) {
      selected.push(OTHER_OPTION);
      customParts.push(part.replace(/^其他[：:]/, "").trim());
      continue;
    }
    customParts.push(part);
  }

  const deduped = Array.from(new Set(selected));
  if (deduped.includes(NONE_OPTION)) return { selected: [NONE_OPTION], customText: "" };
  return {
    selected: deduped,
    customText: customParts.filter(Boolean).join("、"),
  };
}

export function formatAccessoryNotes(selection: AccessoryNotesSelection) {
  const selected = Array.from(new Set(selection.selected));
  if (selected.includes(NONE_OPTION)) return NONE_OPTION;
  const customText = selection.customText.trim();
  const parts: string[] = selected.filter((option) => option !== OTHER_OPTION);
  if (selected.includes(OTHER_OPTION)) {
    parts.push(customText ? `其他：${customText}` : OTHER_OPTION);
  } else if (customText) {
    parts.push(customText);
  }
  return parts.join("、");
}

export function normalizeAccessoryNotes(value?: string | null) {
  return formatAccessoryNotes(parseAccessoryNotes(value));
}
