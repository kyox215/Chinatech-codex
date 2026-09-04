import { describe, expect, it } from "vitest";

import {
  DEFAULT_MESSAGE_TEMPLATES,
  MESSAGE_TEMPLATE_VARIABLES,
} from "@/features/messages/model/message-template-defaults";
import { getUnknownTemplateVariables } from "@/features/messages/model/template-renderer";

describe("message template default variable contract", () => {
  it("registers every canonical token used by enabled defaults without altering template bytes", () => {
    const allowed = MESSAGE_TEMPLATE_VARIABLES.map((variable) => variable.name);
    const originalTemplates = structuredClone(DEFAULT_MESSAGE_TEMPLATES);

    for (const template of DEFAULT_MESSAGE_TEMPLATES.filter((candidate) => candidate.enabled)) {
      expect(getUnknownTemplateVariables(template.body_template, allowed), template.id).toEqual([]);
    }

    expect(allowed).toEqual(
      expect.arrayContaining(["parts_update_line", "issue_line", "cancel_reason_line"]),
    );
    expect(DEFAULT_MESSAGE_TEMPLATES).toEqual(originalTemplates);
  });
});
