const base = "https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v1.3.0";
export const officeDesktopRelease = {
  version: "1.3.0",
  files: [
    { architecture: "x64", bytes: 64973009, sha256: "b6558524c076e5c2f1001a48802249d72eb834a6ee557074b8fb96363308203b", href: `${base}/ChinaTech-Office-Assistant-x64.exe` },
    { architecture: "ARM64", bytes: 61126347, sha256: "b8816d78a4ace0fc2bdb2bcea01d779e4ac15d76b70d81148a89ef1f055968dc", href: `${base}/ChinaTech-Office-Assistant-ARM64.exe` },
  ],
  instructions: `${base}/README.txt`,
  checksums: `${base}/SHA256SUMS.txt`,
} as const;
