const base = "https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v1.1.0";
export const officeDesktopRelease = {
  version: "1.1.0",
  files: [
    { architecture: "x64", bytes: 64931240, sha256: "2f40e78c84ae04a3d2b718abe483f8253e6acf0016ab4c8655856dcd09383641", href: `${base}/ChinaTech-Office-Assistant-x64.exe` },
    { architecture: "ARM64", bytes: 61084575, sha256: "92cdb413043874d630e13f04c85950173e87c2600bd2730c19ae7e3d5c1aed53", href: `${base}/ChinaTech-Office-Assistant-ARM64.exe` },
  ],
  instructions: `${base}/README.txt`,
  checksums: `${base}/SHA256SUMS.txt`,
} as const;
