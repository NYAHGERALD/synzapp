NOTE: VERY IMPORTANT: DO NOT BUILD Prototype app here, Start the project very seriously and make it you number 1 priority. do not build basic features, always remember that this is a real world project that must be build professionally and seriously with care and precition, do not assume any thing, without testing. please deal with real data and dont't build everything at once. deal with facts and real data. YOU ARE THE SOFTWARE ENGINEER: THIS APP CAN COMPIT WITH WHATSAPP AND TEAMS IN THAT SAME LEVEL.
I WILL BE THE USER WHO WILL ACT LIKE REAL WORLD USER OF THE APP, BUILD THE APP SETP-BY-STEP AND LET ME TEST EACH FEATURE WITH A REAL UX/UI YOU WILL CREATE. MAKE SURE YOU TEXT FEATURES BEFORE MOVING TO A NEXT SERVICE. 
# Synzapp — Chief Architect-Level Enterprise Architecture Specification

**Version:** 3.1  
**Product Type:** Secure Enterprise Workplace Communication + Operations Platform  
**Target Level:** Mobile-first, end-to-end encrypted WhatsApp-style communication with Teams-level enterprise controls  
**Primary Priority:** Security, tenant isolation, mobile-first privacy, data ownership, auditability, scalability, and simple user experience  

---

# Table of Contents

1. Executive Summary  
2. Product Vision  
3. Strategic Positioning  
4. Architecture Principles  
5. Target Users and Roles  
6. High-Level System Architecture  
7. C4 Architecture Model  
8. Core Technology Stack  
9. Multi-Tenant Architecture  
10. Identity and Authentication Architecture  
11. Organization Onboarding Flow  
12. Employee Registration Flow  
13. Role-Based Access Control  
14. Permission Matrix  
15. Security Architecture  
16. Encryption Architecture  
17. Enterprise Data Protection Model  
18. Chat Architecture  
19. Group and Channel Architecture  
20. Messaging Features  
21. File and Media Architecture  
22. Search Architecture  
23. Notification Architecture  
24. User Lifecycle Management  
25. Admin Portal Architecture  
26. Work Order Architecture  
27. Action Plan Architecture  
28. Announcements Architecture  
29. Audit Logging Architecture  
30. Compliance Architecture  
31. Data Retention Architecture  
32. Backup and Disaster Recovery  
33. Mobile App Architecture  
34. Backend Services Architecture  
35. Firestore Database Architecture  
36. Storage Path Architecture  
37. API Architecture  
38. Event-Driven Architecture  
39. AI Architecture  
40. Threat Model  
41. Security Controls Checklist  
42. Observability and Monitoring  
43. Deployment Architecture  
44. CI/CD Pipeline  
45. Scaling Strategy  
46. Cost and Infrastructure Strategy  
47. MVP Roadmap  
48. Enterprise Roadmap  
49. Final Recommendation  

---

# 1. Executive Summary

Synzapp is an enterprise-grade workplace communication and operations platform designed for companies that need secure internal communication, controlled employee access, real-time chat, file sharing, announcements, work orders, action plans, and future AI-powered operational intelligence.

Synzapp is not designed as a basic chat application. It is designed as a secure company communication system where every organization owns its workspace, controls its users, manages access, protects business data, and converts workplace conversations into structured operational actions.

The chat foundation must be mobile-first and end-to-end encrypted by default. The backend must broker identity, authorization, delivery, device registration, receipts, audit metadata, and encrypted message queues, but it must not become the permanent readable store for human chat content. Delivered chat history should live primarily in an encrypted local database on each authorized device, with server-side ciphertext retained only according to delivery, retention, legal hold, or tenant-controlled encrypted backup policy.

Synzapp should provide a familiar WhatsApp-like chat experience while offering enterprise controls similar to Microsoft Teams, Slack, and Mattermost.

Core objectives:

- Secure phone-based onboarding
- Multi-tenant company separation
- Strong role-based access control
- Real-time messaging
- File attachment storage
- Organization-level user governance
- Admin-controlled access
- Deactivation and deletion workflows
- Work order creation from chat
- Action plan creation from chat
- Search by keyword, date, sender, group, and attachment
- Enterprise audit logging
- Future AI-powered summaries, RCA, translations, and operational intelligence

---

# 2. Product Vision

Synzapp is built for companies that need workplace communication to be simple, secure, and operationally useful.

The product should answer one main question:

**How can a company communicate like WhatsApp, manage teams like Microsoft Teams, control access like an enterprise platform, and turn conversations into real work actions?**

Synzapp should become the communication layer for:

- Manufacturing companies
- Warehouses
- Food production companies
- Healthcare operations
- Logistics companies
- Maintenance teams
- Safety teams
- Quality teams
- Supervisors and managers
- Multi-location businesses

---

# 3. Strategic Positioning

Synzapp should compete by combining the best ideas from major platforms:

## WhatsApp-Inspired

- Simple phone number login
- Familiar chat experience
- Fast messaging
- Media sharing
- Read receipts
- Voice notes
- Reactions
- Mobile-first design

## Slack-Inspired

- Channels and groups
- Searchable conversations
- Workflow integrations
- Threads
- Mentions
- App-like business tools

## Microsoft Teams-Inspired

- Organization control
- Admin governance
- Company-wide announcements
- Department-based access
- Enterprise compliance
- Future meeting and collaboration tools

## Mattermost-Inspired

- Security-conscious architecture
- Enterprise deployment thinking
- Strong admin controls
- Data ownership focus

Synzapp’s strongest advantage should be:

**Secure workplace communication plus built-in operational execution.**

---

# 4. Architecture Principles

## 4.1 Security First

Security is the highest priority. Every design decision must protect company data.

## 4.2 Tenant Isolation

Each company must be fully isolated from every other company.

## 4.3 Least Privilege

Users only access what their role and permissions allow.

## 4.4 Backend-Enforced Rules

The mobile app should never be trusted to enforce security by itself.

## 4.5 Simple User Experience

Enterprise-level security must not make the app difficult to use.

## 4.6 Scalable by Design

The platform must support small companies, large companies, and future multi-location enterprise customers.

## 4.7 Auditable Operations

Admin actions, security events, and business workflows must be logged.

## 4.8 Data Ownership

Company data belongs to the company tenant.

## 4.9 Secure Defaults

The system should be secure by default, not secure only after configuration.

---

# 5. Target Users and Roles

## 5.1 Org Admin

The Org Admin owns and manages the company workspace.

Org Admin can:

- Create company profile
- Add company name
- Add company address
- Upload company logo
- Add users manually
- Add users from phone contacts
- Add employees in batches from contacts
- View all users in the company
- Create departments
- Create roles
- Create groups
- Assign Dept Admins
- Manage permissions
- Send company-wide announcements
- Deactivate users
- Archive users
- Delete or anonymize users
- Manage retention settings
- View audit logs
- Manage company security settings

## 5.2 Dept Admin

A Dept Admin manages a department or assigned area.

Dept Admin can be granted permission to:

- Add employees
- Create department groups
- Send department announcements
- Create work orders
- Create action plans
- View department users
- View department-level activity

Dept Admin permissions must be configurable by Org Admin.

Department Admin assignment is an Org Admin-only action. The backend updates the tenant approved-phone record, global approved-phone lookup, active tenant user profile, identity directory, and Firebase custom claims when the employee has already onboarded. Assignment can also be applied while the employee is still invited, so profile creation uses the approved base role and does not downgrade the employee back to `EMPLOYEE`. A Department Admin remains tied to their company role for profile display, such as `Supervisor - Department Admin`. Department Admin permissions are an Org Admin-configurable overlay that can grant scoped invite, department group, announcement, work order, action plan, and activity permissions. The default Department Admin foundation grants department-scoped employee invite access and department group creation, but it does not grant broad lifecycle authority. Department Admins can see and invite users only inside their assigned department, can create groups only inside their assigned department, and cannot deactivate, archive, delete, or anonymize employee accounts.

Employee company-role assignment is an Org Admin-only action. Changing a company role updates the tenant approved-phone record, global approved-phone lookup, active tenant user profile, identity directory, and Firebase custom claims when the employee has already onboarded. Role changes update company-role permissions immediately while preserving any Department Admin overlay permissions separately. Org Admins can also update the permission bundle attached to a company role. Role-permission updates propagate to invited employees, active user profiles, identity records, global approved-phone lookup records, and active Firebase custom claims. Unsupported admin-only permissions must be rejected by the backend permission catalog. Every role change and role-permission change must be audited.

## 5.3 Employee

Employee can:

