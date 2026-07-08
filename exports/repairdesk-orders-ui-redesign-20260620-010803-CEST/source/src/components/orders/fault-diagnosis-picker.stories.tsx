"use client";

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { FaultDiagnosisPicker, type SelectedFault } from "./fault-diagnosis-picker";

function FaultDiagnosisPickerStory() {
  const [selected, setSelected] = useState<SelectedFault[]>([
    {
      key: "display:unspecified",
      categoryKey: "display",
      categoryLabel: "屏幕",
      name: "屏幕",
      price: 0,
      note: "Display",
    },
  ]);

  return (
    <div className="w-[720px] max-w-[calc(100vw-32px)] rounded-xl bg-background p-6 text-foreground">
      <FaultDiagnosisPicker selected={selected} onChange={setSelected} />
    </div>
  );
}

const meta = {
  title: "Orders/FaultDiagnosisPicker",
  component: FaultDiagnosisPickerStory,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof FaultDiagnosisPickerStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
