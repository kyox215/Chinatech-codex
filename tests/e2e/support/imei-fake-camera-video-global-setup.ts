import { ensureImeiFakeCameraVideo } from "./imei-fake-camera-video";

export default async function globalSetup() {
  await ensureImeiFakeCameraVideo();
}
