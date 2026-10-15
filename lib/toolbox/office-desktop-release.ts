const base = "https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v1.5.0";
export const officeDesktopRelease = {
  version: "1.5.0",
  websiteControlProtocol: 3 as 3 | null,
  authenticodeSigned: false,
  publisherCertificateSha256: null as string | null,
  prerelease: true,
  files: [
    { architecture: "x64", bytes: 65053222, sha256: "40ff26c126d2eab536872f5f559d90be90243f7911755c1ea380000f7f6d95e5", href: `${base}/ChinaTech-Office-Assistant-x64.exe` },
    { architecture: "ARM64", bytes: 61206556, sha256: "402af38af4e5a3a04a24d70d67c9f5e90c4abbe10806dfc82f4f1bd8f59fa29f", href: `${base}/ChinaTech-Office-Assistant-ARM64.exe` },
  ],
  instructions: `${base}/README.txt`,
  checksums: `${base}/SHA256SUMS.txt`,
} as const;
