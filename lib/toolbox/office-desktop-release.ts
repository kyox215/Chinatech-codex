const base = "https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v1.2.0";
export const officeDesktopRelease = {
  version: "1.2.0",
  files: [
    { architecture: "x64", bytes: 64971678, sha256: "887686799e433c0cf403375be507f65c9f99b007e76d340d93c0add4c10f82fa", href: `${base}/ChinaTech-Office-Assistant-x64.exe` },
    { architecture: "ARM64", bytes: 61125023, sha256: "55abeb8c6e89e55d103a3ad065cfb56e04df43c6f28001658b505eb28a1aeb19", href: `${base}/ChinaTech-Office-Assistant-ARM64.exe` },
  ],
  instructions: `${base}/README.txt`,
  checksums: `${base}/SHA256SUMS.txt`,
} as const;
