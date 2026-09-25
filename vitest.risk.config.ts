import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config";

// Deliberately scoped to payment draft validation and store lifecycle write protection.
// This is not a claim about whole-application or real-backend coverage.
export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: [
        "src/features/orders/model/order-finance-draft.test.ts",
        "src/features/stores/server/store-lifecycle-access.test.ts",
      ],
      coverage: {
        enabled: true,
        include: [
          "src/features/orders/model/order-finance-draft.ts",
          "src/features/stores/server/store-lifecycle-access.ts",
        ],
        reportsDirectory: "coverage/risk",
        thresholds: { perFile: true, statements: 90, branches: 80, functions: 100, lines: 90 },
      },
    },
  }),
);
