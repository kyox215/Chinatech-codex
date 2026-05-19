import type * as React from "react";

import type { OrderDetail } from "@/lib/repairdesk/api";
import {
  formatEuro,
  formatItalianDateTime,
  orderTypeItalian,
  statusItalian,
  toItalianWarranty,
  translateFaultName,
} from "@/features/orders/model/order-italian";

export function RepairOrderPrintSheet({ data, orderUrl }: { data: OrderDetail; orderUrl: string }) {
  const { order, customer, device } = data;
  const snapshot = order.device_snapshot;
  const deviceBrand = snapshot?.brand || device?.brand || order.device_label.split(" ")[0] || "-";
  const deviceModel =
    snapshot?.model ||
    device?.model ||
    order.device_label.replace(deviceBrand, "").trim() ||
    order.device_label ||
    "-";
  const deviceImei = snapshot?.serial_or_imei || order.device_imei || device?.serial_or_imei;
  const deviceNotes = snapshot?.device_notes || device?.device_notes;
  const faultRows = order.fault_prices.length
    ? order.fault_prices
    : [{ name: order.issue_description || "Intervento richiesto", price: 0 }];

  return (
    <section className="repair-print-sheet" aria-hidden="true">
      <div className="repair-print-page">
        <div className="repair-print-left">
          <header className="repair-print-store">
            <h2>ChinaTech</h2>
            <p>Viale Vittorio Veneto, 7, Floridia (SR) 96014</p>
            <h1>ORDINE DI RIPARAZIONE</h1>
            <p>Documento per il cliente</p>
          </header>

          <div className="repair-print-meta">
            <PrintMeta label="Numero ordine" value={order.public_no} />
            <PrintMeta label="Data" value={formatItalianDateTime(order.created_at)} />
            <PrintMeta label="Cliente" value={customer?.name ?? order.customer_name} />
            <PrintMeta label="Telefono" value={customer?.phone_e164 ?? order.customer_phone} />
          </div>

          <PrintSection title="Dispositivo">
            <PrintLine label="Marca" value={deviceBrand} />
            <PrintLine label="Modello" value={deviceModel} />
            <PrintLine label="IMEI / Seriale" value={deviceImei || "-"} />
            {deviceNotes && <PrintLine label="Note dispositivo" value={deviceNotes} />}
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
                {faultRows.map((item, index) => (
                  <tr key={`${item.name}-${index}`}>
                    <td>
                      <strong>{translateFaultName(item.name)}</strong>
                      {"note" in item && item.note ? <span>{item.note}</span> : null}
                    </td>
                    <td>{item.price > 0 ? formatEuro(item.price) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PrintParagraph label="Problema segnalato" value={order.issue_description} />
            <PrintParagraph label="Diagnosi" value={order.diagnosis_result || "Da completare"} />
          </PrintSection>

          <PrintSection title="Importi (EUR)">
            <PrintLine label="Totale ordine" value={formatEuro(order.quotation_amount)} />
            <PrintLine label="Acconto" value={formatEuro(order.deposit_amount)} />
            <PrintLine label="Saldo dovuto" value={formatEuro(order.balance_amount)} />
          </PrintSection>

          <PrintSection title="Servizio">
            <PrintLine label="Tecnico" value={order.technician_name} />
            <PrintLine label="Tipo ordine" value={orderTypeItalian[order.order_type]} />
            <PrintLine label="Stato" value={statusItalian[order.status]} />
            <PrintLine label="Durata garanzia" value={toItalianWarranty(order.warranty_text)} />
            <PrintLine label="Etichette accessori" value={order.internal_tag || "-"} />
            {orderUrl && <PrintLine label="Link scheda" value={orderUrl} />}
          </PrintSection>
        </div>

        <aside className="repair-print-right">
          <header>
            <h2>GARANZIA E INFORMAZIONI NEGOZIO</h2>
            <p>ChinaTech</p>
            <p>Viale Vittorio Veneto, 7, Floridia (SR) 96014</p>
          </header>

          <section className="repair-print-warranty">
            <h3>Termini di garanzia</h3>
            <ul>
              <li>
                La garanzia copre esclusivamente difetti di materiale o lavorazione relativi ai
                componenti sostituiti o alla riparazione effettuata.
              </li>
              <li>
                Non sono coperti danni da uso improprio o negligenza, cadute, urti, piegature,
                pressione sul dispositivo, ingresso di liquidi o corrosione.
              </li>
              <li>
                Sono esclusi tentativi di riparazione da terzi dopo il nostro intervento e danni
                estetici preesistenti non oggetto della riparazione.
              </li>
              <li>
                Rotture successive di vetro touchscreen/LCD, ammaccature o crepe dovute a incidenti
                o uso non corretto non sono coperte.
              </li>
              <li>
                La garanzia non include software, account, dati personali, accessori non riparati da
                noi o componenti non sostituiti.
              </li>
              <li>
                Eventuali reclami devono essere segnalati tempestivamente in negozio presentando
                questo documento e il dispositivo.
              </li>
            </ul>
          </section>

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
    </section>
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
