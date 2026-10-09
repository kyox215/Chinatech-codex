const base = "https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v0.1.2";
export const officeDesktopRelease = {
  version: "0.1.2",
  files: [
    { architecture: "x64", bytes: 64867236, sha256: "7eeaa7e52bcbddb64665235b2a213d65d79bab354ff01ece5a12c117ecfbdb49", href: `${base}/ChinaTech-Office-Assistant-x64.exe` },
    { architecture: "ARM64", bytes: 61020568, sha256: "10faee61298122a6660fbd641076697035d3edb6a4d064e9728a081510a253bb", href: `${base}/ChinaTech-Office-Assistant-ARM64.exe` },
  ],
  instructions: `${base}/README.txt`,
  checksums: `${base}/SHA256SUMS.txt`,
} as const;
