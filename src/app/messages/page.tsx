import type { Metadata } from "next";
import { MessagesScreen } from "@/features/messages/screens/messages-screen";

export const metadata: Metadata = {
  title: "消息模板",
  description: "客户通知模板与发送记录",
};

export default function Page() {
  return <MessagesScreen />;
}
