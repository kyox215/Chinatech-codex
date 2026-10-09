export type MimoverRelease = {
  status: "building" | "ready";
  available: boolean;
  version: string;
  versionCode: number;
  minSdk: number;
  packageName: string;
  apkPath: string;
  instructionsPath: string;
  checksumsPath: string;
  bytes: number | null;
  sha256: string | null;
  signerSha256: string | null;
};

/** Download stays closed until the final APK and its metadata have been verified. */
export const mimoverRelease: MimoverRelease = {
  status: "ready",
  available: true,
  version: "4.5.7.5-ct-lab2",
  versionCode: 45707,
  minSdk: 26,
  packageName: "com.miui.huanji.chinatech",
  apkPath: "/toolbox/mimover-universal/MiMover-4.5.7.5-universal-coexist-lab2.apk",
  instructionsPath: "/toolbox/mimover-universal/README.md",
  checksumsPath: "/toolbox/mimover-universal/SHA256SUMS.txt",
  bytes: 37764668,
  sha256: "4607f469cd156d19a0d24e19608302ece2abe8bab4cc464e037d3a6e845dab9b",
  signerSha256: "1b71b70be3bb58e2db847aa71029ca2c071e467c60f5babef62a841eb00efc75",
};

export function isMimoverReleaseReady(release: MimoverRelease): release is MimoverRelease & { bytes: number; sha256: string; signerSha256: string } {
  return release.status === "ready"
    && release.available
    && typeof release.bytes === "number"
    && Number.isSafeInteger(release.bytes)
    && release.bytes > 0
    && typeof release.sha256 === "string"
    && /^[a-f0-9]{64}$/.test(release.sha256)
    && typeof release.signerSha256 === "string"
    && /^[a-f0-9]{64}$/.test(release.signerSha256);
}
