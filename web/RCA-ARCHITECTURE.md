Here is the complete, master architectural blueprint designed specifically as a "Source of Truth" document for an AI development agent.

To achieve absolute multi-tenant data isolation and real-time collaboration without relying on traditional relational databases, this architecture leverages a **Serverless Event-Driven Firebase Stack** (Cloud Firestore, Cloud Functions, and Cloud Storage).

You can copy this exact text and hand it to your AI agent to begin implementation phase by phase.

---

# Enterprise RCA Collaborative Engine: Master Architecture & Implementation Blueprint

## Core Architectural Paradigm

This system is an enterprise-grade, multi-tenant Root Cause Analysis (RCA) engine designed for food manufacturing, logistics, and warehouse operations. It uses a **NoSQL Hierarchical Graph Model** built on Cloud Firestore to support dynamic, real-time visual workspaces (5 Whys, Ishikawa/Fishbone, Fault Tree) while maintaining strict ISO 9001 and FDA 21 CFR Part 11 compliance.

### The Firebase Ecosystem Mapping

* **Primary Database:** Cloud Firestore (Document-based NoSQL) for infinitely scalable tree-node structures and real-time state synchronization via `onSnapshot` listeners.
* **Binary Storage:** Firebase Cloud Storage for immutable, cryptographic evidence lockers.
* **Logic & Integration:** Firebase Cloud Functions for RPN calculations, external API webhooks (ERP/CMMS sync), and compliance snapshot hashing.
* **Identity & Isolation:** Firebase Authentication paired with Firestore Security Rules (Tenant IDs) to guarantee absolute data isolation across different enterprise clients.

---

## The 6-Phase Implementation Sequence

Your AI agent must implement these phases sequentially. Downstream audit and compliance features rely entirely on the foundational data isolation and real-time models established in Phases 1 and 2.

### Phase 1: Foundation & Multi-Tenant Isolation

Establish the database topography, security perimeter, and core incident triggers.

**Synzapp implementation note:** The existing production tenant root is `organizations/{tenantId}`. RCA follows the same hierarchy as `organizations/{tenantId}/rcaIncidents/{incidentId}/rcaSessions/{sessionId}/nodes/{nodeId}` instead of introducing a parallel `Tenants` root.

* **Architectural Goal:** Guarantee that no tenant can ever query or access another tenant's RCA data, and set up the NoSQL collections for Incidents, RCA Sessions, and Nodes.
* **AI Implementation Checklist:**
* [x] **Tenant Isolation Rules:** Write Firestore Security Rules that strictly validate `request.auth.token.tenantId` against the `tenantId` field on every document read/write.
* [x] **NoSQL Schema Design:** Create a nested collection architecture: `Tenants/{tenantId}/Incidents/{incidentId}/RcaSessions/{sessionId}/Nodes/{nodeId}`.
* [x] **Node Document Structure:** Design the `Nodes` document to support a generic graph structure. It must include fields for `nodeType` (e.g., 'WHY', 'FISHBONE_CATEGORY', 'SUB_CAUSE'), `parentNodeId` (to allow infinite nesting), and `uiCoordinates` (for the visual canvas).



### Phase 2: Ingestion & Dynamic Triage

Build the automated entry points for anomalies from the plant floor or warehouse.

* **Architectural Goal:** Automatically capture failure events (e.g., temperature deviations, logistics delays, equipment jams) and calculate risk to mandate investigations.
* **AI Implementation Checklist:**
* [ ] **Ingestion Webhooks:** Deploy an HTTP-triggered Firebase Cloud Function to receive JSON payloads from external SCADA, IoT, or Warehouse Management Systems (WMS).
* [ ] **Automated RPN Trigger:** Write a Firestore `onCreate` trigger on the `Incidents` collection. When a new incident arrives, multiply $Severity \times Occurrence \times Detection$. If the Risk Priority Number (RPN) is $\ge 25$, automatically generate an active `RcaSessions` document.
* [ ] **Idempotency Guard:** Implement logic in the ingestion function to check for identical active incidents on the same equipment/process within a 24-hour window to prevent duplicate RCA creation.



