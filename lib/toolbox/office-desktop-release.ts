const base = "https://github.com/kyox215/Chinatech-codex/releases/download/office-assistant-v0.2.1";
export const officeDesktopRelease = {
  version: "0.2.1",
  files: [
    { architecture: "x64", bytes: 64868453, sha256: "eb43ded7075019c6e8d24f25c6c4c477738e4130424102d6c0c85c1661a9d781", href: `${base}/ChinaTech-Office-Assistant-x64.exe` },
    { architecture: "ARM64", bytes: 61021786, sha256: "9dc03d830765af368e88169ca955eb2bf51174b7c994f17c9224dcfe9e288641", href: `${base}/ChinaTech-Office-Assistant-ARM64.exe` },
  ],
  instructions: `${base}/README.txt`,
  checksums: `${base}/SHA256SUMS.txt`,
} as const;
