import CustomerDetailPage from "@/routes/customers.$id";

export function CustomerDetailScreen({ id }: { id: string }) {
  return <CustomerDetailPage id={id} />;
}
