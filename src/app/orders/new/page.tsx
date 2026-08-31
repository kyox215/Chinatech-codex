import { NewOrderScreen } from "@/features/orders/screens/new-order-screen";
import { parseNewOrderPrefill } from "@/features/orders/model/new-order-intent";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("action.new-order.label");

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const prefill = parseNewOrderPrefill(await searchParams);
  return <NewOrderScreen key={prefill.key} prefill={prefill} />;
}
