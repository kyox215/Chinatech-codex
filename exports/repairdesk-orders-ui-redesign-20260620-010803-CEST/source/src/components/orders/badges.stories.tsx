import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ApprovalBadge, MoneyText, OrderTypeBadge, StatusBadge } from "./badges";

function OrderBadgesStory() {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-background p-6 text-foreground">
      <StatusBadge status="new" />
      <StatusBadge status="waiting_approval" />
      <OrderTypeBadge type="quick_repair" />
      <ApprovalBadge status="pending" />
      <MoneyText amount={365} />
    </div>
  );
}

const meta = {
  title: "Orders/Badges",
  component: OrderBadgesStory,
} satisfies Meta<typeof OrderBadgesStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
