export type VirtualKeyboardSurface = "native" | "virtual";

export interface VirtualKeyboardEnvironment {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  compactViewport: boolean;
  coarsePointer: boolean;
  anyCoarsePointer: boolean;
}

/** Device policy only: a narrow desktop layout must not imply a touch keyboard. */
export function resolveVirtualKeyboardSurface(
  environment?: VirtualKeyboardEnvironment,
): VirtualKeyboardSurface {
  if (!environment) return "native";

  const { userAgent, platform, maxTouchPoints, compactViewport, coarsePointer, anyCoarsePointer } =
    environment;
  const deviceIdentity = `${userAgent} ${platform}`;

  // Known phones/tablets keep their keypad when a mouse or trackpad is attached.
  if (/iPhone|iPod|iPad|Android/i.test(deviceIdentity)) return "virtual";

  // iPadOS can report the same desktop identity as Safari/Chromium on a Mac.
  // Require independent multi-touch and touch-pointer evidence for this exception.
  if (platform === "MacIntel" && maxTouchPoints > 1 && (coarsePointer || anyCoarsePointer)) {
    return "virtual";
  }

  if (/Windows|Win32|Win64|Mac|Linux|X11|CrOS/i.test(deviceIdentity)) return "native";

  // Unknown platforms need all three signals; an optional touch screen alone is insufficient.
  return compactViewport && maxTouchPoints > 0 && coarsePointer ? "virtual" : "native";
}