- Register only after being approved by the company
- Chat with authorized users
- Join assigned groups
- Send messages
- Send files
- Send images
- Send videos
- Send voice notes
- Search authorized conversations
- Create work orders from chats
- Create action plans from chats
- Receive announcements
- View assigned tasks

## 5.4 System Admin

Internal Synzapp platform administrator.

System Admin can:

- Monitor platform health
- Manage tenant billing status
- Investigate technical incidents
- Suspend abusive tenants
- Access infrastructure logs

System Admin must not casually access company message content. Any support-level access must be controlled, logged, approved, and limited.

---

# 6. High-Level System Architecture

```text
                 ┌──────────────────────────────┐
                 │        iOS Mobile App         │
                 └──────────────┬───────────────┘
                                │
                 ┌──────────────▼───────────────┐
                 │      Android Mobile App       │
                 └──────────────┬───────────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │   API Gateway / BFF   │
                    └──────────┬───────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐      ┌────────────────┐      ┌────────────────┐
│ Firebase Auth │      │ NestJS Backend │      │ Firebase Cloud │
│ Phone OTP     │      │ Business APIs  │      │ Messaging      │
└───────┬───────┘      └───────┬────────┘      └───────┬────────┘
        │                      │                       │
        ▼                      ▼                       ▼
┌───────────────┐      ┌────────────────┐      ┌────────────────┐
│ Firestore     │      │ Cloud Storage  │      │ Cloud Functions│
│ Realtime Data │      │ Files / Media  │      │ Background Jobs│
└───────┬───────┘      └───────┬────────┘      └───────┬────────┘
        │                      │                       │
        └──────────────────────┼───────────────────────┘
                               ▼
                     ┌────────────────────┐
                     │ Monitoring / Logs   │
                     │ Audit / Analytics   │
                     └────────────────────┘
```

---

# 7. C4 Architecture Model

## 7.1 System Context

```text
Users
 ├─ Org Admins
 ├─ Dept Admins
 └─ Employees

Interact with:

Synzapp Platform
 ├─ Mobile App
 ├─ Backend APIs
 ├─ Firebase Auth
 ├─ Firestore
 ├─ Cloud Storage
 ├─ Notifications
 └─ Admin Portal
```

External systems:

- SMS provider through Firebase Auth
- Push notification services
- Future email service
- Future AI service
- Future analytics platform
- Future enterprise identity provider

## 7.2 Container Diagram

```text
Synzapp Mobile App
 ├─ Authentication UI
 ├─ Chat UI
 ├─ File Upload UI
 ├─ Work Order UI
 ├─ Action Plan UI
 └─ Admin UI

Backend API Layer
 ├─ Tenant Service
 ├─ User Service
 ├─ RBAC Service
 ├─ Chat Governance Service
 ├─ Work Order Service
 ├─ Action Plan Service
 ├─ Audit Service
 └─ Notification Service

Firebase Layer
 ├─ Auth
 ├─ Firestore
 ├─ Cloud Storage
 ├─ Cloud Messaging
 └─ Cloud Functions
```

## 7.3 Component Diagram

```text
Mobile App Components
 ├─ Auth Module
 ├─ Tenant Module
 ├─ Chat Module
 ├─ Media Module
 ├─ Search Module
 ├─ Notification Module
 ├─ Work Order Module
 ├─ Action Plan Module
 └─ Admin Module
```

---

# 8. Core Technology Stack

## 8.1 Mobile App

Recommended:

- React Native
- Expo
- TypeScript
- Zustand or Redux Toolkit
- React Navigation
- Firebase SDK
- Expo Contacts
- Expo Notifications
- Expo Document Picker
- Expo Image Picker
- React Native Reanimated

## 8.2 Backend

Recommended:

- NestJS
- TypeScript
- Firebase Admin SDK
- REST APIs first
- GraphQL optional later
- Cloud Run or Render for deployment
- Cloud Functions for Firebase-triggered jobs

## 8.3 Database

Recommended:

- Cloud Firestore for primary app data
- Firestore realtime listeners for encrypted delivery queues, chat metadata, receipts, membership changes, and device state
- Encrypted local mobile database as the primary store for delivered human chat history
- Optional PostgreSQL later for heavy relational reporting workloads, not as a replacement for Firestore operational data
- Optional BigQuery later for analytics, enterprise reporting, and large-scale historical analysis

Important enterprise database position:

Firestore is the primary operational database for Synzapp mobile, the future Synzapp web app, tenant profiles, user profiles, chat control-plane data, encrypted delivery queues, work orders, action plans, Leader Standard Work, Root Cause Analysis metadata, and audit-linked application records.

Firestore must not be treated as the permanent plaintext message database for human chat. For E2EE chat, Firestore stores encrypted message envelopes, delivery metadata, unread counters, receipt summaries, device registrations, and retention timestamps. Delivered message history is stored locally on the user's device in an encrypted database. Backend retention of message ciphertext is temporary unless a tenant explicitly enables a tenant-controlled encrypted retention or legal-hold policy.

PostgreSQL or BigQuery should be added later only when a specific reporting, analytics, BI, or relational query workload requires it. They should not be introduced because Firestore is considered insufficient for enterprise application data. The core application model remains tenant-scoped Firestore, protected by backend authorization and security rules.

## 8.4 File Storage

Recommended:

- Firebase Cloud Storage
- Tenant-based folder paths
- File metadata stored in Firestore
- Encrypted chat attachment blobs for E2EE conversations
- Versioned local device cache for profile photos, thumbnails, and downloaded media
- Virus scanning pipeline before public availability

Chat attachments and sensitive media must be encrypted on device before upload whenever they belong to an E2EE conversation. Cloud Storage may retain encrypted blobs for delivery, backup, or tenant retention policy, but the backend must not require plaintext access to render the chat experience.

## 8.5 Notifications

Recommended:

- Firebase Cloud Messaging
- Notification Service in backend
- User notification preferences

---

# 9. Multi-Tenant Architecture

Synzapp uses a logical multi-tenant SaaS architecture.

Each company is a tenant.

Every important record must include:

```text
tenantId
```

Examples:

```text
organizations/{tenantId}
users/{userId}
groups/{groupId}
messages/{messageId}
workOrders/{workOrderId}
actionPlans/{actionPlanId}
auditLogs/{auditLogId}
```

## 9.1 Tenant Isolation Rule

A user can only access data where:

```text
user.tenantId == resource.tenantId
```

## 9.2 Tenant Boundary Enforcement

Tenant isolation must be enforced in:

- Firebase Auth custom claims
- Firestore Security Rules
- Backend API authorization
- Cloud Storage Rules
- Search indexes
- Notification targeting
- Audit logs

## 9.2.1 Backend Authorization Policy Layer

Backend admin modules must use shared authorization policy helpers before sensitive tenant mutations. These helpers verify active backend session state, active user status, tenant identity, role, permission flag, and Department Admin department scope before the service proceeds.

Policy unit tests must cover cross-tenant denial, inactive or deactivated sessions, Org Admin permission checks, Department Admin same-department access, Department Admin cross-department denial, and employees carrying permission strings without admin role authority.

## 9.3 Tenant Data Ownership

Each organization owns:

- Users
- Groups
- Chats
- Files
- Work orders
- Action plans
- Announcements
- Audit history
- Retention settings

---

# 10. Identity and Authentication Architecture

## 10.1 Authentication Provider

Use Firebase Authentication with phone number verification.

## 10.2 Login Flow

```text
User enters phone number
        ↓
Firebase sends OTP
        ↓
User verifies OTP
        ↓
Firebase returns authenticated user
        ↓
Backend checks tenant membership
        ↓
Backend returns role and permissions
        ↓
User enters app
```

## 10.3 Firebase Custom Claims

Each authenticated user should receive custom claims:

```json
{
  "tenantId": "tenant_123",
  "role": "ORG_ADMIN",
  "status": "ACTIVE"
}
```

## 10.4 Token Refresh

When role or status changes:

- Backend updates custom claims
- User session is refreshed
- Deactivated users are immediately blocked
- Deleted users lose access

## 10.5 Persistent Device Sessions

Synzapp should behave like a modern messaging app after first verification:

- The user verifies by SMS only when needed.
- Firebase Auth persists the signed-in session on the device.
- On app launch, the mobile app restores the Firebase user before showing the login screen.
- The app then calls the backend to verify tenant membership, role, status, permissions, and profile completion.
- If the session is valid and the backend returns an active user, the app opens directly to the product experience.
- If the user signs out, the account is deactivated, the session is revoked, or security policy requires reauthentication, the app returns to phone verification.

This is the WhatsApp-style open-and-chat behavior, with enterprise backend checks added before access is granted.

