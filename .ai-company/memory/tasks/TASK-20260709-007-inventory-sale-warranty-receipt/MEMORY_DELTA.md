# Memory Delta

Task-local memory only.

- Direct-stock inventory creation can reuse existing `inventory_items` columns: `source_type`, `status`, `buyback_price` as acquisition cost, `repair_cost_amount`, `list_price`, and `warranty_months`.
- Sale/warranty receipt snapshot can be stored in `legacy_payload.sale_receipt` without a migration for this release.
- Buyback source should remain pinned to `intake` at creation so existing buyback quote/evidence validation is not bypassed.
- Visual evidence was blocked in this run by unavailable browser backend; future UI QA should capture `/inventory` add-product and receipt dialogs when browser control is available.
