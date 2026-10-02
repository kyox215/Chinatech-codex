import type { Metadata } from "next";
import { CustomerList } from "@/components/customers/customer-list";
export const metadata: Metadata = { title: "客户管理" };
export default function CustomerPage() { return <CustomerList />; }
