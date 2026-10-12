const base = "https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v1.2.0";
export const officeDesktopRelease = {
  version: "1.2.0",
  files: [
    { architecture: "x64", bytes: 64971743, sha256: "676fe1f117b659a95d709dbd46229d9f7fab7e9b97b71e301b59092900b56413", href: `${base}/ChinaTech-Office-Assistant-x64.exe` },
    { architecture: "ARM64", bytes: 61125085, sha256: "ed1b385ac4adf14416a4a57eb1479c0df721b569d156c464b056172df50b915f", href: `${base}/ChinaTech-Office-Assistant-ARM64.exe` },
  ],
  instructions: `${base}/README.txt`,
  checksums: `${base}/SHA256SUMS.txt`,
} as const;
