const base = "https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v1.3.0";
export const officeDesktopRelease = {
  version: "1.3.0",
  files: [
    { architecture: "x64", bytes: 64972917, sha256: "8f3bc30af1b14c785d00446f114a9f65c69b9d535941da74cee428537f9f5410", href: `${base}/ChinaTech-Office-Assistant-x64.exe` },
    { architecture: "ARM64", bytes: 61126261, sha256: "291fe69f4940658f27a4042bc7ed47d742343dc4cfb1da1006815321f6016404", href: `${base}/ChinaTech-Office-Assistant-ARM64.exe` },
  ],
  instructions: `${base}/README.txt`,
  checksums: `${base}/SHA256SUMS.txt`,
} as const;