## 10.6 OTP Abuse Prevention

Phone authentication must not rely only on Firebase default protections.

- Add client-side resend cooldown.
- Add backend rate limits by IP address, device/app attestation, phone number, tenant, and failed verification attempts.
- Add App Check before public release.
- Track OTP send volume and failed verification events in monitoring.
- Use Firebase test phone numbers during development.
- Keep users signed in so normal app opens do not create unnecessary SMS traffic.

---

# 11. Organization Onboarding Flow

## 11.1 Org Admin Creates Company

```text
Phone verification
        ↓
Select Org Admin
        ↓
Enter company name
        ↓
Enter company address
        ↓
Enter Org Admin first and last name
        ↓
Optionally add Org Admin profile photo
        ↓
Create tenant
        ↓
Assign creator as Org Admin
        ↓
Show native success confirmation
        ↓
Open chat screen
```

Company logo upload is managed from company settings after the tenant exists. Logo changes require an active Org Admin session, active registered device, and `tenant.update` permission. The mobile app uses the device-native camera/library picker, compresses the image before upload, stores the object in tenant-scoped Cloud Storage, keeps only the versioned backend URL and storage metadata on the organization record, and writes an admin audit event for every logo update. Org Admin profile photo is optional during onboarding and must use the device-native photo picker on mobile. The first post-profile destination is the chat screen; admin setup links can be added as footer/admin navigation once the core profile flow is stable.

## 11.2 Company Name Rules

To avoid confusion:

- Company name must be searchable
- Company name must never be used as proof of employee access
- Employees must not gain access by typing or guessing an organization name
- Organization name is display and search metadata only
- Employee access requires a backend-approved phone record created by an Org Admin or approved Dept Admin
- A unique organization invite code can exist for support or controlled onboarding, but it must not replace approved-phone authorization

## 11.3 Recommended Tenant Fields

```json
{
  "tenantId": "tenant_123",
  "companyName": "ABC Manufacturing",
  "companyAddress": "123 Main Street",
  "companyLogoUrl": null,
  "status": "ACTIVE",
  "createdBy": "user_123",
  "createdAt": "timestamp",
  "securityMode": "ENTERPRISE_CONTROLLED",
  "retentionPolicy": "3_YEARS"
}
```

## 11.4 Recommended Org Admin User Profile Fields

```json
{
  "tenantId": "tenant_123",
  "firebaseUid": "firebase_uid",
  "firstName": "Jane",
  "lastName": "Smith",
  "displayName": "Jane Smith",
  "phoneHash": "server_hash",
  "phoneLast4": "1494",
  "phoneMasked": "*****1494",
  "role": "ORG_ADMIN",
  "status": "ACTIVE",
  "permissions": ["tenant.read", "tenant.update", "users.manage"],
  "profilePhotoStoragePath": "organizations/tenant_123/users/firebase_uid/profile/profile-photo.jpg",
  "profileComplete": true,
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "lastLoginAt": "timestamp"
}
```

Do not store raw phone numbers in display-facing profile documents. Use hashes for backend lookup, last four digits for display, and encrypted tenant-scoped values only where there is a clear operational need.

---

# 12. Employee Registration Flow

Employees cannot self-join freely.

## 12.1 Secure Rule

No anonymous app user can join an existing company workchat by selecting Employee and entering an organization name.

Employee organization access is always backend-decided from an approved phone record. The client app never decides the employee's tenant, role, department, permissions, or chat access.

## 12.2 Admin Creates Departments and Roles

Before inviting employees, the Org Admin creates:

- Departments
- Roles
- Permission templates
- Optional default chat/group memberships per role or department

Departments and roles are tenant-owned records. Employees can only be assigned to departments and roles that already exist for that tenant.

Initial mobile admin settings:

- Chat footer first tab is Chats
- Chat footer second tab is Employees
- Chat footer last tab is Settings
- Settings allows Org Admins to create tenant departments
- Settings allows Org Admins to create tenant roles
- Settings shows employee-safe account settings, such as My devices and allowed backup controls, without exposing unauthorized admin settings
- My devices uses backend-verified active membership and active registered device checks before listing or revoking a user's own non-current devices
- Department and role writes go through backend APIs and are stored under the tenant root
- Employee invite flow must use the existing tenant departments and roles before selecting phone contacts

Recommended tenant records:

```text
organizations/{tenantId}/departments/{departmentId}
organizations/{tenantId}/roles/{roleId}
```

Department fields:

- departmentId
- tenantId
- name
- slug
- description
- status
- createdBy
- createdAt
- updatedAt

Role fields:

- roleId
- tenantId
- name
- slug
- description
- permissions
- status
- createdBy
- createdAt
- updatedAt

## 12.3 Admin Adds Employees

Org Admin or approved Dept Admin can add one employee manually, add one employee from the device native contact picker, or add employees in batches from a multi-select contact list.

The app should use the device native contact picker and upload only the contacts the admin intentionally selects. Synzapp must not silently upload the admin's full phonebook.

Current mobile implementation supports three approval paths under the same department and role gate: manual E.164 phone entry, one-contact native picker selection, and batch contact import from an explicit multi-select list. Production native builds should prefer a selected-only platform-native multi-select contact picker where supported; if the platform cannot expose one, the batch flow falls back to a controlled app selector or one-by-one native contact selection without silently uploading the full address book.

Batch add flow:

```text
Admin selects department
        ↓
Admin selects role
        ↓
Admin selects one or many phone contacts
        ↓
Backend creates approved employee records
        ↓
Status becomes INVITED or APPROVED
```

Each approved employee record includes:

- Encrypted phone number in the tenant-scoped record
- Phone hash
- Phone last four digits
- Tenant ID
- Department ID
- Role ID
- Optional first name
- Optional last name
- Optional job title
- Optional default chat/group memberships
- Status
- Invited by
- Created at

The phone number becomes approved only for that tenant and only for the assigned department, role, and permissions.

## 12.3.1 Employee Lifecycle Controls

Org Admins with user-management permission can deactivate, archive, or anonymize employee records. Lifecycle actions are not UI-only changes. The backend must update tenant user status, approved phone status, identity-directory status, custom claims, refresh-token revocation, and registered-device revocation so removed employees cannot continue using old sessions or devices.

Lifecycle rules:

- Deactivated employees lose active access and all registered devices are revoked.
- Deactivated or archived employees can be reactivated by an Org Admin with user-management permission.
- Reactivation restores backend access after phone verification, but manually revoked devices remain blocked.
- Archived employees remain blocked from product access and are retained for organizational history.
- Deleted/anonymized employees have personal profile fields removed or replaced with non-identifying placeholders while access remains blocked.
- Backend session verification blocks deactivated, suspended, archived, and deleted users before protected app routes run.
- Realtime chat sessions must check revoked Firebase tokens on authentication and revalidate active device/session status before sending chat updates.
- Employee lifecycle actions are audited.

## 12.4 Employee Joins

```text
Employee opens app
        ↓
Employee enters phone number
        ↓
Firebase OTP verification
        ↓
Backend checks approved phone directory by verified phone hash
        ↓
If approved and status is INVITED or APPROVED
        ↓
Show company confirmation
        ↓
Employee completes profile
        ↓
Backend creates user profile
        ↓
Backend sets tenantId, role, department, status, and permissions
        ↓
Grant tenant-scoped access
```

The company confirmation screen may show:

- Company name
- Org Admin name
- Org Admin or company support phone number

It must not expose private organization data, employee lists, chats, files, or internal metadata.

## 12.5 Employee Profile Completion

Required fields:

- First name
- Last name
- Department confirmation or department selection from backend-approved department options
- Role confirmation or role selection from backend-approved role options

Optional fields:

- Profile photo using the device native photo picker

The safest default is for Org Admin to preassign department and role during invitation. If the employee sees department or role dropdowns, the backend must restrict those choices to values allowed by the approved phone record. Employees must never freely choose a role that elevates their access.

## 12.6 If Phone Number Is Not Approved

Access is denied.

Message:

```text
Your phone number has not been added to this organization. Please contact your company administrator.
```

Do not reveal whether a specific organization name exists, whether a specific phone number belongs to a tenant, or which company records were checked. Avoid account or organization enumeration.

---

# 13. Role-Based Access Control

Synzapp uses RBAC plus permission flags.

## 13.1 Base Roles

```text
ORG_ADMIN
DEPT_ADMIN
EMPLOYEE
SYSTEM_ADMIN
```

## 13.2 Permission Flags

