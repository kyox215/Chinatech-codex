const base = "https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v1.0.1";
export const officeDesktopRelease = {
  version: "1.0.1",
  files: [
    { architecture: "x64", bytes: 64918166, sha256: "4a3f3d37da8b2b61b09472be567b6939176eb5e8f0b69f5662cb621620ef821f", href: `${base}/ChinaTech-Office-Assistant-x64.exe` },
    { architecture: "ARM64", bytes: 61071501, sha256: "8fe0c2e6e961f43b3286e5967413f432f5448bfe2cd2457dcde1293063e66eba", href: `${base}/ChinaTech-Office-Assistant-ARM64.exe` },
  ],
  instructions: `${base}/README.txt`,
  checksums: `${base}/SHA256SUMS.txt`,
} as const;
