# Memory Delta

Stable rule: business invitations and Auth email links are separate gates. An Auth link may establish a verified session, but only an active, matching, unexpired non-owner invitation accepted by the service-role-only atomic RPC may grant store access.

Operational rule: custom email templates must route through a GET confirmation page whose explicit same-origin POST consumes the one-time token. Preserve remote MFA/OTP/redirect settings when applying hosted Auth templates; never push the local Site URL wholesale.

Release evidence: linked migrations align through `20260717223354`, final remote lint is clean, full tests are 217/1484, build and responsive screenshots passed. Real inbox delivery and custom SMTP remain an operational follow-up, not simulated evidence.
