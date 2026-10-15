const base = "https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v1.4.0";
export const officeDesktopRelease = {
  version: "1.4.0",
  websiteControlProtocol: 3 as 3 | null,
  authenticodeSigned: false,
  publisherCertificateSha256: null as string | null,
  prerelease: true,
  files: [
    { architecture: "x64", bytes: 65049274, sha256: "977c07ae5b7c7ca21584a5a0cebdfb91a08c008ecfb930058d398fdf4827eaaf", href: `${base}/ChinaTech-Office-Assistant-x64.exe` },
    { architecture: "ARM64", bytes: 61202604, sha256: "03b29ea6b4f7473112db42c1f2edde771cb2df356f60fd0f39ea9810eca81b3f", href: `${base}/ChinaTech-Office-Assistant-ARM64.exe` },
  ],
  instructions: `${base}/README.txt`,
  checksums: `${base}/SHA256SUMS.txt`,
} as const;
