const base = "https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v0.2.0";
export const officeDesktopRelease = {
  version: "0.2.0",
  files: [
    { architecture: "x64", bytes: 64868019, sha256: "fdb3bb5b859be9ff5a011251beeacc602c9496b7ff673d43604b25917d32926f", href: `${base}/ChinaTech-Office-Assistant-x64.exe` },
    { architecture: "ARM64", bytes: 61021353, sha256: "095589c304b7d5ce05225887ebf74e3fa9104f814d0e0cf001be5f27a08dc680", href: `${base}/ChinaTech-Office-Assistant-ARM64.exe` },
  ],
  instructions: `${base}/README.txt`,
  checksums: `${base}/SHA256SUMS.txt`,
} as const;
