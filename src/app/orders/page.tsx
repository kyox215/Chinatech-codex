import { Suspense } from "react";
import { OrderListSkeleton } from "@/features/orders/components/order-list-skeleton";
import { OrderListScreen } from "@/features/orders/screens/order-list-screen";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("orders.title");

export default function Page() {
  return (
    <Suspense fallback={<OrderListSkeleton />}>
      <OrderListScreen />
    </Suspense>
  );
}
