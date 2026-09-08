import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { buildSalesDocument } from "../model/sales-document";
import { documentFixture } from "../model/sales-document.fixture";
import { SalesDocumentPreview } from "./sales-document-preview";

const meta = {
  title: "Inventory/Sales documents",
  component: SalesDocumentPreview,
  args: { onPrint: () => window.print() },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <main className="mx-auto max-w-3xl p-3">
        <Story />
      </main>
    ),
  ],
} satisfies Meta<typeof SalesDocumentPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Sale: Story = { args: { document: buildSalesDocument(documentFixture(), "sale") } };
export const Payment: Story = {
  args: { document: buildSalesDocument(documentFixture(), "payment", "DEMO-R1") },
};
export const Warranty: Story = {
  args: { document: buildSalesDocument(documentFixture(), "warranty") },
};
export const PrintError: Story = {
  args: {
    document: buildSalesDocument(documentFixture(), "sale"),
    printError: "Stampa non riuscita. Il documento è conservato; riprovare.",
  },
};
