const base = "https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v1.2.0";
export const officeDesktopRelease = {
  version: "1.2.0",
  files: [
    { architecture: "x64", bytes: 64971136, sha256: "e47013ff8f07492e875462159f3e54955b0fccd6783c248a50646a2dbcf1904d", href: `${base}/ChinaTech-Office-Assistant-x64.exe` },
    { architecture: "ARM64", bytes: 61124479, sha256: "baf2862f093c5ad9cbf2c2474198a199c8e54db598ad01cf836485752d4386be", href: `${base}/ChinaTech-Office-Assistant-ARM64.exe` },
  ],
  instructions: `${base}/README.txt`,
  checksums: `${base}/SHA256SUMS.txt`,
} as const;
