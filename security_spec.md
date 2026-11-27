# NAMMAOORU Security Specification (Phase 0)

## 1. Data Invariants

1. **Identity & Privilege Isolation**: No user may self-assign `government`, `ngo`, or `admin` roles on `/users/{uid}` or create records in `/admins/{uid}`. Only an existing verified administrator (or the bootstrapped verified administrator `devstar3940@gcplab.me`) may approve a `/roleRequests/{uid}` record and elevate `/users/{uid}`.
2. **Citizen Report Privacy**: A citizen may only `get`, `list`, and `create` `/reports/{reportId}` documents where `reporterUid == request.auth.uid`. Citizens can never read or modify another citizen's private reports.
3. **Government Department Scoping**: An approved Government Department officer may only `get` or `update` `/reports/{reportId}` assigned to their verified `departmentId`, and may never set a report status to `Citizen verified` (only the submitting citizen may verify).
4. **NGO Boundary Enforcement**: Approved NGO accounts may only update permitted `/ngoActivities/{activityId}` documents and have zero write access to `/reports/{reportId}`. Completing an NGO activity never alters official civic report status.
5. **PII Isolation**: User profiles (`/users/{uid}`) and role requests (`/roleRequests/{uid}`) contain emails and personal details and are readable strictly by the owning user or an administrator.
6. **Terminal State Locking**: Once a `/reports/{reportId}` reaches `Citizen verified` or an `/ngoActivities/{activityId}` reaches `Completed`, non-admin users cannot mutate its state.
7. **Temporal & Structural Integrity**: All `createdAt` / `updatedAt` timestamps must match `request.time`; all IDs must match `^[a-zA-Z0-9_\-]+$` (max 128 chars); all strings and arrays enforce strict size bounds; no shadow fields are permitted.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)

1. **Self-Assigned Admin Registration**: New user writes `/users/{uid}` with `{ "role": "admin", "approvalStatus": "approved" }`.
2. **Self-Assigned Department Escalation**: Existing citizen updates `/users/{uid}` changing `role` from `"citizen"` to `"government"` and `departmentId` to `"DEP-01"`.
3. **Direct Admin Registry Forgery**: Non-admin user attempts `create` on `/admins/{uid}`.
4. **Unverified Email Admin Spoof**: Unauthenticated or unverified (`email_verified: false`) token with admin email attempts to read `/users/{otherUid}`.
5. **Cross-Citizen Private Report Read**: Citizen A attempts `get` or unfiltered `list` on `/reports/{reportId}` belonging to Citizen B.
6. **Impersonated Report Creation**: Citizen A attempts `create` on `/reports/BLR-999` with `reporterUid: "citizen-b-uid"`.
7. **Government Department Cross-Boundary Update**: Approved officer for `DEP-02` attempts to update status of a report assigned to `DEP-01`.
8. **Government Forging Citizen Verification**: Approved officer for `DEP-01` attempts to update report `status` directly to `"Citizen verified"`.
9. **NGO Mutating Official Civic Report**: Approved NGO user attempts to update `/reports/{reportId}` status after finishing a clean-up drive.
10. **Shadow Field Injection**: Citizen creates or updates a report injecting an undeclared field `"isOfficiallyApproved": true`.
11. **Terminal State Tampering**: Department officer attempts to alter a report whose `existing().status == "Citizen verified"`.
12. **Resource Poisoning / Timestamp Forgery**: Attacker sends a 5KB string in `title`, an oversized document ID `../evil`, or backdated `createdAt` timestamp instead of `request.time`.
