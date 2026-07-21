Here is the highly granular, step-by-step breakdown for **Phase 1**. This is designed to act as a strict instruction manual for an AI coding agent, leaving no room for assumptions.

Copy the block below into your document. Let me know when you are ready, and I will generate Phase 2.

---

### Phase 1: Foundation & Multi-Tenant Isolation (Actionable AI Checklist)

**Objective:** Establish the unbreachable Firebase security perimeter, initialize custom authentication claims, and construct the precise NoSQL hierarchical document schema.

**AI Implementation Instructions:** Execute the following tasks sequentially. Do not proceed to the next step until the current step is fully implemented and validated.

**Implementation Progress Note:** Synzapp's existing tenant root is `organizations/{tenantId}`, so the implemented RCA hierarchy is `organizations/{tenantId}/rcaIncidents/{incidentId}/rcaSessions/{sessionId}/nodes/{nodeId}`. This preserves the requested tenant isolation and incident -> session -> node graph model while matching the current production data model.

#### 1. Authentication & Custom Claims Setup

* [ ] **Task 1.1:** Implement a Firebase Cloud Function (`onCreate` user trigger) to assign a custom claim of `tenantId` to every authenticated user upon registration or invitation.
* [x] **Task 1.2:** Ensure the frontend authentication flow forces a token refresh immediately after sign-in so the `tenantId` claim is active on the client side before any Firestore queries are executed.
* [x] **Task 1.3:** Create a TypeScript interface for the custom user object to ensure strict typing across the frontend (e.g., `interface AppUser extends firebase.User { tenantId: string; role: string }`).

#### 2. Firestore Security Rules (Strict Isolation)

* [x] **Task 2.1:** Write the base Firestore Security Rules ensuring that **no global read/write access exists** (`allow read, write: if false;` at the root).
* [x] **Task 2.2:** Implement a helper function in the security rules: `function isTenant(tenantId) { return request.auth != null && request.auth.token.tenantId == tenantId; }`.
* [x] **Task 2.3:** Apply the `isTenant(tenantId)` rule to the root `Tenants/{tenantId}` path and explicitly cascade this rule down to all subcollections (Incidents, RcaSessions, Nodes).
* [x] **Task 2.4:** Write a validation rule ensuring that any `create` operation strictly includes `tenantId: request.auth.token.tenantId` in the document payload to prevent spoofing.

#### 3. NoSQL Schema & TypeScript Interfaces Implementation

* [x] **Task 3.1:** Define the exact subcollection routing in the application's API layer: `Tenants/{tenantId}/Incidents/{incidentId}/RcaSessions/{sessionId}/Nodes/{nodeId}`.
* [x] **Task 3.2:** Define the `Incident` TypeScript Interface. Required fields: `id` (string), `title` (string), `status` (enum: OPEN, INVESTIGATING, CLOSED), `assetId` (string), `riskScore` (number), `createdAt` (Firestore Timestamp), `createdBy` (string/userId).
* [x] **Task 3.3:** Define the `RcaSession` TypeScript Interface. Required fields: `id` (string), `incidentId` (string), `status` (enum: ACTIVE, FREEZE, COMPLETED), `leadInvestigatorId` (string).

#### 4. The Polymorphic "Node" Document Structure

* [x] **Task 4.1:** Define the `Node` TypeScript Interface. This is critical for the graph architecture. Required fields:
* `id` (string)
* `nodeType` (enum: 'WHY', 'ISHIKAWA_CATEGORY', 'CAUSE', 'SUB_CAUSE', 'FAULT_GATE')
* `label` (string) - The text entered by the user.
* `parentNodeId` (string | null) - Null if it is a root node, otherwise holds the ID of the parent node to create infinite nesting.
* `isRootCause` (boolean) - Default false.


* [x] **Task 4.2:** Implement the UI positioning object within the `Node` interface: `uiCoordinates: { x: number, y: number, layoutMethodology: string }`.
* [x] **Task 4.3:** Create a frontend service file (`RcaNodeService.ts`) with dedicated methods to fetch nodes by `sessionId` and reconstruct the flat NoSQL array into a recursive hierarchical tree structure for the React/Vue components to render.

