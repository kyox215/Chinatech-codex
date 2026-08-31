import { OfflineScreen } from "@/features/offline/components/offline-screen";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("offline.title");

export default function OfflinePage() {
  return <OfflineScreen />;
}
