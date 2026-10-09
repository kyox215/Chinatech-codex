export const mimoverOriginalRelease = {
  status: "ready" as "building" | "ready",
  available: true,
  mode: "original-role-only",
  version: "4.5.7.5",
  versionCode: 45708,
  minSdk: 21,
  packageName: "com.miui.huanji",
  apkPath: "/toolbox/mimover-original/MiMover-4.5.7.5-original-brand-entry.apk",
  instructionsPath: "/toolbox/mimover-original/README.md",
  checksumsPath: "/toolbox/mimover-original/SHA256SUMS.txt",
  proofPath: "/toolbox/mimover-original/MINIMAL-PATCH.json",
  bytes: 36846924,
  sha256: "593998e7b3769cc0f33e300183ab78943700996fcece1d0432b4d1a9d23fee1f",
  signerSha256: "1b71b70be3bb58e2db847aa71029ca2c071e467c60f5babef62a841eb00efc75",
};

export function isMimoverOriginalReady(release: typeof mimoverOriginalRelease): boolean {
  return release.status === "ready" && release.available && release.mode === "original-role-only"
    && Number.isSafeInteger(release.bytes) && release.bytes > 0
    && /^[a-f0-9]{64}$/.test(release.sha256) && /^[a-f0-9]{64}$/.test(release.signerSha256);
}
