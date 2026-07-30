# Scanner Component Boundary Declaration

Status: active
Owner: RepairDesk Integration Lead
Applies to: order lookup, order create/detail/edit device capture, inventory device intake

## Mandatory boundary

RepairDesk has two separate business scanner components. They may share only business-neutral camera lifecycle and sheet presentation code.

| Business component | Entry points | Accepted automatic result | Rejected automatic result |
| --- | --- | --- | --- |
| Order QR scanner | Order management list and order lookup actions | Trusted internal order QR and protected customer repair-status QR | IMEI, SN, EID, EAN/SKU, arbitrary text, external URL, non-QR barcode |
| IMEI scanner | New order, order detail/edit and inventory device intake | Exactly 15 digits and valid IMEI Luhn checksum | SN/serial, EID, EAN/SKU, suspect/invalid IMEI, arbitrary text |

The order feature must use `OrderQrScannerButton` / `OrderQrScannerSheet` and its own `parseOrderQrPayload`. It must not route order lookup through the generic scan-search intent or the IMEI parser.

The device capture feature must use `ImeiScannerField` and the `extractValidImeiCandidates` gate. Automatic camera, image, OCR and scanner-modal paste results must pass that gate before filling the device value. Existing historical serial values may remain visible and editable through legacy/manual business fields, but they are not automatic recognition candidates.

## Shared infrastructure rule

`BarcodeScannerSheet` is a camera/sheet shell, not an order parser. The order wrapper must set `scanMode="qr-only"` and inject the order parser. The default multi-format mode remains for other explicitly generic capture flows.

No shared helper may silently widen either component's accepted business payloads. Any future widening requires an explicit product decision, security review, tests, and an update to this declaration.

## Required tests

- Order QR parsing accepts exact trusted order/status links and rejects IMEI, SN, EID, external URLs and query-bearing redirects.
- The order component binds the camera shell to QR-only format hints.
- IMEI extraction returns only checksum-valid 15-digit values and rejects SN, EID and EAN.
- Order management does not import or subscribe to generic scan-search intents.
