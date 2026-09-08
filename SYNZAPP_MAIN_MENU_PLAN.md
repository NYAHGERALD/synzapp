# Synzapp main menu — plan of record

Written 8 September 2026, before any code. It is the source of truth for this
change; where the code and this document disagree, one of them is wrong and it
must be settled rather than guessed at.

## 1. What is being built

The hamburger menu on the Chats tab becomes the place a person can answer three
questions without asking anybody:

1. **Who am I here?** Name, photograph, role, phone number, department.
2. **Where can I go?** The five sections, as a readable list.
3. **Who do I ask?** My department admin — with their face, their number, and a
   tap that opens a chat with them.

And one way out: **Log out**.

### Order on the screen, top to bottom

| Block | Why there |
| --- | --- |
| **You** | Identity comes before navigation. Decided by Gerald: it goes at the top, not the bottom. |
| **Sections** | The reason the menu is opened most of the time. |
| **Your department admin** | An answer you need occasionally, not on every open. |
| **Log out** | Last, and alone. Never beside a link a thumb is aiming at. |

## 2. What already exists, and what does not

Checked against the running code and the live tenant, not assumed.

**Already available** — `CurrentUserProfile` returns `companyName`,
`departmentName`, `displayName`, `phoneFormatted`, `role`, `roleName`,
`profilePhotoUrl`. The **You** block needs no backend work at all.

**Not available** — nothing in the profile describes *my* admin. The only
department-admin fact anywhere is `departmentAdminName` on
`getDirectChatContactDetails`, it is a name and nothing else, and it describes
the contact you are looking at rather than you.

So the department admin block requires a backend addition. That is the whole of
the backend work.

## 3. Three cases that are live on the current tenant

None of these are hypothetical; all three exist in `tenant_ce5c7efc21dc…` today.

- **You are the department admin.** Gerald Second is, for Bakery. "Your
  department admin: yourself" is nonsense, so the block falls back to the
  **organization admin**.
- **The department has no admin.** Human Resources has none. Same fallback.
- **More than one.** The existing resolver answers `"Name + 1 more"`. A string
  like that cannot be tapped, so the profile returns **one** admin, chosen
  deterministically, plus a count of the others.

If there is no department admin *and* no organization admin, the block is not
drawn. An empty card headed "Your department admin" is worse than no card.

## 4. The phone number is a tenant's decision

A manager's personal number, pinned in the menu for everybody in their
department, is not Synzapp's call to make on a company's behalf.

**Correction to my earlier note:** I said this belonged in admin.synzapp.com.
That is wrong, and the codebase says so. `scheduledMessagePolicy` and
`actionReminderPolicy` are both **per-tenant, set by that tenant's own org
admin**. The staff console decides things that cross tenants — retention bounds,
published policies. Who inside one company sees one number is that company's
decision, so it follows the scheduled-messages precedent exactly.

**`adminContactPolicy.showAdminPhoneNumber`**, default **true**, on the
organization record. When false the backend returns `phoneFormatted: null` — the
number is never sent to the phone rather than sent and hidden, because a value
withheld in the interface is a value already on the device.

## 5. Backend

| File | Change |
| --- | --- |
| `services/adminContactPolicy.ts` | **New.** Pure rules: `DEFAULT_ADMIN_CONTACT_POLICY`, `normalizeAdminContactPolicy`, `validateAdminContactPolicyInput`, `selectProfileAdminContact`. No Firestore import, so it is testable. |
| `services/userProfileService.ts` | `CurrentUserProfile.departmentAdmin`, resolved from the tenant's active users. |
| `routes/adminRoutes.ts` | `GET` and `PATCH /api/admin/admin-contact-policy`, App Check, active device, audit on success **and** failure. |

`departmentAdmin` shape:

```ts
{
  contactId: string;              // the uid, so the row can open a chat
  displayName: string;
  otherAdminCount: number;        // 0 unless the department has several
  phoneFormatted: string | null;  // null when the tenant has switched it off
  profilePhotoCacheKey: string | null;
  profilePhotoUrl: string | null;
  roleName: string;
  scope: 'DEPARTMENT' | 'ORGANIZATION';
} | null
```

`scope` is what lets the phone label the card honestly. A fallback to the org
admin that still says "your department admin" is a lie the interface tells every
person in a department that has none.

**Route shape is copied from `/scheduled-message-policy`**, which already passes
`auditCoverage.test.ts` and `apiRouteGuardCoverage.test.ts`. Those two tests read
the route file and will fail the build if the new routes miss App Check, the
device check, or either audit branch.

## 6. Mobile

| File | Change |
| --- | --- |
| `services/mainNavigationDetails.ts` | **New.** Pure wording: the card heading per `scope`, the "+1 more" line, the nav labels and icons. Tested. |
| `services/profileApi.ts` | Type and normaliser for `departmentAdmin`. |
| `services/adminApi.ts` | Read and write the policy. |
| `components/navigation/MainNavigationModal.tsx` | Rebuilt on the grouped list. |
| `components/settings/AdminContactSettings.tsx` | **New.** The tenant switch, mirroring `ScheduledMessagesSettings`. |
| `screens/AdminChatScreen.tsx` | Passes the profile, the photo headers, the chat-opening callback and sign-out. |

**Navigation labels** move from shouting capitals to sentence case with an icon
each: Actions, Record meeting, Leaders standard work, Interpreter, Library.
Capitals are slower to read; the icon is what people actually navigate by.

**Opening a chat with the admin** reuses `handleOpenContactFromNewChat`, matching
on `contactId` in `startableDirectChatContacts`. Nothing new is written for it.
If the admin is not in that list the row is drawn but not pressable — an inert
row beats a row that opens an error.

## 7. Not in this change

- The Employees directory question — whether it lists everyone in the company or
  only the invited — is still open and is not touched here.
- `RAILS`, `LSW`, `RCA` and the interpreter are not edited. The menu links to
  them and changes nothing behind them.

## 8. Done means

- `npx tsc --noEmit` clean, both sides.
- `npm test` (backend) and `npx vitest run` (mobile) pass, including the two
  coverage tests that read the route file.
- Built and installed on the device, and the log read rather than the exit code.
