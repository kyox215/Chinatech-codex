/** User-supplied installers; these versions do not imply device compatibility. */
const base = "https://github.com/kyox215/Chinatech-codex/releases/download/mobiletrans-20261019";
export const mobiletransRelease = {
  checksumsPath: "/toolbox/mobiletrans/SHA256SUMS.txt",
  files: [
    {
      platform: "Android",
      version: "4.8.11.1083",
      filename: "MobileTrans-Android-4.8.11.1083.apk",
      bytes: 199847405,
      sha256: "2e8ec8532f55f7e92c0e4929657545cd43bce760d7867e55d73bc55f5e8488b6",
      href: `${base}/MobileTrans-Android-4.8.11.1083.apk`,
      downloadLabel: "下载 Android APK",
    },
    {
      platform: "Windows",
      version: "5.5.1.1391",
      filename: "MobileTrans-Windows-5.5.1.1391.exe",
      bytes: 294288384,
      sha256: "f5b07e28461f0fed01a2d46a6121473f0559996884e8bfccac0d8102598fda76",
      href: `${base}/MobileTrans-Windows-5.5.1.1391.exe`,
      downloadLabel: "下载 Windows EXE",
    },
  ],
} as const;
