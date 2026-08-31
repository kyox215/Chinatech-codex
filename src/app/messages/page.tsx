import { MessagesScreen } from "@/features/messages/screens/messages-screen";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("messages.title");

export default function Page() {
  return <MessagesScreen />;
}
