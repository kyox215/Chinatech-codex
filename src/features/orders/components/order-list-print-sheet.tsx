import { QRCodeSVG } from "qrcode.react";

import type { OrderListItem } from "@/lib/repairdesk/api";
import type { StoreSettings } from "@/lib/repairdesk/types";
import {
  formatEuro,
  formatItalianDateTime,
  deviceCustodyItalian,
  orderTypeItalian,
  statusItalian,
  toItalianWarranty,
  translateFaultName,
  translatePrintableText,
} from "@/features/orders/model/order-italian";
import { isOrderCancelledForPayment } from "@/features/orders/model/order-payment-state";
import {
  FittedPrintPage,
  PrintPortal,
  type PrintPaperMode,
} from "@/features/orders/components/print-portal";
import { buildStorePrintProfile } from "@/features/print/model/store-print-profile";

export function OrderListPrintSheet({
  orders,
  storeSettings,
  activeStore,
  customerStatusUrls,
  paperMode = "a5-landscape",
}: {
  orders: OrderListItem[];
  storeSettings?: Partial<StoreSettings> | null;
  activeStore?: { id?: string; name?: string } | null;
  customerStatusUrls?: Record<string, string>;
  paperMode?: PrintPaperMode;
}) {
  if (!orders.length || orders.some((order) => !customerStatusUrls?.[order.id])) return null;

  const storeProfile = buildStorePrintProfile(storeSettings, activeStore);

  return (
    <PrintPortal paperMode={paperMode}>
      <section className="repair-print-sheet" aria-hidden="true">
        {orders.map((order) => (
          <FittedPrintPage
            key={order.id}
            contentUnits={[
              order.public_no,
              order.customer_name,
              order.customer_phone,
              ...order.contact_phones,
              order.device_label,
              order.device_imei,
              order.issue_description,
              order.technician_name,
              order.warranty_text,
              order.accessory_notes,
              ...order.fault_prices.flatMap((item) => [item.name, "note" in item ? item.note : ""]),
            ].reduce((total, value) => total + String(value ?? "").length, 0)}
          >
            <div className="repair-print-left">
              <header className="repair-print-store">
                <h2>{storeProfile.storeName}</h2>
                <p>{storeProfile.storeSummaryLine}</p>
                <h1>SCHEDA ORDINE DI RIPARAZIONE</h1>
                <p>Riepilogo per stampa rapida</p>
              </header>

              <div className="repair-print-meta">
                <PrintMeta label="Numero ordine" value={order.public_no} />
                <PrintMeta label="Data" value={formatItalianDateTime(order.created_at)} />
                <PrintMeta label="Cliente" value={order.customer_name} />
                <PrintMeta label="Telefono" value={order.customer_phone} />
                {order.contact_phones.length > 0 && (
                  <PrintMeta
                    label="Telefono alternativo"
                    value={order.contact_phones.join(" / ")}
                  />
                )}
              </div>

              <PrintSection title="Dispositivo">
                <PrintLine label="Dispositivo" value={order.device_label} />
                <PrintLine label="IMEI / Seriale" value={order.device_imei || "-"} />
              </PrintSection>

              <PrintSection title="Intervento richiesto">
                <table className="repair-print-table">
                  <thead>
                    <tr>
                      <th>Descrizione</th>
                      {!order.finance_redacted ? <th>Importo</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {order.fault_prices.length ? (
                      order.fault_prices.map((item, index) => (
                        <tr key={`${order.id}-${item.name}-${index}`}>
                          <td>
                            <strong>{translateFaultName(item.name)}</strong>
                            {"note" in item && item.note ? (
                              <span>{translatePrintableText(item.note)}</span>
                            ) : null}
                          </td>
                          {!order.finance_redacted ? (
                            <td>{item.price > 0 ? formatEuro(item.price) : "-"}</td>
                          ) : null}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td>{translatePrintableText(order.issue_description)}</td>
                        {!order.finance_redacted ? <td>-</td> : null}
                      </tr>
                    )}
                  </tbody>
                </table>
                <PrintParagraph
                  label="Problema segnalato"
                  value={translatePrintableText(order.issue_description)}
                />
              </PrintSection>
            </div>

            <aside className="repair-print-right">
              <header>
                <h2>RIEPILOGO SERVIZIO</h2>
                <p>Documento generato dal gestionale {storeProfile.storeName}</p>
              </header>

              <section className="repair-print-status-qr" data-customer-status-qr="true">
                <QRCodeSVG
                  value={customerStatusUrls![order.id]}
                  level="M"
                  marginSize={4}
                  title={`Stato riparazione ${order.public_no}`}
                  aria-label={`QR per controllare lo stato dell'ordine ${order.public_no}`}
                />
                <div>
                  <h3>STATO RIPARAZIONE</h3>
                  <p>Scansiona per controllare l&apos;avanzamento.</p>
                  <strong>{order.public_no}</strong>
                </div>
              </section>

              <PrintSection title="Importi (EUR)">
                {order.finance_redacted ? (
                  <PrintLine label="Accesso" value="Importi riservati" />
                ) : (
                  <>
                    <PrintLine label="Totale ordine" value={formatEuro(order.quotation_amount)} />
                    <PrintLine label="Acconto" value={formatEuro(order.deposit_amount)} />
                    <PrintLine
                      label={
                        isOrderCancelledForPayment(order)
                          ? "Saldo alla cancellazione (non dovuto)"
                          : "Saldo dovuto"
                      }
                      value={formatEuro(order.balance_amount)}
                    />
                  </>
                )}
              </PrintSection>

              <PrintSection title="Servizio">
                <PrintLine label="Tecnico" value={order.technician_name} />
                <PrintLine label="Tipo ordine" value={orderTypeItalian[order.order_type]} />
                <PrintLine
                  label="Stato"
                  value={
                    statusItalian[isOrderCancelledForPayment(order) ? "cancelled" : order.status]
                  }
                />
                <PrintLine
                  label="Custodia del dispositivo"
                  value={deviceCustodyItalian(order.device_custody_status)}
                />
                <PrintLine label="Garanzia" value={toItalianWarranty(order.warranty_text)} />
                <PrintLine
                  label="Accessori consegnati"
                  value={translatePrintableText(order.accessory_notes) || "-"}
                />
              </PrintSection>

              <footer className="repair-print-footer">
                <div className="repair-print-signature">
                  <span>Firma cliente</span>
                </div>
                <p>
                  {storeProfile.printFooter} Conservare questo documento per eventuali garanzie.{" "}
                  {storeProfile.privacyNote}
                </p>
              </footer>
            </aside>
          </FittedPrintPage>
        ))}
      </section>
    </PrintPortal>
  );
}

function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="repair-print-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function PrintMeta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span>{label}:</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function PrintLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p className="repair-print-line">
      <strong>{label}:</strong> <span>{value || "-"}</span>
    </p>
  );
}

function PrintParagraph({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <p className="repair-print-paragraph">
      <strong>{label}:</strong> {value}
    </p>
  );
}