```text
canAddUsers
canDeactivateUsers
canArchiveUsers
canDeleteUsers
canCreateGroups
canManageGroups
canSendAnnouncements
canCreateWorkOrders
canAssignWorkOrders
canCreateActionPlans
canManageDepartment
canViewAuditLogs
canManageCompanySettings
canUploadCompanyLogo
canExportData
```

## 13.3 Authorization Rule

Every backend request must check:

```text
Authenticated user exists
User is active
User belongs to tenant
User has required role or permission
Resource belongs to same tenant
```

---

# 14. Permission Matrix

| Capability | Org Admin | Dept Admin | Employee |
|---|---:|---:|---:|
| View chat interface | Yes | Yes | Yes |
| Send messages | Yes | Yes | Yes |
| Send files | Yes | Yes | Yes |
| Create company | Yes | No | No |
| Edit company profile | Yes | No | No |
| Upload company logo | Yes | No | No |
| Add employees | Yes | Optional | No |
| Deactivate users | Yes | No | No |
| Archive users | Yes | No | No |
| Delete/anonymize users | Yes | No | No |
| Create groups | Yes | Optional | No |
| Manage all groups | Yes | Optional | No |
| Create department group | Yes | Yes | No |
| Send announcements | Yes | Optional | No |
| Assign Dept Admin | Yes | No | No |
| Create work order | Yes | Yes | Yes |
| Assign work order | Yes | Yes | Optional |
| Create action plan | Yes | Yes | Yes |
| View audit logs | Yes | Optional | No |
| Export company data | Yes | No | No |

---

# 15. Security Architecture

Security must be layered.

## 15.1 Security Layers

```text
Device Security
Authentication
Authorization
Tenant Isolation
Encryption
Storage Rules
Audit Logging
Monitoring
Incident Response
Backup Protection
```

## 15.2 Required Security Controls

- Firebase Phone Authentication
- Custom claims
- App Check
- Firestore Security Rules
- Storage Security Rules
- Backend authorization middleware
- Tenant ID validation
- Secure file upload validation
- Rate limiting
- Audit logs
- Admin action confirmation
- Session revocation
- Device logout
- Notification privacy
- Encrypted storage
- Secure backups

## 15.3 Mobile Security Rules

The app should not store sensitive data permanently.

Allowed:

- Short-lived session state
- Cached non-sensitive UI data
- Notification preferences

Not allowed:

- Plain text message database
- Unencrypted files
- Permanent local chat archives
- Hardcoded secrets
- Admin keys
- Firebase service account files

---

# 16. Encryption Architecture

## 16.1 Required Model

For human workplace chat, use:

```text
Mobile-first end-to-end encryption by default
```

This means:

- Message plaintext is created and decrypted only on authorized user devices.
- The mobile app encrypts messages before sending them to the backend.
- The backend stores encrypted message envelopes, not readable message bodies.
- Delivered message history lives primarily in an encrypted local mobile database.
- The backend brokers identity, authorization, membership, delivery, receipts, push notifications, and audit metadata.
- Server-side retention of message ciphertext is temporary unless a tenant-controlled encrypted retention policy is enabled.
- Search over chat content is local-device search unless a tenant explicitly enables a privacy-reviewed encrypted search or client-mediated export workflow.

## 16.2 Device and Key Model

Each signed-in device must have its own registered device identity.

Required backend records:

- User identity and tenant membership.
- Device ID.
- Device public identity key.
- Signed pre-key or equivalent key agreement material.
- One-time pre-key pool or group-key distribution material where the selected protocol requires it.
- Key version.
- Device status: active, revoked, replaced, lost, deactivated.

Private keys must never be sent to the backend. Device private keys must live in platform secure storage or the strongest secure enclave/keychain mechanism available to the React Native runtime.

## 16.3 Message Envelope Model

The backend may store an encrypted envelope similar to:

```json
{
  "messageId": "msg_123",
  "tenantId": "tenant_123",
  "conversationId": "chat_123",
  "senderUid": "user_1",
  "senderDeviceId": "device_a",
  "recipientDeviceIds": ["device_b", "device_c"],
  "ciphertext": "base64_ciphertext",
  "envelopeByRecipientDevice": {
    "device_b": "encrypted_message_key_or_session_payload",
    "device_c": "encrypted_message_key_or_session_payload"
  },
  "algorithm": "protocol_version",
  "keyVersion": 3,
  "serverReceivedAt": "timestamp",
  "expiresAt": "timestamp",
  "deliveredAtByUser": {},
  "readAtByUser": {},
  "status": "QUEUED"
}
```

The backend may validate tenant, sender, conversation membership, rate limits, payload size, retention timestamps, and recipient device list. It must not inspect plaintext content.

## 16.4 Retention and Delivery Rules

- Sent means the encrypted envelope was accepted by the backend delivery queue.
- Delivered means the recipient device or recipient app session received the encrypted envelope.
- Read means the recipient opened the conversation and the device marked the envelope as read.
- Delivered one-to-one message ciphertext should be deleted from the server after delivery acknowledgment and retention grace period.
- Group message ciphertext should be deleted after all eligible recipient devices receive it or after the tenant delivery TTL expires.
- Undelivered encrypted envelopes should expire automatically after tenant policy, such as 30 days.
- Audit records may retain metadata such as sender, recipients, timestamps, conversation ID, and delivery status, but not plaintext message body.
- Tenant legal hold may retain encrypted envelopes only with tenant-controlled keys or a documented enterprise retention mode.

## 16.5 Offline-First Local Storage

The mobile app must maintain an encrypted local database for:

- Delivered chat messages.
- Conversation summaries.
- Local plaintext previews generated after device decryption.
- Profile-photo cache metadata.
- Media download cache metadata.
- Pending outbound encrypted messages.
- Retry queue for network interruptions.

When the network is unavailable, the app should still open, show cached chats, profile photos, and delivered messages, and queue outbound messages locally until connectivity returns.

## 16.6 End-to-End Encrypted Chat Backup and Restore

Synzapp should support encrypted chat backup and restore without turning the backend into a plaintext chat database.

Required model:

- Delivered messages remain encrypted on the user's device for normal app usage.
- If the app restarts, local encrypted chat history must be loaded before any server sync and must not be overwritten by an empty temporary-delivery response.
- If the app is deleted or the user moves to a new device, restore requires a tenant-authorized encrypted backup.
- Encrypted backup is tenant-controlled and defaults to disabled until an Org Admin enables it.
- Org Admins control whether encrypted backups are allowed and whether self-service recovery-key restore is allowed.
- If self-service restore is disabled, restore must go through an admin-approved enterprise recovery workflow before the backend returns backup ciphertext.
- Backup plaintext is created only on an authorized device.
- Backup ciphertext may be stored in Synzapp-managed Cloud Storage or a tenant-approved storage provider.
- Backup encryption keys must be protected by a user-controlled recovery secret, platform passkey, hardware-backed key vault, or tenant-approved enterprise key-management design.
- Durable group history must use device-assisted key grants when an active group member or a newly registered group member device needs access to older encrypted group envelopes.
- Synzapp backend may validate group membership, active device status, envelope ownership, and key-grant routing, but it must not decrypt message bodies or message keys while granting history access.
- Synzapp backend may store backup metadata, version, owner, tenantId, conversation IDs, backup object paths, key version, backup policy, and access state.
- Synzapp backend must not store readable message bodies or unrestricted backup-decryption keys.
- Backup restore is allowed only after phone authentication, backend session verification, tenant membership verification, active user status verification, and active device registration.
- If an employee is removed, suspended, or no longer belongs to the tenant, the backend must stop future backup sync and block restore for that tenant.
- If an org admin closes the tenant account, encrypted backups, encrypted delivery queues, and tenant chat metadata must be deleted or retained only according to a documented legal-hold/export policy.
- Admins can control whether encrypted backups are enabled, backup retention duration, and whether legal hold or enterprise retention mode applies.
- Admins must not gain silent plaintext access to employee chat backups through the normal backup system.

This backup model is different from temporary server delivery. Temporary delivery queues are for routing new encrypted envelopes. Encrypted backups are for authorized recovery after app deletion, device loss, or device replacement.

## 16.7 Enterprise Governance with E2EE

E2EE does not remove enterprise governance. It changes where governance happens.

- Membership, authorization, employee activation, and device revocation stay backend-controlled.
- Admins can remove users, revoke devices, and stop future delivery.
- Search over chat content is local by default.
- AI summaries are disabled for E2EE content unless a tenant-approved client-side or tenant-controlled decryption workflow exists.
- Work orders and RCA records created from chat should store structured operational data separately from chat content and only after explicit user action.
- Compliance export must use tenant-approved policy and should not require Synzapp backend access to plaintext chat.

