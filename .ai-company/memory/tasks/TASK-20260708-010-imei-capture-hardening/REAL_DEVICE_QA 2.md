# Real Device QA - IMEI Capture

## Purpose

This checklist verifies the parts that automated Playwright and Vitest cannot prove: real camera permission prompts, physical rear-camera startup, browser gallery behavior, and real save behavior in Chrome/Safari.

## Current Preview

- Local desktop preview can use `http://localhost:<port>/orders/new`.
- Mobile camera verification should use HTTPS:
  - Generate test labels: `npx tsx scripts/generate-imei-real-device-fixtures.ts`
  - Find Mac LAN IP: `ipconfig getifaddr en0` or `ipconfig getifaddr en1`
  - Start E2E-safe HTTPS preview: `REPAIRDESK_E2E_ORDER_AUDIT=1 npx next dev --experimental-https -p 3028 --hostname 0.0.0.0`
  - Open on phone: `https://<LAN-IP>:3028/orders/new`
- If Next reports `Another next dev server is already running`, do not kill it blindly. Confirm whether that preview belongs to another active task. Stop/reuse it only after the owner or Integration Lead confirms the preview is no longer needed and was started with the required E2E/mock/auth mode.
- Desktop Chrome/Safari may use `localhost` because it is treated as a secure context.
- Mobile Chrome/Safari should use a controlled HTTPS preview. A plain `http://<LAN-IP>:3022` URL is expected to fail camera access because mobile browsers require HTTPS or localhost.
- The Next.js HTTPS preview uses mkcert/self-signed certificates. Certificate generation may require local password/keychain trust. If certificate generation fails, or if a mobile browser still treats it as not secure after accepting the warning, use a trusted HTTPS preview/deployment or request owner approval before opening any public tunnel.
- Public tunnel was not opened in this run because exposing the local preview through a third-party tunnel requires explicit owner approval.

## Data Safety

- Use only test orders and test device identifiers.
- Do not screenshot full customer names, phone numbers, secrets, payment details, or production customer data.
- Acceptable test identifiers:
  - `490154203237518`
  - `356938035643809`
  - `SN-TEST-20260708`

## Test Labels

Prepare these before testing:

- Generate fixture files:
  - `screenshots/TASK-20260708-010-imei-capture-hardening/real-device-fixtures/imei-real-device-labels.html`
  - `screenshots/TASK-20260708-010-imei-capture-hardening/real-device-fixtures/imei-multi-candidate-label.png`
  - `screenshots/TASK-20260708-010-imei-capture-hardening/real-device-fixtures/imei-ocr-text-label.png`
- A QR code or barcode containing `356938035643809` for live camera scanning.
- A photo or printed label containing both:
  - `IMEI 490154203237518`
  - `IMEI 356938035643809`
- An iPhone HEIC/HEIF photo of the same label for mobile Safari gallery testing.
- A blurry or non-IMEI photo for failure-path testing.

Note: live camera scanning uses barcode/QR decoding. Pure numeric text recognition is verified through image upload OCR where the browser exposes native `TextDetector`.

## Browser Matrix

| Platform | Browser | URL requirement | Required |
| --- | --- | --- | --- |
| macOS desktop | Chrome | `http://localhost:3022` or HTTPS preview | Yes |
| macOS desktop | Safari | `http://localhost:3022` or HTTPS preview | Yes |
| Android phone | Chrome | HTTPS preview | Yes when Android device is available |
| iPhone | Safari | HTTPS preview | Yes |
| iPhone | Chrome | HTTPS preview | Optional, note it uses iOS WebKit |

## Entry Points

Run the matrix against each available entry point:

1. New order device section IMEI field.
2. Existing order detail overview IMEI popover.
3. Mobile order detail IMEI capture sheet.

If an entry point requires authenticated store context, use a safe test account/session only.

## Required Scenarios

### 1. Camera Permission Allow

Steps:

1. Open an IMEI entry point.
2. Click the camera icon.
3. Allow camera permission.
4. Confirm video preview appears.
5. Scan the QR/barcode containing `356938035643809`.

Pass:

- Browser permission prompt appears when expected.
- Rear camera is preferred on mobile when the browser supports it.
- If rear-camera constraints are unsupported, the scanner retries the browser default camera and records the scan or shows a recoverable error.
- Dialog records `356938035643809`.
- Scanner stops after capture.
- Field value is updated without page refresh.
- No raw browser/library error text is shown.

Fail:

- Camera never starts on a secure context.
- Front camera is forced on mobile with no usable rear-camera behavior.
- The dialog stays in a loading state after a successful scan.
- Raw `DOMException`, stack trace, or library error is shown to the user.

### 2. Camera Permission Deny

Steps:

1. Open scanner.
2. Deny camera permission.

Pass:

- User sees recoverable copy: permission was denied and upload/manual are available.
- Upload image and manual input controls remain usable.
- No page refresh is required.

### 3. No Camera / Camera Busy

Steps:

1. Test on a desktop without available camera, or occupy the camera with another app.
2. Open scanner.

Pass:

- User sees a recoverable no-camera or camera-busy message.
- Upload and manual fallback remain usable.

### 4. Gallery Photo With Multiple IMEI Values

Steps:

1. Open scanner.
2. Upload a JPG/PNG/WebP photo containing both test IMEI values.
3. Repeat with HEIC/HEIF on iPhone Safari.

Pass:

- If barcode/QR exists, image barcode recognition may return candidates.
- If the image is plain numeric text and the browser supports native OCR, multiple candidates are shown.
- User can choose `356938035643809`.
- Selected value is saved into the field.
- If OCR is unsupported or image decode fails, the user gets safe recovery copy and can use manual input.

### 5. Pure Numeric OCR

Steps:

1. Upload a clear photo containing only printed numeric IMEI text.

Pass:

- Browsers with native `TextDetector` show numeric IMEI candidates.
- Browsers without native OCR show safe fallback copy and do not block manual input.

Fail:

- The UI promises guaranteed OCR on a browser that does not provide it.
- The dialog stays stuck on `正在识别图片...`.

### 6. Bad Image / Timeout

Steps:

1. Upload a blurry image or non-IMEI photo.

Pass:

- Processing ends.
- User sees generic image failure or timeout recovery copy.
- Manual input remains available.

### 7. Save Integrity

Steps:

1. Save the selected IMEI on an existing order.
2. Refresh the page.
3. Reopen the order detail.

Pass:

- IMEI remains saved.
- Linked customer, device, unlock PIN/password, contact phones, issue notes, warranty, fault prices, deposit, and payment fields are unchanged.
- Blank IMEI is rejected for inline patch save.

## Result Table

| Date | Tester | Device | Browser | Entry point | Scenario | Result | Evidence path / note |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  | Desktop Mac | Chrome | New order | Camera allow |  |  |
|  |  | Desktop Mac | Safari | New order | Camera allow |  |  |
|  |  | Android | Chrome | New order | Camera allow |  |  |
|  |  | iPhone | Safari | New order | Camera allow |  |  |
|  |  | iPhone | Safari | New order | HEIC gallery multi-candidate |  |  |
|  |  | Any | Any | Order detail | Save integrity |  |  |

## Completion Rule

The IMEI capture goal can be marked complete only after:

- Automated checks remain passing.
- Desktop Chrome and desktop Safari have real camera or recoverable hardware-path evidence.
- Mobile Chrome and mobile Safari have controlled HTTPS real-device evidence for camera permission and gallery upload.
- At least one existing-order save is verified after refresh without corrupting linked customer/device/order detail data.