### Phase 3: The Real-Time Collaborative Canvas (The Core Differentiator)

Develop the interactive workspace that allows cross-functional teams to brainstorm seamlessly.

* **Architectural Goal:** Utilize Firestore's real-time capabilities to create a Miro-style multi-user board where users can switch between 5 Whys and Fishbone layouts on the fly.
* **AI Implementation Checklist:**
* [ ] **Real-Time Sync Engine:** Implement UI listeners using Firestore `onSnapshot`. When an industrial engineer in one facility drags a node, the `uiCoordinates` update in Firestore and instantly reflect on the plant manager's screen in another facility.
* [x] **Methodology Translation Logic:** Write frontend graph-rendering algorithms that can read the flat `Nodes` collection and render it either as a linear 5 Whys list or a branching Ishikawa diagram based on user selection.
* [x] **Optimistic Concurrency & Locking:** Implement a "locked by" field on the node documents. When a user starts editing a specific root cause card, lock it to prevent other users from overriding the text simultaneously.



### Phase 4: Immutable Evidence Locker

Secure the proof. Root causes must be backed by verifiable data.

* **Architectural Goal:** Provide a secure attachment system for machinery logs, photos of broken parts, and lab reports that cannot be altered once uploaded.
* **AI Implementation Checklist:**
* [x] **Upload Pipeline:** Configure Firebase Cloud Storage with strict `create`-only security rules for the evidence bucket to prevent deletion or modification.
* [ ] **Cryptographic Hashing:** Deploy a Cloud Function triggered on storage `onFinalize`. It must generate a SHA-256 hash of the uploaded file and write that hash to a read-only Firestore `EvidenceLog` document.
* [ ] **Evidence-to-Node Linking:** Ensure every piece of evidence is firmly associated with a specific `nodeId` to validate the specific "Why" or "Cause".



### Phase 5: Bi-Directional CAPA Integration

Turn findings into real-world action by pushing tasks to external maintenance and operational systems.

* **Architectural Goal:** Create Corrective and Preventive Actions (CAPA) inside the RCA and sync them with enterprise execution tools (e.g., SAP, Maximo, Jira).
* **AI Implementation Checklist:**
* [ ] **CAPA Document Modeling:** Create a `CapaActions` collection linked to verified root cause nodes.
* [ ] **Outbound Integration Broker:** Write an event-driven Cloud Function that listens for CAPA status changes to `READY_FOR_SYNC`. It must make outbound REST calls to the required external ERP/CMMS and save the returned `externalTicketId`.
* [ ] **Inbound Status Webhook:** Create an endpoint to receive updates back from the ERP (e.g., "Work Order Complete") and update the local CAPA document to `VERIFIED`.



### Phase 6: Audit, Compliance & Cryptographic Sealing

Lock the investigation down for regulatory auditors.

* **Architectural Goal:** Provide a 21 CFR Part 11 compliant sign-off process that permanently freezes the RCA and generates an audit-ready package.
* **AI Implementation Checklist:**
* [ ] **State Freeze Implementation:** Build a Cloud Function that changes the RCA Session status to `CLOSED`. Update Firestore Security Rules so that if `status == 'CLOSED'`, all subsequent `update` or `delete` requests to the session, its nodes, and its CAPAs are outright rejected.
* [ ] **Dual-Factor Digital Signatures:** Implement an authentication flow that requires users to re-verify their credentials (re-auth) before applying their signature.
* [ ] **Blockchain-Style Audit Block:** Upon final signature, trigger a Cloud Function that serializes the entire RCA (incident data, node tree, evidence hashes, and CAPAs) into a single string, hashes it via SHA-512, and stores it in an immutable `AuditSignatures` collection.