## 16.8 File and Media Encryption

Files must be:

- Uploaded over HTTPS
- Encrypted on device before upload for E2EE conversations
- Stored encrypted at rest
- Access-controlled by tenant and group membership
- Scanned before being made available
- Removed according to retention policy

For E2EE attachments, malware scanning can only happen before encryption on the sending device, after explicit client-side decryption on an authorized device, or through a separate tenant-approved enterprise inspection mode. The default backend must not decrypt private chat attachments.

For mobile chat, photos and videos are compressed on device before encryption. Documents and other files are not compressed because their business integrity matters more than size reduction. The app encrypts the selected media bytes locally, uploads only ciphertext through a backend-issued temporary signed URL, embeds the media key/nonce and metadata inside the encrypted message payload, and downloads/decrypts the attachment only on authorized recipient devices. The backend stores temporary ciphertext relay metadata and must not store or derive plaintext media.

## 16.9 Transitional Rule

The active direct-message path must use encrypted envelopes, registered device identity, device-only private keys, local encrypted chat storage, local previews after decryption, and temporary backend ciphertext retention. Older plaintext Firestore message documents created during early UX validation are legacy data only and must be removed through an audited cleanup path before production or wider pilot use.

Department channels, announcement chat, media attachments, replies, reactions, search, and AI over chat must not be expanded until the mobile-first E2EE gate is complete.

---

# 17. Enterprise Data Protection Model

## 17.1 Data Classification

Synzapp should classify data as:

```text
Public
Internal
Confidential
Restricted
```

## 17.2 Default Classification

All company chats, files, work orders, and action plans are:

```text
Confidential
```

## 17.3 Restricted Data Examples

- HR documents
- Safety investigation files
- Legal records
- Medical information
- Payroll information
- Sensitive operational reports

## 17.4 Access Control

Restricted data requires:

- Specific permission
- Audit logging
- Optional additional verification

---

# 18. Chat Architecture

## 18.1 Chat Types

```text
DIRECT_MESSAGE
GROUP_CHAT
DEPARTMENT_CHANNEL
ANNOUNCEMENT_CHANNEL
INCIDENT_CHANNEL
PROJECT_CHANNEL
```

## 18.2 Chat Document

Chat documents are conversation metadata and membership records. They must not store plaintext message previews.

```json
{
  "chatId": "chat_123",
  "tenantId": "tenant_123",
  "type": "GROUP_CHAT",
  "name": "Maintenance Team",
  "memberIds": ["user_1", "user_2"],
  "createdBy": "user_1",
  "createdAt": "timestamp",
  "lastEnvelopeId": "msg_123",
  "lastMessageAt": "timestamp",
  "lastMessageSenderId": "user_1",
  "unreadCounts": {
    "user_2": 1
  },
  "encryptionMode": "E2EE",
  "retentionPolicyId": "retention_default",
  "status": "ACTIVE"
}
```

Local plaintext previews are generated on the mobile device after decryption and stored only in the encrypted local database.

## 18.3 Encrypted Message Envelope

Backend message records must be encrypted delivery envelopes, not plaintext chat records.

```json
{
  "messageId": "msg_123",
  "tenantId": "tenant_123",
  "chatId": "chat_123",
  "senderUid": "user_1",
  "senderDeviceId": "device_a",
  "messageType": "TEXT",
  "ciphertext": "base64_ciphertext",
  "envelopeByRecipientDevice": {
    "device_b": "encrypted_session_or_message_key"
  },
  "attachmentEnvelopeIds": [],
  "replyToMessageId": null,
  "mentionUserIds": ["user_2"],
  "clientCreatedAt": "timestamp",
  "serverReceivedAt": "timestamp",
  "expiresAt": "timestamp",
  "deliveredAtByUser": {},
  "readAtByUser": {},
  "status": "QUEUED"
}
```

The backend may store metadata required for routing, authorization, delivery, abuse prevention, and receipts. It must not store a `body` field containing readable chat text.

## 18.4 Local Message Record

After decryption, the mobile app stores the user-readable message locally in an encrypted database:

```json
{
  "messageId": "msg_123",
  "tenantId": "tenant_123",
  "chatId": "chat_123",
  "senderId": "user_1",
  "messageType": "TEXT",
  "body": "The conveyor stopped again.",
  "attachments": [],
  "replyToMessageId": null,
  "mentions": ["user_2"],
  "createdAt": "timestamp",
  "serverReceivedAt": "timestamp",
  "editedAt": null,
  "deletedAt": null,
  "deliveryStatus": "READ",
  "syncState": "SYNCED"
}
```

This record is device-local and encrypted at rest. It is the source for offline chat history, local search, and message previews.

## 18.5 Realtime Updates

Use Firestore realtime listeners or the backend realtime socket for:

- New encrypted message envelopes
- Message update envelopes
- Tombstone/delete metadata
- Reaction metadata or encrypted reaction payloads
- Delivered and read receipts
- Conversation membership updates

Use Realtime Database or Firestore lightweight documents for:

- Typing indicators
- Presence
- Online status

Realtime listeners must subscribe only to active conversations or summary documents. The mobile app must unsubscribe immediately when the user leaves a screen.

## 18.6 Server Retention for Chat Content

- One-to-one encrypted envelopes should be deleted after recipient delivery acknowledgment and a short grace period.
- Durable group encrypted envelopes may be retained as ciphertext for authorized group history according to tenant retention policy.
- Newly eligible group devices must receive history access through encrypted key grants created by an already-authorized member device or a tenant-approved enterprise key workflow.
- Undelivered encrypted envelopes expire automatically.
- Chat summary metadata and receipts may remain for enterprise UX and audit needs.
- Plaintext message content must not remain in backend storage.
- Any legacy plaintext chat documents from transitional testing must be found with a dry-run cleanup first, then deleted through an audited admin maintenance action.

---

# 19. Group and Channel Architecture

## 19.1 Group Types

```text
Department Group
Project Group
Incident Group
Announcement Channel
General Company Channel
Direct Message
```

## 19.2 Group Membership

Group membership must be backend-owned. Custom groups use explicit membership. System-managed department groups use implicit department membership plus explicit external membership exceptions.

Users can only see groups where they are members, where their active department assignment grants implicit membership, or where they are Org Admin.

When a department is created, the backend creates a system-managed department group with the same department name. Active users assigned to that department can see and participate in that department group by default. Org Admins can see all department groups. Department Admins can see their assigned department group and can manage department-group access only inside their authorized department scope.

Only Org Admins and authorized Department Admins can add or remove external employees or external Department Admins from a department group. These external memberships are explicit, auditable, and do not change the employee's primary department assignment.

Group creation is tenant-scoped. Org Admins with group management permission can create company-wide or department groups. Department Admins with group creation permission can create only department groups for their assigned department. Every created group stores tenantId, scope, optional departmentId, creator membership, status, member count, member policy, system-managed flag, and audit metadata.

When a user or device becomes newly eligible for a group after messages already exist, durable group history is unlocked by encrypted key grants. An authorized device that already has access re-encrypts only the historical message keys to the newly eligible active devices. The backend stores those encrypted key copies and never sees plaintext message content or raw message keys.

## 19.3 Announcement Channels

Announcement channels are one-way or controlled-posting channels.

Allowed senders:

- Org Admin
- Dept Admin with permission

Employees can:

- View announcements
- React if enabled
- Confirm acknowledgement if required

---

# 20. Messaging Features

Synzapp should support:

- Text messages
- Images
- Videos
- Documents
- Voice notes
- Replies
- Threads
- Reactions
- Mentions
- Read receipts
- Delivered receipts
- Typing indicators
- Online status
- Message search
- Delete for self
- Delete for everyone based on time rule
- Edit message based on time rule
- Pin messages
- Star messages
- Forward messages
- Create work order from message
- Create action plan from message

## 20.1 Message Edit Rule

Recommended:

```text
Messages can be edited within 15 minutes.
After 15 minutes, edit is disabled.
Edit history is retained.
```

## 20.2 Delete for Everyone Rule

Recommended:

```text
Messages can be deleted for everyone within 15 minutes.
After 15 minutes, only Delete for Me is allowed.
Admin retention rules still preserve audit history where required.
```

---

# 21. File and Media Architecture

## 21.1 Supported File Types

- Images
- Videos
- PDF
- Word
- Excel
- PowerPoint
- Audio
- Text files

## 21.2 Upload Flow

E2EE chat attachment flow:

