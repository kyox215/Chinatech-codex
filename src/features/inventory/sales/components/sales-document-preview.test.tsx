import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildSalesDocument, salesDocumentCopy } from "../model/sales-document";
import { SalesDocumentPreview, SalesDocumentSheet } from "./sales-document-preview";
import { documentFixture } from "../model/sales-document.fixture";

describe("sales document UI", () => {
  it.each(["it", "en", "zh"] as const)(
    "keeps %s historical payment dates separate from later warranty",
    (language) => {
      render(
        <SalesDocumentSheet
          document={buildSalesDocument(documentFixture(), "payment", "DEMO-R1")}
          language={language}
        />,
      );
      expect(screen.getByText(salesDocumentCopy[language].asOf)).toBeVisible();
      expect(screen.getByText(salesDocumentCopy[language].paymentScope)).toBeVisible();
      expect(screen.getByText(salesDocumentCopy[language].rights)).toBeVisible();
      expect(screen.queryByText(/2028/)).not.toBeInTheDocument();
    },
  );
  it("keeps a one-off language choice separate from each newly opened document default", () => {
    const doc = buildSalesDocument(documentFixture(), "sale");
    const { rerender } = render(<SalesDocumentPreview key="first" document={doc} />);
    fireEvent.change(screen.getByLabelText("Lingua del documento"), { target: { value: "zh" } });
    expect(screen.getByLabelText("本次凭证语言")).toHaveValue("zh");
    rerender(<SalesDocumentPreview key="second" document={doc} />);
    expect(screen.getByLabelText("Lingua del documento")).toHaveValue("it");
    rerender(<SalesDocumentPreview key="third" document={doc} defaultLanguage="en" />);
    expect(screen.getByLabelText("Document language")).toHaveValue("en");
    expect(screen.getByRole("button", { name: "Print" })).toBeDisabled();
    expect(within(screen.getByLabelText("Paper")).getAllByRole("option")).toHaveLength(2);
  });
  it("unmounts native print content when output authority is unavailable", () => {
    const source = documentFixture();
    source.store.canOutput = false;
    source.store.blockReason = "Store identity must be verified";
    render(
      <SalesDocumentPreview document={buildSalesDocument(source, "sale")} onPrint={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Stampa" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Store identity must be verified");
    expect(document.querySelector(".repair-print-sheet")).toBeNull();
    expect(document.body).not.toHaveClass("has-repair-print");
  });
});
