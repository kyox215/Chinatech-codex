import { describe, expect, it } from "vitest";

import {
  evaluateTemplateHealth,
  getUnknownTemplateVariables,
  insertTemplateVariable,
  renderTemplate,
} from "./template-renderer";

describe("template renderer helpers", () => {
  it("detects variables that are not part of the allowed template contract", () => {
    expect(
      getUnknownTemplateVariables(
        "Ciao {{customer_name}}, ordine {{order_no}} {{bad_key}} {{bad_key}}",
        ["customer_name", "order_no"],
      ),
    ).toEqual(["bad_key"]);
  });

  it("inserts a template variable at the current selection", () => {
    expect(insertTemplateVariable("Numero ordine:", "order_no", 14, 14)).toEqual({
      bodyTemplate: "Numero ordine: {{order_no}}",
      cursorPosition: 27,
    });
  });

  it("replaces the selected text when inserting a template variable", () => {
    expect(insertTemplateVariable("Ciao cliente", "customer_name", 5, 12)).toEqual({
      bodyTemplate: "Ciao {{customer_name}}",
      cursorPosition: 22,
    });
  });

  it("renders unknown variables as empty strings", () => {
    expect(renderTemplate("Ciao {{customer_name}} {{unknown}}", { customer_name: "Mario" })).toBe(
      "Ciao Mario",
    );
  });

  it("marks enabled templates with unknown variables as blocked", () => {
    const health = evaluateTemplateHealth({
      bodyTemplate: "Ciao {{customer_name}} {{bad_key}}",
      allowedVariables: ["customer_name"],
      enabled: true,
    });

    expect(health).toMatchObject({
      label: "不可发送",
      tone: "danger",
      canSend: false,
      canSave: false,
    });
    expect(health.issues[0]?.label).toContain("{{bad_key}}");
  });

  it("allows disabled empty templates to be saved but not sent", () => {
    expect(
      evaluateTemplateHealth({
        bodyTemplate: "",
        allowedVariables: ["customer_name"],
        enabled: false,
      }),
    ).toMatchObject({
      label: "已停用",
      tone: "neutral",
      canSend: false,
      canSave: true,
    });
  });

  it("warns when an enabled template is unusually long", () => {
    const health = evaluateTemplateHealth({
      bodyTemplate: Array.from({ length: 19 }, (_, index) => `Riga ${index + 1}`).join("\n"),
      allowedVariables: [],
      enabled: true,
    });

    expect(health).toMatchObject({
      label: "建议复核",
      tone: "warning",
      canSend: true,
      canSave: true,
    });
  });
});
