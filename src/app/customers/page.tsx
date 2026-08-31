import { Suspense } from "react";
import { CustomerListSkeleton } from "@/features/customers/components/customer-list-skeleton";
import { CustomerListScreen } from "@/features/customers/screens/customer-list-screen";
import { createLocalizedMetadata } from "@/shared/i18n/metadata";

export const generateMetadata = createLocalizedMetadata("customers.title");

export default function Page() {
  return (
    <Suspense fallback={<CustomerListSkeleton />}>
      <CustomerListScreen />
    </Suspense>
  );
}
