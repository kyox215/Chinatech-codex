const base = "https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v0.2.1";
export const officeDesktopRelease = {
  version: "0.2.1",
  files: [
    { architecture: "x64", bytes: 64868450, sha256: "d1994c9680db8b908133fee725218da76703da027e04bbfb618f8c955b6abb3c", href: `${base}/ChinaTech-Office-Assistant-x64.exe` },
    { architecture: "ARM64", bytes: 61021783, sha256: "69f7f2cda8a28badb45099aa5c1783fdbab01c83469b3eb54a54013e0069244b", href: `${base}/ChinaTech-Office-Assistant-ARM64.exe` },
  ],
  instructions: `${base}/README.txt`,
  checksums: `${base}/SHA256SUMS.txt`,
} as const;