---

### Phase 2: Ingestion & Dynamic Triage (Actionable AI Checklist)

**Objective:** Build the automated entry points for anomalies (from plant floors, SCADA, WMS) and implement the background logic to automatically calculate risk scores and trigger investigations.

**AI Implementation Instructions:** Execute the following tasks sequentially. Ensure all Cloud Functions are deployed and tested against the Firestore security rules established in Phase 1 before moving to Phase 3.

#### 1. Ingestion Webhook Cloud Function (REST API)

* [ ] **Task 1.1:** Create an HTTP-triggered Cloud Function (e.g., `ingestIncidentPayload`) to act as the primary webhook receiver for external systems.
* [ ] **Task 1.2:** Implement payload validation within the function. It must verify the presence of an API Key/Auth Token mapping to a specific `tenantId`, along with `assetId`, `title`, and `riskFactors` (Severity, Occurrence, Detection).
* [ ] **Task 1.3:** Write the authenticated payload to the database path: `Tenants/{tenantId}/Incidents/{newIncidentId}` with an initial status of `OPEN`.

#### 2. Idempotency & Deduplication Guard

* [ ] **Task 2.1:** Before the `ingestIncidentPayload` function writes a new incident, query the `Tenants/{tenantId}/Incidents` collection for any document where `assetId` matches the incoming payload AND `status` is NOT `CLOSED`.
* [ ] **Task 2.2:** Filter the query results by a 24-hour timestamp window (`createdAt >= timestamp - 24 hours`).
* [ ] **Task 2.3:** If a match is found, DO NOT create a new incident. Instead, log the incoming event into a subcollection of the existing incident: `Tenants/{tenantId}/Incidents/{existingIncidentId}/TelemetryLogs` to bundle the data.

#### 3. Automated Risk Priority Number (RPN) Trigger

**Implementation Progress Note:** RPN calculation and automatic RCA session creation are implemented in the authenticated Synzapp backend incident creation route. The Firestore `onDocumentCreated` Cloud Function itself is still open as Task 3.1.

* [ ] **Task 3.1:** Create a Firestore background trigger (`onDocumentCreated`) listening to the path: `Tenants/{tenantId}/Incidents/{incidentId}`.
* [x] **Task 3.2:** In this trigger, extract the `severity`, `occurrence`, and `detection` values (all integers 1-10) from the new incident document. Calculate the RPN: `const rpn = severity * occurrence * detection;`.
* [x] **Task 3.3:** Update the triggering `Incident` document with the calculated `rpnScore`.
* [x] **Task 3.4:** Implement the escalation threshold logic: If `rpnScore >= 25`, automatically generate a new document in the `RcaSessions` subcollection: `Tenants/{tenantId}/Incidents/{incidentId}/RcaSessions/{newSessionId}`.
* [x] **Task 3.5:** Set the newly created RCA Session status to `ACTIVE` and update the parent Incident status from `OPEN` to `INVESTIGATING`.

---

### Phase 3: The Real-Time Collaborative Canvas (Actionable AI Checklist)

**Objective:** Develop the interactive workspace utilizing Firestore's real-time capabilities to create a multi-user board where users can seamlessly map out incident logic without stepping on each other's toes.

**AI Implementation Instructions:** Execute the following tasks sequentially to build out the core differentiating feature of the application.

#### 1. Real-Time Sync Engine (`onSnapshot`)

