import OrderDetailPage from "@/routes/orders.$id";

export function OrderDetailScreen({ id }: { id: string }) {
  return <OrderDetailPage id={id} />;
}
