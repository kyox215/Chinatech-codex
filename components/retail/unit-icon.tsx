import { Gamepad2, Laptop, Monitor, Package, Smartphone, Tablet } from "lucide-react";
import type { RetailCategory } from "@/lib/retail";

const icons = { phone: Smartphone, tablet: Tablet, laptop: Laptop, desktop: Monitor, console: Gamepad2, other: Package };
export function UnitIcon({ category, size = 22 }: { category: RetailCategory; size?: number }) {
  const Icon = icons[category];
  return <Icon size={size} aria-hidden="true" />;
}
