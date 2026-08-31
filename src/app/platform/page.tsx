import { PlatformAdminScreen } from "@/features/platform/screens/platform-admin-screen";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("platform.title");

export default function PlatformPage() {
  return <PlatformAdminScreen />;
}
