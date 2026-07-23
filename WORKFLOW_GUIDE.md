# MSEC CampusServe — Official Service Workflow

CampusServe is the college record for maintenance and service work. Every request follows one traceable path with role ownership, SLA targets, evidence, notifications, and an immutable history.

## Workflow

| Phase | Statuses | Primary owner | Required outcome |
|---|---|---|---|
| Request and review | `DRAFT`, `SUBMITTED`, `CLARIFICATION_REQUIRED`, `APPROVED` | Requester / Admin | A complete, approved request |
| Inspection and estimate | `ASSIGNED_TO_MANAGER`, `QUOTATION_IN_PROGRESS`, `QUOTATION_SUBMITTED`, `QUOTATION_APPROVED` | Manager / Admin | Approved scope and budget |
| Service execution | `WORK_ORDER_CREATED`, `TECHNICIAN_ASSIGNED`, `WORK_ACCEPTED`, `IN_PROGRESS`, `TECHNICIAN_COMPLETED` | Manager / Technician | Completed work with evidence |
| Verification and settlement | `SERVICE_VERIFIED`, `INVOICE_IN_PROGRESS`, `INVOICE_SUBMITTED`, `PAYMENT_PENDING`, `PARTIALLY_PAID` | Requester / Manager / Accounts | Verified service and full settlement |
| Closure | `CLOSED` | System | Complete auditable record |

## Recovery paths

- Clarification: requester edits and resubmits.
- Unresolved service: requester reopens the request for admin review.
- Declined assignment: manager reassigns the work order.
- Rejected quotation or invoice: manager creates a corrected version.
- Paused work: technician records the blocker and resumes later.
- Additional cost: admin approves or rejects before work continues.
- Partial payment: accounts records further payments until the balance reaches zero.
- Cancellation: allowed only at safe pre-execution stages and always requires a history entry.

## SLA policy

Default action targets are calculated at each handoff: Emergency 2 hours, High 8 hours, Medium 24 hours, and Low 48 hours. Execution stages receive three times the base target; settlement stages receive five times the base target. Overdue non-terminal records are visually escalated.

## Evidence policy

Users may attach secure HTTP/HTTPS links for issue photos, quotations, work photos, invoices, receipts, and other supporting documents. Every attachment records its uploader, role, type, note, and timestamp. Do not attach public links containing personal or confidential information.

## Audit and notifications

Every status transition writes both the request history and a service-request audit record. The next responsible user receives an in-app notification linking directly to the request. Notification delivery does not replace official approval comments or evidence.

## Role queues

The Requests screen and role dashboards link to `?queue=MY_ACTIONS`. This queue is generated from the canonical workflow owner map, so each role sees only records currently requiring its action.

## Verification

Run `npm test -- --run` for component, workflow, recovery, ownership, and SLA tests. Run `npm run build` before deployment. A release should also be manually exercised once with requester, admin, manager, technician, and accounts users against a test database.

