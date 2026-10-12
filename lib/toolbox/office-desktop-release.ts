const base = "https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v1.3.0";
export const officeDesktopRelease = {
  version: "1.3.0",
  files: [
    { architecture: "x64", bytes: 64973194, sha256: "472f935742d8da0144264a0f1e584a5b013ff724dda4a922882cdabc9b846173", href: `${base}/ChinaTech-Office-Assistant-x64.exe` },
    { architecture: "ARM64", bytes: 61126536, sha256: "a576385bddab1bd5489dd4392a6ca12f008a31da784a102a2ccc3ff0b51c3144", href: `${base}/ChinaTech-Office-Assistant-ARM64.exe` },
  ],
  instructions: `${base}/README.txt`,
  checksums: `${base}/SHA256SUMS.txt`,
} as const;
