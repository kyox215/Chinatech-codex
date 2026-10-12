const base = "https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v1.3.0";
export const officeDesktopRelease = {
  version: "1.3.0",
  files: [
    { architecture: "x64", bytes: 64973039, sha256: "ec84c07798a23165a101ed053752a5a2d17ead47f01685878be6391e5dbdc0ef", href: `${base}/ChinaTech-Office-Assistant-x64.exe` },
    { architecture: "ARM64", bytes: 61126381, sha256: "123fdee0bbe05f7bd5a3d25a75b5b24193b0f231c514429919eee5936f9903f2", href: `${base}/ChinaTech-Office-Assistant-ARM64.exe` },
  ],
  instructions: `${base}/README.txt`,
  checksums: `${base}/SHA256SUMS.txt`,
} as const;
