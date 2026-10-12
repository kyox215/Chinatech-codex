const base = "https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v1.3.0";
export const officeDesktopRelease = {
  version: "1.3.0",
  files: [
    { architecture: "x64", bytes: 64972866, sha256: "d133fa7427eef3e1644309668a2b05bb8a7e653aa3b39515516beb06a8677724", href: `${base}/ChinaTech-Office-Assistant-x64.exe` },
    { architecture: "ARM64", bytes: 61126207, sha256: "af341ca327b9d05bba361806d3a1be83413442c8119dc9ee8e552256d081389e", href: `${base}/ChinaTech-Office-Assistant-ARM64.exe` },
  ],
  instructions: `${base}/README.txt`,
  checksums: `${base}/SHA256SUMS.txt`,
} as const;
