# CampusServe Workflow Testing

## Automated checks

```powershell
npm test -- --run
npm run build
```

The workflow tests validate the complete happy path, rejected/declined recovery paths, role ownership, SLA priorities, UI guidance, routing, and core components.

## Multi-role acceptance test

1. Requester creates and submits a request with issue evidence.
2. Admin reviews, requests clarification once, then approves and assigns a manager.
3. Manager records inspection, drafts a quotation, and submits it.
4. Admin requests one revision, then approves the revised quotation.
5. Manager creates a work order and assigns a technician.
6. Technician declines once; manager reassigns; the next technician accepts, starts, records progress and evidence, then completes.
7. Requester reopens once, then verifies the corrected completion.
8. Manager creates and submits the invoice.
9. Accounts requests one revision, then approves and records a partial payment followed by the final payment.
10. Confirm the request closes, balance is zero, all evidence remains accessible, every transition appears in History and Audit, and each handoff produced a deep-linked notification.

## Accessibility checks

- Complete primary actions using only the keyboard.
- Confirm focus is visible on links, tabs, inputs, selects, and dialogs.
- Verify labels are announced for evidence fields and status controls.
- Test at 320px mobile width and 200% browser zoom.
- Confirm status is communicated with text, not color alone.

## Deployment gate

- All automated checks pass.
- Multi-role acceptance test passes against non-production data.
- No overdue test records remain assigned to real users.
- SMTP/push configuration is verified.
- Database backup and rollback steps are confirmed.