```text
User selects photo, video, or file
        ↓
App compresses photos/videos only
        ↓
App validates size and media type
        ↓
App encrypts bytes locally with a per-attachment media key
        ↓
Backend authorizes active tenant membership, registered device, and chat participant access
        ↓
Backend issues a short-lived signed URL for temporary ciphertext upload
        ↓
App uploads ciphertext and sends an encrypted message payload containing media metadata, key, and nonce
        ↓
Recipient device downloads ciphertext with a short-lived authorized URL, decrypts locally, and stores the local copy
```

Non-E2EE workflow file flow:

```text
User selects file
        ↓
App validates file type and size
        ↓
File uploads to temporary storage path
        ↓
Backend scans file
        ↓
If safe, file moves to final storage path
        ↓
Message attachment metadata is created
```

## 21.3 Storage Path

E2EE chat attachment temporary relay path:

```text
tenants/{tenantId}/chats/{chatId}/messageEnvelopes/pending/encryptedAttachments/{mediaId}
```

Non-E2EE workflow attachment final path:

```text
tenants/{tenantId}/chats/{chatId}/messages/{messageId}/attachments/{fileId}
```

## 21.4 File Metadata

```json
{
  "fileId": "file_123",
  "tenantId": "tenant_123",
  "chatId": "chat_123",
  "messageId": "msg_123",
  "uploadedBy": "user_123",
  "fileName": "inspection.pdf",
  "fileType": "application/pdf",
  "fileSize": 204800,
  "storagePath": "tenants/tenant_123/chats/chat_123/messages/msg_123/attachments/file_123",
  "scanStatus": "CLEAN",
  "createdAt": "timestamp"
}
```

## 21.5 File Security

- Maximum file size limits
- File type allowlist
- Virus scanning
- Malware scanning
- Tenant path isolation
- Signed URL expiration
- No public file URLs
- Audit file downloads

---

# 22. Search Architecture

## 22.1 Search Requirements

Users must search by:

- Keyword
- Date
- Sender
- Group
- Department
- File type
- Work order
- Action plan
- Announcement

## 22.2 Search Security

Search results must be scoped by:

```text
tenantId
userId
role
group membership
department permissions
```

## 22.3 Recommended Search Model

MVP:

- Firestore indexed fields
- Search by date, sender, group, and message type
- Server search may only index metadata and non-E2EE workflow records the requester is authorized to access.
- Every search query must include tenantId from the verified session, never from untrusted client input.
- Department Admin search must add department scope when searching department-governed records.
- Chat message plaintext search is local-device search unless a tenant-approved encrypted search design is implemented.

Enterprise version:

- Dedicated search service
- Tenant-scoped indexing
- Permission-aware query filtering
- Audit search activity
- Index documents must store tenantId, resource type, resource id, allowed user ids or group ids where applicable, department id where applicable, status, and retention metadata.
- Search results must be filtered by tenant, active membership, role, permission, department scope, and group membership before being returned.

## 22.4 Search and E2EE Chat

E2EE chat content supports local client-side search by default. Server-side search over human chat content is not allowed unless Synzapp implements a tenant-approved encrypted search index or a client-mediated search/export workflow where plaintext remains on authorized devices or tenant-controlled infrastructure.

---

# 23. Notification Architecture

## 23.1 Notification Types

- New message
- Mention
- Reply
- Group invite
- Announcement
- Work order assigned
- Work order overdue
- Action plan assigned
- Action plan overdue
- Role change
- Deactivation notice

## 23.2 Notification Privacy

Notification previews should be configurable.

Options:

```text
Show full message
Show sender only
Show generic notification
```

Recommended default:

```text
New message in Maintenance Team
```

Do not expose sensitive message content on locked screens by default.

## 23.3 Notification Service

Notification service responsibilities:

- Resolve recipients
- Check user preferences
- Check quiet hours
- Enforce tenant boundary
- Send FCM notification
- Log delivery status

## 23.4 Tenant-Scoped Notification Rules

Notification recipient resolution must run on the backend from tenant-owned membership records. The client may request a notification-triggering action, but it must not provide trusted recipient tenantId, role, department, group membership, or device token targets.

Every notification job must store:

- tenantId
- triggering resource id
- notification type
- resolved recipient user ids
- delivery status
- createdBy
- createdAt

Default push content must be private. For E2EE chat, push notifications must not include decrypted message text because the backend cannot read the plaintext. The default copy should identify the tenant-safe context only, such as "New message" or "New message in a work chat."

---

# 24. User Lifecycle Management

## 24.1 Invited

Phone number added but user has not registered.

## 24.2 Active

User has full authorized access.

## 24.3 Deactivated

User cannot log in.

Data remains.

## 24.4 Archived

User no longer works for the company.

Data remains for business records.

## 24.5 Deleted / Anonymized

Personal information removed.

Historical business records remain as:

```text
Former Employee
```

## 24.6 Why Not Hard Delete Everything?

Companies often need historical data for:

- Safety investigations
- Quality investigations
- HR review
- Operational accountability
- Legal protection
- Compliance

Therefore, deletion should remove access and personal profile information, but business records should remain in anonymized form.

---

# 25. Admin Portal Architecture

## 25.1 Admin Portal Features

Org Admin dashboard:

- Company profile
- Company logo
- User management
- Department management
- Group management
- Role management
- Permissions
- Announcements
- Work orders
- Action plans
- Audit logs
- Security settings
- Retention settings

## 25.2 Recommended Admin Portal Stack

- React or Next.js
- TypeScript
- Tailwind CSS
- Firebase Auth
- Backend API
- Role-based page protection

## 25.3 Admin Safety

Sensitive admin actions require confirmation:

- Deactivate user
- Delete user
- Promote user
- Export data
- Change retention policy
- Change security mode

---

# 26. Work Order Architecture

## 26.1 Work Order Purpose

Work orders convert chat conversations into trackable operational tasks.

## 26.2 Create Work Order from Chat

```text
Long press message
        ↓
Select Create Work Order
        ↓
Pre-fill description from message
        ↓
Assign user or department
        ↓
Set priority and due date
        ↓
Save work order
        ↓
Notify assigned user
```

## 26.3 Work Order Fields