* [ ] **Task 1.1:** Build a dedicated state management hook/composable (e.g., `useRcaSessionNodes`) that attaches a Firestore `onSnapshot` listener to the specific session path: `Tenants/{tenantId}/Incidents/{incidentId}/RcaSessions/{sessionId}/Nodes`.
* [ ] **Task 1.2:** Ensure the listener parses the `added`, `modified`, and `removed` document changes to update the local UI state instantly. This guarantees that when an engineer drags a node on their screen, the coordinates update globally for all viewers.
* [ ] **Task 1.3:** Implement a "Presence" tracker. Create a `Presence` subcollection inside the `RcaSession` document. Have the client write their user ID and a timestamp to this collection on connection, and use an `onDisconnect` hook (or heartbeat interval) to remove it, displaying live avatars of who is currently in the war room.

#### 2. The Dynamic Canvas UI Component & Translation Logic

* [x] **Task 2.1:** Integrate a robust visual canvas library (such as React Flow). Create a mapper function that takes the flat array of Firestore nodes and translates the `parentNodeId` fields into rendering edges (the connecting lines between cards).
* [x] **Task 2.2:** Implement the **5 Whys Layout Calculator**. Write a pure function that, when the session methodology is set to `5_WHYS`, ignores free-form drag coordinates and automatically forces the nodes into a locked, vertical linear stack layout.
* [x] **Task 2.3:** Implement the **Ishikawa (Fishbone) Layout Calculator**. Write logic that automatically pins `CATEGORY` nodes to a central horizontal "spine." Ensure child `CAUSE` nodes are mathematically angled as diagonal branches attaching to their respective category bones.

#### 3. Optimistic Concurrency & Edit Locking

* [x] **Task 3.1:** Update the `Node` Firestore schema to include `lockedBy` (user ID string or null) and `lockedAt` (Firestore Timestamp).
* [ ] **Task 3.2:** Implement an `onFocus` event on the frontend node text input. When a user clicks to type, immediately run a Firestore update setting `lockedBy` to their user ID.
* [ ] **Task 3.3:** Apply UI disabling logic: If a node arrives via the `onSnapshot` listener with a `lockedBy` ID that does not match the current local user, disable the text input for that specific card and render a small visual indicator (e.g., "🔒 User is editing").
* [ ] **Task 3.4:** Implement an `onBlur` event that clears the `lockedBy` and `lockedAt` fields in Firestore the exact moment the user clicks away from the node, releasing the lock for others.

---

### Phase 4: The Immutable Evidence Locker (Actionable AI Checklist)

**Objective:** Secure the proof. Build a compliant attachment system for machinery logs, telemetry CSVs, and photos that mathematically proves the data has not been altered since the moment of upload.

**AI Implementation Instructions:** Execute the following tasks sequentially to guarantee data immutability for compliance with quality and regulatory audits.

#### 1. Firebase Cloud Storage Pipeline & Strict Security Rules

* [x] **Task 1.1:** Define the strict storage bucket path for all evidence uploads: `Tenants/{tenantId}/Incidents/{incidentId}/Evidence/{uniqueFileName}`.
* [x] **Task 1.2:** Write Firebase Storage Security Rules that strictly enforce **Create-Only** access.
* Allow `read`: Only if the user's custom token `tenantId` matches the path's `tenantId`.
* Allow `create`: Only if the user is authenticated, matches the `tenantId`, and the file size is within limits (e.g., `< 50MB`).
* Allow `update` and `delete`: **Always `false**`. Once written, a file can never be modified or deleted by a client.



#### 2. Cryptographic Hashing Cloud Function

* [ ] **Task 2.1:** Deploy a Firebase Cloud Function using the `functions.storage.object().onFinalize()` trigger. This function must fire automatically every time a new file finishes uploading to the `Evidence` bucket.
* [ ] **Task 2.2:** In the Cloud Function, download the file into memory buffer and calculate its SHA-256 cryptographic hash using Node.js's native `crypto` module.
* [ ] **Task 2.3:** Write the resulting hash, file metadata (size, content type), original uploader ID, and upload timestamp to a new, read-only Firestore collection: `Tenants/{tenantId}/Incidents/{incidentId}/EvidenceLogs/{hashId}`.

#### 3. Evidence-to-Node Linking (UI & Database)

