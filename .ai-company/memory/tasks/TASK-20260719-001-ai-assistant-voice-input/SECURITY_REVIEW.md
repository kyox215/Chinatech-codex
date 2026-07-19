# Security Review — AI Assistant Voice Input

## Conclusion

**PASS for the local candidate.** No blocker or major finding. Production remains a separate D4 because browser/OS speech processing and microphone permission become customer-visible behavior.

## Lightweight threat model

| Area             | Assessment                                                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assets           | Ambient audio, transcribed query text, employee/store context, existing AI query boundary.                                                                                   |
| Actors / misuse  | Malicious or accidental auto-listening, hidden continued listening, accidental PII speech, transcript auto-submit, stale session after Sheet close, browser service failure. |
| Entry            | Visible `type="button"` microphone control in the authenticated employee AI Sheet.                                                                                           |
| Trust boundaries | Employee click → browser/OS speech service (local or remote) → transcript in page memory → employee manual Send → existing RepairDesk AI BFF.                                |
| Worst impact     | Ambient speech processed without informed consent or sensitive transcript sent to the existing AI path without review.                                                       |

## Verified controls

- `SpeechRecognition.start()` is reachable only from the visible microphone button click; no mount, timer or background auto-start.
- Listening uses a destructive stop button, square icon, `aria-pressed` and an `aria-live` “正在听” status.
- Transcript only calls `setInput`; it cannot invoke `runAiOrderAssistantTurn`. Unit/E2E assertions require zero order links/API calls before manual Send.
- Input remains capped at 800 characters and retains the existing sensitive-input policy after manual submission.
- No `getUserMedia`, `MediaRecorder`, audio Blob, audio URL, upload, local storage, IndexedDB, log, database or OpenAI transcription path exists in the diff.
- Sheet close, store change, disabled/query state and unmount detach handlers and call `abort()`; manual Stop calls `stop()` to request the final transcript.
- Raw browser error message is never displayed or logged; fixed safe Chinese errors cover permission, no speech, capture, network/service and language failures.
- UI states that browser/device speech service may process audio, does not claim on-device-only behavior, and repeats the no-PII instruction.

## Findings

| Severity                      | Finding                                                                              | Disposition                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Residual / accepted for local | Browser/OS provider may use a remote speech service with vendor-specific retention.  | Exact disclosure + no RepairDesk audio access/storage; production D4 must accept this boundary.  |
| Residual / accepted for local | Safari Home Screen/PWA and embedded browser availability varies by version/settings. | Runtime constructor/error detection; keyboard fallback always remains.                           |
| Existing / unrelated          | `npm ci` reports six dependency advisories from the current upstream lockfile.       | No package/lockfile change in this task; do not expand scope. Track under dependency governance. |

## Security gate

- Local implementation: **PASS**.
- Production activation: **NOT APPROVED in this task**; requires exact commit, disclosure acceptance, rollback and observation approval.
