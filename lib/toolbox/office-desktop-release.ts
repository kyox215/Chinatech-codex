const base = "https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v0.1.1";
export const officeDesktopRelease = {
  version: "0.1.1",
  files: [
    { architecture: "x64", bytes: 64864981, sha256: "fcd022df1f810b072bae7f6bb45e00a7b37716bc9ae57c15d90349ffb1e64fa4", href: `${base}/ChinaTech-Office-Assistant-x64.exe` },
    { architecture: "ARM64", bytes: 61018312, sha256: "4ea331a0d0b23c97e011198adad5395fde7540a99b950b9fef76039a8c6f5b1f", href: `${base}/ChinaTech-Office-Assistant-ARM64.exe` },
  ],
  instructions: `${base}/README.txt`,
  checksums: `${base}/SHA256SUMS.txt`,
} as const;
