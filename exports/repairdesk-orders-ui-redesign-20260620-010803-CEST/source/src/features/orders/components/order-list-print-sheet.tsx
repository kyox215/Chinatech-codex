import type { OrderListItem } from "@/lib/repairdesk/api";
import { QRCodeSVG } from "qrcode.react";
import {
  formatEuro,
  formatItalianDateTime,
  orderTypeItalian,
  statusItalian,
  toItalianWarranty,
  translateFaultName,
  translatePrintableText,
} from "@/features/orders/model/order-italian";
import { getOrderTaskUrl } from "@/features/orders/model/order-task-flow";
import { PrintPortal } from "@/features/orders/components/print-portal";

export function OrderListPrintSheet({ orders }: { orders: OrderListItem[] }) {
  if (!orders.length) return null;

  return (
    <PrintPortal>
      <section className="repair-print-sheet" aria-hidden="true">
        {orders.map((order) => (
          <div className="repair-print-page" key={order.id}>
            <div className="repair-print-left">
              <header className="repair-print-store">
                <h2>ChinaTech</h2>
                <p>Viale Vittorio Veneto, 7, Floridia (SR) 96014</p>
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
                      <th>Importo</th>
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
                          <td>{item.price > 0 ? formatEuro(item.price) : "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td>{translatePrintableText(order.issue_description)}</td>
                        <td>-</td>
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
                <p>Documento generato dal gestionale ChinaTech</p>
              </header>

              <section className="repair-print-task-qr">
                <QRCodeSVG
                  value={getOrderTaskUrl(order.id, getPrintOrigin())}
                  size={92}
                  marginSize={2}
                />
                <div>
                  <h3>SCAN TASK</h3>
                  <p>Scansiona per aprire la scheda operativa interna.</p>
                  <strong>{order.public_no}</strong>
                </div>
              </section>

              <PrintSection title="Importi (EUR)">
                <PrintLine label="Totale ordine" value={formatEuro(order.quotation_amount)} />
                <PrintLine label="Acconto" value={formatEuro(order.deposit_amount)} />
                <PrintLine label="Saldo dovuto" value={formatEuro(order.balance_amount)} />
              </PrintSection>

              <PrintSection title="Servizio">
                <PrintLine label="Tecnico" value={order.technician_name} />
                <PrintLine label="Tipo ordine" value={orderTypeItalian[order.order_type]} />
                <PrintLine label="Stato" value={statusItalian[order.status]} />
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
                  Conservare questo documento per eventuali garanzie. I dati personali sono trattati
                  secondo la normativa vigente.
                </p>
              </footer>
            </aside>
          </div>
        ))}
      </section>
    </PrintPortal>
  );
}

function getPrintOrigin() {
  if (typeof window !== "undefined") return window.location.origin;
  return undefined;
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
