const base = "https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v1.0.0";
export const officeDesktopRelease = {
  version: "1.0.0",
  files: [
    { architecture: "x64", bytes: 64906101, sha256: "083430f68462fce09ea60e6a2e1de79a7d992fa600eb90c1e2416021f6a05d09", href: `${base}/ChinaTech-Office-Assistant-x64.exe` },
    { architecture: "ARM64", bytes: 61059434, sha256: "2879c3b199b0ffe7467fe04899109bc1b8a86753ab7b07edf700bbf1b201035f", href: `${base}/ChinaTech-Office-Assistant-ARM64.exe` },
  ],
  instructions: `${base}/README.txt`,
  checksums: `${base}/SHA256SUMS.txt`,
} as const;