```json
{
  "workOrderId": "wo_123",
  "tenantId": "tenant_123",
  "sourceChatId": "chat_123",
  "sourceMessageId": "msg_123",
  "title": "Fix conveyor issue",
  "description": "The conveyor stopped again.",
  "priority": "HIGH",
  "status": "OPEN",
  "createdBy": "user_1",
  "assignedTo": "user_2",
  "dueDate": "timestamp",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## 26.4 Statuses

```text
OPEN
IN_PROGRESS
ON_HOLD
COMPLETED
CANCELLED
```

---

# 27. Action Plan Architecture

## 27.1 Purpose

Action plans allow teams to create structured follow-up tasks from conversations.

## 27.2 Action Plan Fields

```json
{
  "actionPlanId": "ap_123",
  "tenantId": "tenant_123",
  "title": "Reduce flour dust issue",
  "description": "Follow up on flour dust under oven.",
  "ownerId": "user_1",
  "sourceChatId": "chat_123",
  "sourceMessageId": "msg_123",
  "status": "OPEN",
  "tasks": [
    {
      "taskId": "task_1",
      "title": "Inspect dust tray",
      "assignedTo": "user_2",
      "dueDate": "timestamp",
      "status": "OPEN"
    }
  ],
  "createdAt": "timestamp"
}
```

## 27.3 Statuses

```text
OPEN
IN_PROGRESS
COMPLETED
BLOCKED
CANCELLED
```

---

# 28. Announcements Architecture

## 28.1 Announcement Types

- Company-wide
- Department
- Safety
- Quality
- HR
- Maintenance
- Emergency

## 28.2 Announcement Fields

```json
{
  "announcementId": "ann_123",
  "tenantId": "tenant_123",
  "title": "Safety Stand Down",
  "body": "Meeting at 10 AM.",
  "targetAudience": "ALL_USERS",
  "createdBy": "user_1",
  "requiresAcknowledgement": true,
  "createdAt": "timestamp"
}
```

## 28.3 Acknowledgement Tracking

If required, track:

```text
Seen
Acknowledged
Not Acknowledged
```

---

# 29. Audit Logging Architecture

## 29.1 Audit Events

Track:

- Login
- Logout
- Failed login
- User invited
- User registered
- User deactivated
- User archived
- User deleted/anonymized
- Role changed
- Permission changed
- Group created
- Group deleted
- Announcement sent
- Work order created
- Action plan created
- File uploaded
- File downloaded
- Data exported
- Security setting changed

## 29.2 Audit Log Fields

```json
{
  "auditLogId": "audit_123",
  "tenantId": "tenant_123",
  "actorUserId": "user_1",
  "action": "USER_DEACTIVATED",
  "targetType": "USER",
  "targetId": "user_2",
  "ipAddress": "masked_or_recorded",
  "deviceInfo": "iPhone",
  "createdAt": "timestamp",
  "metadata": {}
}
```

## 29.3 Audit Rules

- Users cannot edit audit logs
- Users cannot delete audit logs
- Audit logs must be retained based on tenant policy
- Security events should be retained longer than normal chat data

---

# 30. Compliance Architecture

Synzapp should be built toward:

- SOC 2 readiness
- GDPR readiness
- CCPA readiness
- Enterprise data retention readiness
- Optional HIPAA-ready architecture for future healthcare customers

## 30.1 Compliance Features

- Tenant data isolation
- Audit logs
- Role-based permissions
- Data export
- Data retention
- User deactivation
- User anonymization
- Secure backups
- Encryption at rest
- Encryption in transit
- Admin access logs

---

# 31. Data Retention Architecture

## 31.1 Retention Options

Organizations can choose:

```text
1 Year
3 Years
5 Years
7 Years
Forever
```

## 31.2 Retention Applies To

- Messages
- Files
- Work orders
- Action plans
- Announcements
- Audit logs

## 31.3 Legal Hold

Future enterprise feature:

If legal hold is enabled, selected data cannot be deleted until hold is removed.

---

# 32. Backup and Disaster Recovery

## 32.1 Backup Requirements

- Daily backups
- Firestore export
- Cloud Storage backup
- Audit log backup
- Configuration backup

## 32.2 Disaster Recovery Goals

Recommended targets:

```text
RPO: 24 hours for MVP
RTO: 4 hours for MVP
```

Enterprise target later:

```text
RPO: 1 hour
RTO: 1 hour
```

## 32.3 Recovery Testing

Backups are not enough.

The team must test restore procedures regularly.

---

# 33. Mobile App Architecture

## 33.1 Mobile Modules

```text
Auth Module
Tenant Module
Chat Module
Media Module
Search Module
Notification Module
Work Order Module
Action Plan Module
Admin Module
Settings Module
```

## 33.2 Mobile Security

- Do not store sensitive content in plain text
- Use secure storage for auth tokens, device private keys, and local database encryption keys
- Store delivered chat history in an encrypted local database
- Generate message previews locally after decryption
- Cache profile photos, thumbnails, and downloaded media locally with versioned cache keys
- Open cached chats and profile photos when offline
- Queue outbound encrypted messages locally when the network is unavailable
- Clear temporary files
- Validate file uploads
- Enforce app lock optional later
- Disable screenshots optional for restricted data

## 33.3 Mobile UX

Synzapp should feel modern and familiar.

Core UX expectations:

- Fast chat opening
- Smooth scrolling
- Clear unread badges
- Simple group list
- Easy file sharing
- Long press actions
- Swipe reply
- Search bar
- Voice note button
- Camera shortcut
- Work order shortcut
- Action plan shortcut

---

# 34. Backend Services Architecture

## 34.1 Recommended Services

```text
Tenant Service
User Service
Auth Validation Service
RBAC Service
Chat Service
Group Service
File Service
Search Service
Notification Service
Work Order Service
Action Plan Service
Announcement Service
Audit Service
Retention Service
AI Service
```

## 34.2 Backend Responsibilities

The backend owns:

- Tenant creation
- User approval
- Role assignment
- Permission checks
- Audit logging
- Work order logic
- Action plan logic
- Search filtering
- Notification routing
- Data export
- Admin operations

---

# 35. Firestore Database Architecture

## 35.1 Recommended Collections

```text
organizations
identityDirectory
approvedPhoneDirectory
users
approvedPhones
departments
groups
chats
messageEnvelopes
files
announcements
workOrders
actionPlans
auditLogs
notificationPreferences
devices
deviceKeys
receiptSummaries
```

## 35.2 Recommended Tenant-Scoped Structure

```text
organizations/{tenantId}
organizations/{tenantId}/users/{userId}
organizations/{tenantId}/approvedPhones/{phoneId}
organizations/{tenantId}/departments/{departmentId}
organizations/{tenantId}/roles/{roleId}
organizations/{tenantId}/groups/{groupId}
organizations/{tenantId}/chats/{chatId}
organizations/{tenantId}/chats/{chatId}/messageEnvelopes/{messageId}
organizations/{tenantId}/chats/{chatId}/receiptSummaries/{receiptId}
organizations/{tenantId}/users/{userId}/devices/{deviceId}
organizations/{tenantId}/files/{fileId}
organizations/{tenantId}/workOrders/{workOrderId}
organizations/{tenantId}/actionPlans/{actionPlanId}
organizations/{tenantId}/announcements/{announcementId}
organizations/{tenantId}/auditLogs/{auditLogId}
```

## 35.3 Authentication Directory Structure

The backend needs deterministic lookup documents during login before the full product experience opens.

```text
identityDirectory/{firebaseUid}
approvedPhoneDirectory/{phoneHash}
auditLogs/{auditLogId}
organizations/{tenantId}/auditLogs/{auditLogId}
```

`identityDirectory/{firebaseUid}` is the global backend lookup for a verified Firebase user. It stores only the minimum routing and authorization fields needed for login:

- `tenantId`
- `role`
- `status`
- `permissions`
- `profileComplete`
- `claimsVersion`
- `phoneLast4`
- `authRevokedAt`

`approvedPhoneDirectory/{phoneHash}` is the global backend lookup for approved employee phone numbers. It stores a hash of the E.164 phone number, not the raw phone number, and maps invited users to tenant, department, role, status, and permissions.

Approved phone directory fields:

- `tenantId`
- `approvedPhoneId`
- `phoneHash`
- `phoneLast4`
- `departmentId`
- `roleId`
- `permissions`
- `allowedDepartmentIds`
- `allowedRoleIds`
- `defaultChatIds`
- `status`
- `invitedBy`
- `createdAt`
- `expiresAt`
- `claimedByUid`
- `claimedAt`

Tenant-scoped approved phone fields under `organizations/{tenantId}/approvedPhones/{phoneId}` should include the same authorization fields plus display-safe contact metadata imported from the admin's phonebook when available.

Tenant-owned profile data still lives under `organizations/{tenantId}`. These directory documents exist to make login, session restore, employee invitation checks, custom claims, and revocation efficient without scanning tenant collections.

Chat content storage note:

- `messageEnvelopes` store ciphertext and routing metadata only.
- Local decrypted messages live in the mobile app encrypted local database, not in Firestore.
- Firestore chat summary documents must not store plaintext previews.
- Device key documents store public key material and device status only, never private keys.
- Transitional `messages` collections from early UX validation must be migrated to `messageEnvelopes` before more chat features are expanded.

## 35.4 Why Tenant-Scoped Collections?

Benefits:

- Easier security rules
- Stronger organization isolation
- Easier data export
- Easier deletion/anonymization
- Easier retention policies

---

# 36. Storage Path Architecture

## 36.1 Company Logo

```text
organizations/{tenantId}/company/logo/company-logo.{ext}
```

## 36.2 Chat Attachments

```text
tenants/{tenantId}/chats/{chatId}/messageEnvelopes/{messageId}/encryptedAttachments/{fileId}
```

Chat attachment objects must be encrypted before upload for E2EE conversations. Firestore stores attachment metadata and encrypted-key routing data; Cloud Storage stores the encrypted blob.

The active mobile direct-message implementation uses a temporary pending path while the encrypted media is relayed to authorized devices:

```text
tenants/{tenantId}/chats/{chatId}/messageEnvelopes/pending/encryptedAttachments/{mediaId}
```

The attachment key and nonce are carried only inside the encrypted message payload. The backend-issued upload and download URLs must expire quickly and require an active Firebase session, App Check path, active registered device identity, and participant authorization.

## 36.3 Work Order Attachments

```text
tenants/{tenantId}/workOrders/{workOrderId}/attachments/{fileId}
```

## 36.4 Action Plan Attachments

```text
tenants/{tenantId}/actionPlans/{actionPlanId}/attachments/{fileId}
```

## 36.5 Storage Rule

Users can only access files where:

```text
user.tenantId == path.tenantId
```

and the user has access to the related chat, work order, or action plan.

---

# 37. API Architecture

## 37.1 API Style

Recommended for MVP:

```text
REST API
```

Possible future:

```text
GraphQL for complex dashboards
```

## 37.2 Core API Groups

```text
/auth
/tenants
/users
/departments
/groups
/chats
/messages
/files
/work-orders
/action-plans
/announcements
/audit
/search
/notifications
```

## 37.3 API Security

Every API request must validate:

- Firebase ID token
- User status
- Tenant ID
- Role
- Permission
- Resource ownership

---

# 38. Event-Driven Architecture

## 38.1 Events

Events should be emitted for important actions:

```text
UserInvited
UserRegistered
UserDeactivated
MessageCreated
FileUploaded
WorkOrderCreated
ActionPlanCreated
AnnouncementSent
RoleChanged
```

## 38.2 Event Consumers

Consumers may include:

- Notification Service
- Audit Service
- Search Indexer
- AI Service
- Analytics Service

## 38.3 MVP Implementation

For MVP, use Cloud Functions triggered by Firestore changes.

Later, introduce Pub/Sub or queue-based architecture.

---

# 39. AI Architecture

AI should be isolated from the main chat system.

## 39.1 AI Services

Future AI modules:

- Chat summary
- Meeting summary
- Translation
- Work order suggestions
- Action plan suggestions
- RCA generator
- 5 Why analysis
- Fishbone diagram builder
- Safety trend detection
- Knowledge search

## 39.2 AI Security Rules

AI can only process data when:

- Tenant has AI enabled
- User has permission
- Data belongs to tenant
- Human E2EE chat content is processed only through client-side, tenant-controlled, or explicitly approved decryption workflows
- Processing is logged

## 39.3 AI Audit

Track:

- Who used AI
- What data source was used
- What output was generated
- When it happened

---

# 40. Threat Model

## 40.1 Main Threats

| Threat | Risk | Control |
|---|---|---|
| User accesses another company | Critical | Tenant isolation |
| Deactivated user keeps access | Critical | Token revocation |
| Admin abuse | High | Audit logs |
| File malware | High | File scanning |
| Phone number takeover | High | MFA options later |
| Data leak from notifications | Medium | Private notification default |
| Insecure local storage | High | No plain text storage |
| Broken security rules | Critical | Automated rule tests |
| Lost phone | Medium | Remote logout |
| Insider support abuse | High | Support access logging |

## 40.2 Security Testing

Required:

- Firestore rule tests
- Storage rule tests
- API authorization tests
- Shared authorization policy unit tests for tenant, role, permission, status, and Department Admin scope
- Penetration testing before enterprise launch
- Dependency scanning
- Mobile security review

---

# 41. Security Controls Checklist

## Authentication

- Phone OTP
- Token validation
- Session revocation
- Device tracking

## Authorization

- RBAC
- Permission flags
- Tenant validation
- Resource ownership checks

## Data Protection

- TLS
- Encryption at rest
- Secure file storage
- No public file URLs

## Admin Controls

- Audit logs
- Confirmation dialogs
- Role change tracking
- Data export logging

## Mobile Controls

- No hardcoded secrets
- No plain text message storage
- Clear temporary files
- Secure token storage

## Infrastructure Controls

- Environment variables
- Secret management
- Backup protection
- Monitoring
- Alerting

---

# 42. Observability and Monitoring

## 42.1 Monitor

- App crashes
- API errors
- Login failures
- Message delivery delays
- File upload failures
- Notification failures
- Security rule denials
- Suspicious access attempts
- Backend latency

## 42.2 Tools

- Firebase Crashlytics
- Cloud Logging
- Cloud Monitoring
- Error tracking tool
- Uptime monitoring

## 42.3 Alerts

Trigger alerts for:

- High failed login rate
- Cross-tenant access attempt
- Storage rule failure spike
- Backend error spike
- Notification failure spike
- Database cost spike

---

# 43. Deployment Architecture

## 43.1 Environments

```text
Development
Staging
Production
```

## 43.2 Environment Separation

Each environment should have:

- Separate Firebase project
- Separate database
- Separate storage bucket
- Separate API keys
- Separate secrets

## 43.3 Production Deployment

```text
Mobile App
        ↓