* [x] **Task 3.1:** Update the `Node` TypeScript interface to include an `attachedEvidence: { fileUrl: string, fileHash: string }[]` array.
* [ ] **Task 3.2:** Build a drag-and-drop file upload UI component specifically nested inside the visual Node cards on the workspace.
* [ ] **Task 3.3:** Write the frontend upload logic: When a user drops a file onto a "Why" or "Fishbone" node card, upload the file directly to Firebase Storage. Upon successful upload, fetch the download URL and append the file reference to the specific node's `attachedEvidence` array in Firestore.
* [x] **Task 3.4:** Implement a UI validation rule: If a node's `isRootCause` property is toggled to `true`, the system must check if `attachedEvidence.length > 0`. If no evidence is attached, block the action and prompt the user: "A verified root cause must contain supporting evidence."

---

### Phase 5: Bi-Directional CAPA Integration (Actionable AI Checklist)

**Objective:** Bridge the investigative workspace with external enterprise execution tools (e.g., SAP, IBM Maximo, Jira) by turning verified root causes into trackable, bi-directional Corrective and Preventive Actions (CAPA).

**AI Implementation Instructions:** Execute the following tasks sequentially to ensure a transactional synchronization layer between the serverless Firebase environment and external enterprise databases.

#### 1. CAPA Document Schema & State Machine

* [ ] **Task 1.1:** Define the `CapaAction` TypeScript Interface. Required fields:
* `id` (string)
* `rcaSessionId` (string)
* `rootCauseNodeId` (string) - The exact graph node this action is fixing.
* `actionType` (enum: 'CORRECTIVE', 'PREVENTIVE')
* `description` (string)
* `targetSystem` (enum: 'SAP_PM', 'MAXIMO', 'JIRA')
* `externalTicketId` (string | null)
* `status` (enum: 'DRAFT', 'READY_FOR_SYNC', 'EXTERNAL_PENDING', 'COMPLETED', 'VERIFIED')


* [ ] **Task 1.2:** Create the Firestore subcollection route: `Tenants/{tenantId}/Incidents/{incidentId}/RcaSessions/{sessionId}/CapaActions`.

#### 2. Outbound Integration Broker (Event-Driven Cloud Function)

* [ ] **Task 2.1:** Create a Firestore `onUpdate` and `onCreate` background trigger listening to the `CapaActions` collection.
* [ ] **Task 2.2:** Implement an execution gate: The function must only proceed if the document's `status` has just changed to `READY_FOR_SYNC`.
* [ ] **Task 2.3:** Write the adapter logic. Based on the `targetSystem` field, formulate the specific JSON/XML payload required by that external system's REST API. Use Google Cloud Secret Manager to securely retrieve the external API keys for the specific `tenantId`.
* [ ] **Task 2.4:** Execute the outbound API call. Upon a successful HTTP 200/201 response, parse the returned ticket number, update the local Firestore CAPA document's `externalTicketId`, and change its status to `EXTERNAL_PENDING`.

#### 3. Inbound Status Webhook (REST API)

* [ ] **Task 3.1:** Deploy an HTTP-triggered Cloud Function (e.g., `capaStatusWebhook`) to receive updates from the external ERP/CMMS when a field engineer completes the work order.
* [ ] **Task 3.2:** Validate the incoming request against the `tenantId` API keys.
* [ ] **Task 3.3:** The payload will contain the `externalTicketId`. Query Firestore to find the matching CAPA document.
* [ ] **Task 3.4:** Update the local CAPA status from `EXTERNAL_PENDING` to `COMPLETED`. Add an entry to the `Tenants/{tenantId}/Incidents/{incidentId}/EvidenceLogs` noting the timestamp and external system ID that verified the completion.

#### 4. RCA Session Closure Guard

* [ ] **Task 4.1:** Write a validation check that runs whenever a user attempts to change an `RcaSession` status to `PENDING_REVIEW` or `COMPLETED`.
* [ ] **Task 4.2:** Query the session's `CapaActions` collection. If *any* CAPA document exists where the status is not `VERIFIED` or `COMPLETED`, throw a UI error and block the state transition: "Cannot close investigation. Pending corrective actions must be completed in the external system."

