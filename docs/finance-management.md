# Finance management

The initial finance workflow uses manual payment recording and explicit verification. Amounts are stored as integer Indonesian rupiah.

- `GET /api/v1/finance/invoices` — list school invoices.
- `POST /api/v1/finance/invoices` — issue an invoice for an enrollment.
- `GET /api/v1/finance/payments` — list payment records and verification status.
- `POST /api/v1/finance/payments` — record a pending manual payment against an invoice.
- `POST /api/v1/finance/payments/:paymentId/verify` — verify payment and update invoice balance/status.
- `POST /api/v1/finance/payments/:paymentId/reject` — reject pending payment with a reason.

Payment records are processed once. The API prevents pending reservations and verified amounts from exceeding the remaining invoice balance. A future parent portal will allow families to submit payment evidence without giving them finance-management permissions.