API Gateway
        ↓
Backend Services
        ↓
Firebase Services
        ↓
Monitoring and Audit
```

---

# 44. CI/CD Pipeline

## 44.1 Pipeline Steps

- Install dependencies
- Run linting
- Run unit tests
- Run integration tests
- Run security rule tests
- Run mobile build
- Deploy to staging
- Manual approval
- Deploy to production

## 44.2 Required Checks

- No secrets committed
- TypeScript builds successfully
- Tests pass
- Security rules pass
- Dependency vulnerabilities reviewed

---

# 45. Scaling Strategy

## 45.1 Scale Stages

### Stage 1: MVP

Target:

```text
1 to 10 organizations
100 to 1,000 users
```

### Stage 2: Early SaaS

Target:

```text
50 to 500 organizations
10,000 to 50,000 users
```

### Stage 3: Enterprise SaaS

Target:

```text
1,000+ organizations
100,000+ users
```

## 45.2 Scaling Rules

- Paginate chat messages
- Never load entire chat history
- Store files in Cloud Storage
- Use locally generated message previews for chat list
- Use indexes carefully
- Archive old data
- Monitor database reads
- Cache user profiles
- Use background jobs for heavy work

---

# 46. Cost and Infrastructure Strategy

## 46.1 Cost Drivers

Main cost drivers:

- Firestore reads
- Storage bandwidth
- File uploads
- Push notifications
- Cloud Functions
- Search indexing
- AI processing

## 46.2 Cost Control

- Paginate messages
- Limit attachment size
- Compress images and videos
- Use thumbnails
- Cache profile data
- Batch writes
- Limit real-time listeners
- Archive old conversations

---

# 47. MVP Roadmap

## Phase 1: Foundation

- Firebase project
- Phone authentication
- Tenant creation
- User profiles
- Org Admin setup
- Employee approved phone flow

## Phase 2: Chat Core

- Mobile-first E2EE foundation
- Device key registration
- Encrypted local message database
- Encrypted delivery envelopes
- Temporary server-side ciphertext retention
- Offline cached chat history
- Direct messages
- Group messages
- Chat list
- Read receipts
- Typing indicators
- Reactions
- Replies

## Phase 3: Admin Controls

- Add users
- Manage users
- Deactivate users
- Create groups
- Assign Dept Admin
- Upload company logo

## Phase 4: Files and Notifications

- File upload
- Image sharing
- Video sharing
- Document sharing
- Push notifications

## Phase 5: Workflows

- Work orders from chat
- Action plans from chat
- Announcements
- Basic search

## Phase 6: Security Hardening

- Audit logs
- App Check
- Storage rules
- Security rule tests
- Backup policy
- Monitoring

---

# 48. Enterprise Roadmap

## Version 1.0

- Mobile apps
- Secure auth
- Multi-tenant chat
- Admin controls
- Files
- Work orders
- Action plans

## Version 2.0

- Web admin portal
- Advanced search
- Analytics
- Advanced notifications
- Data export

## Version 3.0

- AI summaries
- Translation
- RCA
- Fishbone diagrams
- 5 Why analysis
- Enterprise reporting

## Version 4.0

- Voice calls
- Video calls
- Integrations
- SSO
- SOC 2 readiness
- Enterprise compliance dashboard

---

# 49. Final Recommendation

Synzapp should be built as a secure enterprise communication and operations platform, not just a workplace chat app.

The best architecture is:

```text
React Native Mobile App
        ↓
Encrypted Local Database + Device Key Store
        ↓
Firebase Authentication
        ↓
NestJS Backend API
        ↓
Firestore Encrypted Delivery Queues + Metadata
        ↓
Firebase Cloud Storage Encrypted Media Blobs
        ↓
Firebase Cloud Messaging
        ↓
Audit, Monitoring, Search, AI, and Workflow Services
```

The most important architectural decisions are:

1. Use tenantId everywhere.
2. Enforce all permissions on the backend.
3. Use Firebase Auth for phone verification.
4. Make human chat mobile-first and end-to-end encrypted by default.
5. Use an encrypted local mobile database as the source of delivered chat history.
6. Use Firestore for encrypted message delivery queues, chat metadata, receipts, device state, and tenant control-plane records.
7. Use Cloud Storage for encrypted attachment blobs and profile/media assets.
8. Use strong RBAC and permission flags.
9. Keep audit logs for all admin and security events.
10. Do not allow employees to self-join without admin approval.
11. Keep plaintext chat content out of backend storage.
12. Design search and AI around local decryption, tenant permissions, and explicit tenant-approved workflows.
13. Build work orders and action plans as first-class modules.

This architecture gives Synzapp a strong foundation to grow toward the level of Microsoft Teams, Slack, Mattermost, and WhatsApp-style communication while staying simple, secure, and enterprise-ready.