---

### Phase 6: Audit, Compliance & Cryptographic Sealing (Actionable AI Checklist)

**Objective:** Lock the investigation down for regulatory auditors. Build a strict 21 CFR Part 11 compliant sign-off process that permanently freezes the RCA data and generates a mathematically verifiable, tamper-proof audit package.

**AI Implementation Instructions:** Execute the following tasks sequentially. This is the final phase. Security rules here are absolute and must not have any loopholes that allow data alteration post-closure.

#### 1. Session Freeze & Immutability (Firestore Security Rules)

* [x] **Task 1.1:** Open the Firestore Security Rules file. Create a new helper function to check the session status:
`function isSessionOpen(tenantId, incidentId, sessionId) { return get(/databases/$(database)/documents/Tenants/$(tenantId)/Incidents/$(incidentId)/RcaSessions/$(sessionId)).data.status != 'CLOSED'; }`
* [x] **Task 1.2:** Apply this lock down to the subcollections. For `Nodes`, `EvidenceLogs`, and `CapaActions`, modify the `update` and `delete` rules to explicitly require `isSessionOpen(...) == true`. Once a session is closed, the database must outright reject any write operations at the network level.

#### 2. Dual-Factor Re-Authentication (Frontend)

* [ ] **Task 2.1:** Build an Electronic Signature UI modal that appears when a user clicks "Approve & Close RCA".
* [ ] **Task 2.2:** Implement the Firebase `reauthenticateWithCredential` method. The user *must* be prompted to re-enter their password or re-authenticate via their SSO provider at the exact moment of signing. Do not rely on their existing active session token.
* [ ] **Task 2.3:** Require the user to type out an explicit consent statement (e.g., "I approve these root causes and actions") matching the 21 CFR Part 11 requirements for intent.

#### 3. Cryptographic Audit Sealing (Callable Cloud Function)

* [ ] **Task 3.1:** Create an `onCall` Firebase Cloud Function named `sealRcaSession`. The frontend will pass the re-authenticated token, the `sessionId`, and the signed consent statement to this function.
* [ ] **Task 3.2:** Inside the Cloud Function, verify that the `auth_time` on the user's token is within the last 5 minutes to confirm the dual-factor check just occurred.
* [ ] **Task 3.3:** **The Serialization Engine:** Query Firestore and retrieve the parent `Incident`, the `RcaSession`, and all associated `Nodes`, `EvidenceLogs`, and `CapaActions`. Assemble these objects into a single, structured JSON string (Canonical JSON, ensuring keys are alphabetically sorted so the hash is deterministic).
* [ ] **Task 3.4:** **The Hash Generator:** Pass the serialized JSON string through Node.js `crypto` using the SHA-512 algorithm to generate an immutable footprint hash.
* [ ] **Task 3.5:** **The Atomic Batch Commit:** Use a Firestore `WriteBatch`. In a single transaction:
* Change the `RcaSession` status to `CLOSED`.
* Write a new document to `Tenants/{tenantId}/Incidents/{incidentId}/RcaSessions/{sessionId}/AuditSignatures` containing: `userId`, `timestamp`, `consentStatement`, the `clientIpAddress`, and the `sha512Hash`.



#### 4. Audit-Ready Export Module

* [ ] **Task 4.1:** Build a secondary HTTP Cloud Function (e.g., `exportRcaReport`) that takes a `sessionId`.
* [ ] **Task 4.2:** Use a library like `pdfkit` or `puppeteer` within the function to render the closed RCA data into a formal, watermarked PDF document.
* [ ] **Task 4.3:** Ensure the PDF clearly prints the final `sha512Hash`, the digital signature timestamp, and the user's ID at the very bottom of the document as proof of mathematical integrity for third-party auditors.

---

**This concludes the 6-Phase implementation blueprint.** You now have the complete, step-by-step architecture instructions.
