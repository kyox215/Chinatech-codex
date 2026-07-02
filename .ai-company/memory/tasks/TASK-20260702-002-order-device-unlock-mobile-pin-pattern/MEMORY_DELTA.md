# Memory Delta

- Device unlock pattern now means an ordered trajectory sequence, not a unique-point set.
- Valid pattern input is 4-128 steps, each step an Android-style point from 1 to 9; repeated points are valid.
- Existing privacy rule remains unchanged: unlock secrets stay hidden from order lists, audit event payloads, print/export, WhatsApp, SMS, and external messages unless a future privacy-approved design changes that.
