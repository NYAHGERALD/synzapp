# Synzapp Enterprise AI Credit Visualization and Tenant Billing Plan

Date: August 27, 2026

## Executive Summary

Synzapp needs an enterprise AI usage and credit control system that lets each Org Admin understand how much AI their company is using, what it costs in USD dollars, which teams and employees are driving usage, and whether AI should remain enabled for the whole company, a department, or an individual employee.

This must be implemented as a tenant-isolated Synzapp metering layer. OpenAI's platform credit balance is account/project-level and is not enough by itself for company billing because multiple Synzapp tenant organizations may share the same backend provider account. Synzapp must therefore record its own per-tenant AI ledger on every backend AI call, then use provider pricing tables and provider usage reports only as reconciliation inputs.

Payment setup by organization is included in this plan as a secure future phase. It must not be implemented until explicitly approved by Gerald.

## Current Problem

The live interpreter recently failed because the backend OpenAI project had no credits remaining. That was a platform-level provider balance issue. In an enterprise product, Org Admins should not discover AI exhaustion only when a critical workflow fails.

Synzapp should provide:

- per-company AI spend visibility
- employee, department, and feature-level usage breakdowns
- budget warnings before exhaustion
- tenant-level AI controls
- future tenant-level payments and top-ups
- audit-safe controls that do not affect other tenants

## Research Baseline

OpenAI's current API pricing page lists realtime and audio generation model prices per 1M tokens unless noted. As of this plan date, `gpt-realtime-2.1` is listed at $32.00 audio input, $0.40 cached audio input, and $64.00 audio output per 1M tokens; `gpt-realtime-2.1-mini` is listed at $10.00 audio input, $0.30 cached audio input, and $20.00 audio output per 1M tokens. OpenAI also lists `gpt-realtime-translate` at an estimated $0.034 per minute and live transcription models at $0.017 per minute.

Source: https://platform.openai.com/docs/pricing

OpenAI notes that Responses API, Chat Completions API, Realtime API, Batch API, and Assistants API are not priced separately; tokens are billed at the selected model rates.

Source: https://platform.openai.com/docs/pricing

Design implication:

- Synzapp must store model prices in backend configuration with effective dates.
- Cost calculations must be labeled as estimated until reconciled with provider billing data.
- Org Admin UX must show USD dollar amounts clearly and explain when values are estimated.
- No mobile client should call OpenAI billing APIs or hold provider credentials.

## Goals

1. Give Org Admins a clear AI Usage and Credits dashboard.
2. Show current month, previous month, today, and custom date range usage in USD dollars.
3. Break down cost by feature, employee, department, meeting, model, and status.
4. Let Org Admins disable AI for:
   - the entire company tenant
   - a department
   - an employee
   - specific AI feature families
5. Keep tenant controls strictly scoped so one organization cannot affect another.
6. Create a secure foundation for future organization payment setup.
7. Add audit trails for all AI usage, budget, and enable/disable changes.
8. Avoid exposing OpenAI keys, provider account balances, provider project IDs, or other platform secrets to mobile clients.

## Non-Goals For Initial Implementation

- Do not implement payment collection until Gerald approves it.
- Do not expose raw OpenAI billing credentials or provider account balance to Org Admins.
- Do not allow tenant Admins to alter global Synzapp provider settings.
- Do not block non-AI core workflows such as chat, calls, employee management, groups, RAILS manual entry, RCA manual entry, or LSW manual tasks.
- Do not treat estimated tenant usage as a legally final invoice until reconciliation and payment phases are approved.

## Product Model

Synzapp will have three related but separate concepts:

1. Platform Provider Credits
   - The OpenAI API credit balance or payment account used by Synzapp backend.
   - Visible only to Synzapp platform operators.
   - Used to keep the whole platform operational.

2. Tenant AI Usage
   - Synzapp-owned ledger of AI events by tenant.
   - Visible to authorized Org Admins inside their own company only.
   - Used for dashboards, controls, estimates, and future billing.

3. Tenant Billing Account
   - Future payment entity for a company.
   - Stores subscription/payment status through a payment provider such as Stripe.
   - Must be implemented only after explicit approval.

## Org Admin UX

### Entry Point

Add `Settings > Company > AI Usage & Credits`.

Only users with Org Admin permission should see the full dashboard. Department Admins may later receive a scoped read-only department usage view if approved.

### Screen Structure

Top app bar:

- Back button
- Center title: `AI Usage & Credits`
- Right options menu

Header summary:

- `Estimated AI spend`
- Current month total in USD dollars, for example `$48.72`
- Usage period, for example `Aug 1 - Aug 27, 2026`
- Status chip:
  - `Healthy`
  - `Approaching budget`
  - `Budget reached`
  - `AI disabled`
  - `Provider credits exhausted`

Budget cards:

- Monthly budget
- Current spend
- Remaining budget
- Forecasted month-end spend
- Last updated

Control cards:

- Company AI toggle
  - `AI enabled for company`
  - `Disable company AI`
  - Disabling company AI blocks AI endpoints for this tenant only.

- Feature controls
  - Live Interpreter
  - Interpreter summaries and spoken playback
  - Chat translation
  - RAILS AI
  - RCA AI
  - LSW AI
  - Future AI features

- Department controls
  - Search departments
  - Current month spend
  - AI status
  - Toggle department AI

- Employee controls
  - Search employees
  - Department and role
  - Current month spend
  - AI status
  - Toggle employee AI

Usage analytics tabs:

- Overview
- Features
- Departments
- Employees
- Meetings
- Failures
- Audit

### Overview Tab

Show:

- total estimated cost in USD dollars
- total AI requests
- successful requests
- failed requests
- live interpreter minutes
- generated audio minutes
- input tokens
- output tokens
- top feature by cost
- top department by cost
- top employee by cost

Charts:

- daily spend line chart
- feature spend stacked bars
- status breakdown

### Features Tab

Rows:

- feature name
- requests
- estimated cost
- average cost per request
- trend compared with previous period
- status

Expected feature labels:

- Live Interpreter
- Interpreter Summary
- Spoken Summary
- Transcript Audio
- Segment Translation
- RAILS AI
- RCA AI
- LSW AI
- Chat Translation

### Departments Tab

Rows:

- department name
- active employees
- AI-enabled status
- estimated cost
- request count
- interpreter minutes
- top feature
- action menu

Actions:

- View department usage
- Disable AI for department
- Enable AI for department
- Set department monthly limit
- Export CSV

### Employees Tab

Rows:

- employee name
- role
- department
- AI-enabled status
- estimated cost
- request count
- last AI use
- action menu

Actions:

- View employee usage
- Disable AI for employee
- Enable AI for employee
- Set employee monthly limit
- Export CSV

### Meetings Tab

Rows:

- meeting name
- meeting type
- owner
- participants
- live interpreter minutes
- summaries generated
- estimated cost
- date/time

### Failures Tab

Show operational failures without exposing secrets:

- `provider_credit_exhausted`
- `provider_rate_limited`
- `provider_timeout`
- `tenant_ai_disabled`
- `department_ai_disabled`
- `employee_ai_disabled`
- `tenant_budget_reached`
- `model_unavailable`
- `unknown_provider_error`

Each failure row should include:

- time
- tenant-scoped feature
- employee
- department
- safe error category
- user-facing message
- request correlation id

### Audit Tab

Show AI governance changes:

- company AI enabled/disabled
- feature enabled/disabled
- department AI enabled/disabled
- employee AI enabled/disabled
- budgets changed
- payment status changed in future phase

Audit rows:

- timestamp
- actor
- action
- scope
- old value
- new value
- reason

### Options Menu

Top-right options:

- Refresh usage
- Export CSV
- Download monthly report
- Manage AI controls
- View audit history
- Billing setup, locked until approved

## AI Disable Policy

### Evaluation Order

Before every backend AI operation, Synzapp must evaluate policy in this order:

1. Platform AI operational status.
2. Tenant company AI status.
3. Tenant budget status.
4. Feature-level AI status.
5. Department AI status.
6. Employee AI status.
7. Employee role permission.
8. Request-specific rate limit.

The first blocking rule returns a clear safe error. Example:

`AI is disabled for your department by your organization admin.`

### Tenant Isolation

All AI policy records must include `tenantId`.

Policy reads must be performed through the existing authenticated backend authorization context. Mobile clients must never pass a trusted `tenantId` to control policy directly.

Disabling AI for one tenant must not modify:

- global provider configuration
- other tenant policy records
- other tenant budget records
- other tenant employees
- other tenant departments

### Policy Data Model

Collection: `tenantAiPolicies`

Document id: `tenantId`

Fields:

- `tenantId`
- `companyAiEnabled`
- `disabledReason`
- `monthlyBudgetUsd`
- `hardLimitEnabled`
- `softWarningPercent`
- `featurePolicies`
- `departmentPolicies`
- `employeePolicies`
- `createdAtIso`
- `updatedAtIso`
- `updatedByUid`

Feature policy:

- `featureId`
- `enabled`
- `monthlyBudgetUsd`
- `hardLimitEnabled`
- `updatedAtIso`
- `updatedByUid`

Department policy:

- `departmentId`
- `enabled`
- `monthlyBudgetUsd`
- `hardLimitEnabled`
- `updatedAtIso`
- `updatedByUid`

Employee policy:

- `employeeUid`
- `enabled`
- `monthlyBudgetUsd`
- `hardLimitEnabled`
- `updatedAtIso`
- `updatedByUid`

## AI Usage Ledger

Collection: `tenantAiUsageEvents`

Document id: generated event id.

Required fields:

- `eventId`
- `tenantId`
- `companyName`
- `actorUid`
- `actorDisplayName`
- `actorDepartmentId`
- `actorDepartmentName`
- `featureId`
- `operationId`
- `operationLabel`
- `resourceType`
- `resourceId`
- `model`
- `provider`
- `requestStartedAtIso`
- `requestEndedAtIso`
- `durationMs`
- `status`
- `errorCategory`
- `providerRequestId`
- `correlationId`
- `inputTokens`
- `cachedInputTokens`
- `outputTokens`
- `audioInputTokens`
- `cachedAudioInputTokens`
- `audioOutputTokens`
- `audioSeconds`
- `estimatedCostUsd`
- `pricingVersionId`
- `createdAtIso`

Status values:

- `succeeded`
- `failed`
- `blocked`
- `cancelled`

Error categories:

- `none`
- `provider_credit_exhausted`
- `provider_rate_limited`
- `provider_timeout`
- `provider_auth_error`
- `provider_model_unavailable`
- `tenant_ai_disabled`
- `feature_ai_disabled`
- `department_ai_disabled`
- `employee_ai_disabled`
- `tenant_budget_reached`
- `request_invalid`
- `unknown`

### Aggregates

For dashboard speed, maintain denormalized aggregate documents:

- `tenantAiUsageDaily/{tenantId_yyyy_mm_dd}`
- `tenantAiUsageMonthly/{tenantId_yyyy_mm}`
- `tenantAiUsageByFeature/{tenantId_yyyy_mm_featureId}`
- `tenantAiUsageByDepartment/{tenantId_yyyy_mm_departmentId}`
- `tenantAiUsageByEmployee/{tenantId_yyyy_mm_employeeUid}`
- `tenantAiUsageByMeeting/{tenantId_yyyy_mm_meetingId}`

Aggregates should be updated by backend service logic after writing the immutable ledger event. If an aggregate update fails, the ledger remains authoritative and a repair job can rebuild aggregates.

## Pricing Configuration

Collection: `aiProviderPricing`

Document fields:

- `pricingVersionId`
- `provider`
- `model`
- `effectiveFromIso`
- `effectiveToIso`
- `currency`
- `textInputPerMillionUsd`
- `textCachedInputPerMillionUsd`
- `textOutputPerMillionUsd`
- `audioInputPerMillionUsd`
- `audioCachedInputPerMillionUsd`
- `audioOutputPerMillionUsd`
- `imageInputPerMillionUsd`
- `imageCachedInputPerMillionUsd`
- `perMinuteUsd`
- `sourceUrl`
- `createdAtIso`
- `updatedAtIso`

Initial pricing baseline from OpenAI pricing page on August 27, 2026:

- `gpt-realtime-2.1`
  - audio input: `$32.00 / 1M tokens`
  - cached audio input: `$0.40 / 1M tokens`
  - audio output: `$64.00 / 1M tokens`
  - text input: `$4.00 / 1M tokens`
  - cached text input: `$0.40 / 1M tokens`
  - text output: `$24.00 / 1M tokens`
  - image input: `$5.00 / 1M tokens`
  - cached image input: `$0.50 / 1M tokens`

- `gpt-realtime-2.1-mini`
  - audio input: `$10.00 / 1M tokens`
  - cached audio input: `$0.30 / 1M tokens`
  - audio output: `$20.00 / 1M tokens`
  - text input: `$0.60 / 1M tokens`
  - cached text input: `$0.06 / 1M tokens`
  - text output: `$2.40 / 1M tokens`
  - image input: `$0.80 / 1M tokens`
  - cached image input: `$0.08 / 1M tokens`

- `gpt-realtime-translate`
  - estimated live translation: `$0.034 / minute`

- `gpt-live-transcribe`
  - estimated live transcription: `$0.017 / minute`

The pricing table must be configurable from backend admin tooling and must not require a mobile app release when provider prices change.

## Cost Calculation

For token-based calls:

`estimatedCostUsd = inputTokens / 1_000_000 * inputRate + cachedInputTokens / 1_000_000 * cachedInputRate + outputTokens / 1_000_000 * outputRate + audioInputTokens / 1_000_000 * audioInputRate + cachedAudioInputTokens / 1_000_000 * cachedAudioInputRate + audioOutputTokens / 1_000_000 * audioOutputRate`

For minute-based calls:

`estimatedCostUsd = billableMinutes * perMinuteUsd`

For realtime sessions:

- Prefer usage token details returned by the provider when available.
- If token details are unavailable, record session duration and use the configured per-minute estimator.
- Mark rows as `estimated`.
- Reconcile later against provider usage exports or provider admin APIs.

## Backend API Plan

Admin-only endpoints:

- `GET /api/admin/ai-usage/summary?period=current_month`
- `GET /api/admin/ai-usage/daily?startDate=&endDate=`
- `GET /api/admin/ai-usage/features?month=`
- `GET /api/admin/ai-usage/departments?month=`
- `GET /api/admin/ai-usage/employees?month=`
- `GET /api/admin/ai-usage/meetings?month=`
- `GET /api/admin/ai-usage/failures?startDate=&endDate=`
- `GET /api/admin/ai-usage/audit?startDate=&endDate=`
- `GET /api/admin/ai-policy`
- `PATCH /api/admin/ai-policy/company`
- `PATCH /api/admin/ai-policy/features/:featureId`
- `PATCH /api/admin/ai-policy/departments/:departmentId`
- `PATCH /api/admin/ai-policy/employees/:employeeUid`
- `PATCH /api/admin/ai-policy/budget`
- `GET /api/admin/ai-pricing`

Platform-operator-only endpoints:

- `POST /api/platform/ai-pricing`
- `PATCH /api/platform/ai-pricing/:pricingVersionId`
- `POST /api/platform/ai-usage/reconcile`
- `GET /api/platform/ai-provider-status`

Mobile must only call tenant admin endpoints. Platform endpoints must not be shipped into the mobile Org Admin UX.

## Backend Enforcement Plan

Create a shared helper:

`assertTenantAiAllowed(context, featureId, operationMetadata)`

This helper should:

1. Load tenant policy.
2. Load actor employee profile and department.
3. Check company, feature, department, employee, and budget controls.
4. Write a blocked ledger event when denied.
5. Throw a clear typed error.

Every backend AI path must call this before provider usage:

- interpreter realtime session creation
- interpreter SDP exchange
- interpreter summaries
- interpreter spoken summary audio
- interpreter transcript audio
- interpreter segment translation
- speaker previews
- RAILS knowledge/AI calls
- RCA knowledge/AI calls
- chat translation
- future LSW AI calls

## Security Requirements

- Org Admins can view only their own tenant usage.
- Department Admin views, if added later, must be department-scoped and read-only by default.
- AI provider secrets remain only in Google Secret Manager.
- Payment provider secrets remain only in Google Secret Manager.
- Ledger writes happen only on backend.
- Mobile cannot create or mutate usage events.
- Usage events must not store prompt text, transcript text, chat text, RCA text, or customer confidential content.
- Store counts, durations, model ids, safe feature ids, and resource ids only.
- All policy mutations require audit events.
- All policy mutations require existing Synzapp role/permission checks.
- Enforce tenant scoping at Firestore rules and backend authorization layers.
- Exported CSV reports must be tenant-scoped and should omit provider request secrets.

## Payment Setup Plan

Status: planned only. Do not implement until Gerald explicitly approves.

Future organization payment should support:

- company billing profile
- billing contact
- payment method setup
- tax address
- monthly budget
- prepaid credit wallet
- auto-reload threshold
- auto-reload amount
- monthly invoices
- receipts
- failed payment state
- grace period
- hard AI shutdown when wallet or budget is exhausted

Recommended provider:

- Stripe for payment methods, invoices, webhooks, customer billing portal, and secure PCI handling.

Payment data model:

- `tenantBillingAccounts`
  - `tenantId`
  - `billingStatus`
  - `stripeCustomerId`
  - `defaultPaymentMethodStatus`
  - `billingEmail`
  - `billingAddressSummary`
  - `prepaidBalanceUsd`
  - `monthlyBudgetUsd`
  - `autoReloadEnabled`
  - `autoReloadThresholdUsd`
  - `autoReloadAmountUsd`
  - `lastInvoiceId`
  - `createdAtIso`
  - `updatedAtIso`

Payment security:

- Never store raw card numbers.
- Use hosted payment setup or Stripe Payment Element.
- Verify webhook signatures.
- Make billing mutations idempotent.
- Keep billing permissions separate from ordinary AI usage read permissions.
- Require Org Admin or billing-admin permission for payment changes.
- Audit every payment setting change.
- Do not trust mobile for prices, balances, or invoice amounts.

Payment UX:

- `Billing & AI Credits` screen
- Current company balance in USD dollars
- Monthly usage and budget
- Add credits
- Enable auto-reload
- Payment method
- Invoice history
- Usage report export
- Failed payment warning
- Disable AI controls

## Mobile Implementation Plan

### Phase 1: Read-Only Dashboard

- Add `AI Usage & Credits` entry under Settings.
- Add dashboard shell and summary cards.
- Fetch current month summary.
- Show USD dollar values using locale-aware formatting.
- Show estimated/reconciled labels.
- Add pull-to-refresh without visible disruptive loading state.

### Phase 2: Analytics Tabs

- Add Overview, Features, Departments, Employees, Meetings, Failures, and Audit tabs.
- Use compact enterprise rows and charts.
- Add date range selector.
- Add CSV export action.

### Phase 3: AI Controls

- Add company AI toggle.
- Add feature toggles.
- Add department controls.
- Add employee controls.
- Require native confirmation alert before disabling broad scopes.
- Require reason text for company-wide disable and budget hard-limit changes.
- Reflect disabled state immediately after backend confirmation.

### Phase 4: Budget Controls

- Add monthly budget display.
- Add soft warning threshold.
- Add hard limit option.
- Add forecasted spend.
- Add warning banners.

### Phase 5: Payment Setup

Status: approval required before implementation.

- Add billing profile.
- Add payment provider integration.
- Add credits/top-up.
- Add invoices.
- Add auto-reload.

## Backend Implementation Plan

### Phase 1: Ledger Foundation

- Add `aiUsageLedgerService`.
- Add immutable usage event writer.
- Add pricing lookup.
- Add cost calculator.
- Add aggregate writers.
- Add tests for cost calculation and tenant scoping.

### Phase 2: Policy Foundation

- Add `tenantAiPolicyService`.
- Add `assertTenantAiAllowed`.
- Add blocked-event logging.
- Add company, feature, department, and employee controls.
- Add tests proving tenant isolation.

### Phase 3: Instrument AI Calls

- Wrap every backend AI provider call with:
  - policy check
  - usage start event/correlation id
  - provider call
  - usage success/failure write
  - aggregate update

### Phase 4: Admin APIs

- Add summary endpoints.
- Add detail endpoints.
- Add policy endpoints.
- Add audit endpoints.
- Add export endpoints.

### Phase 5: Reconciliation

- Add provider usage reconciliation job.
- Compare Synzapp estimated totals to provider totals.
- Flag variance.
- Keep tenant ledger as the source for tenant allocation.

### Phase 6: Payment

Status: approval required before implementation.

- Add payment provider.
- Add tenant wallet.
- Add invoice flow.
- Add webhooks.
- Add payment failure/grace rules.

## Acceptance Criteria

- Org Admin can see current month estimated AI spend in USD dollars.
- Org Admin can see usage by feature, department, employee, and meeting.
- Org Admin can disable AI for the company without affecting other tenants.
- Org Admin can disable AI for one department without affecting other departments or tenants.
- Org Admin can disable AI for one employee without affecting other employees or tenants.
- Backend blocks disabled AI requests before calling the provider.
- Blocked attempts write safe ledger/audit records.
- No OpenAI API key or provider credential is exposed to mobile.
- Usage events do not store customer prompt/chat/transcript content.
- Pricing is backend-configurable and effective-dated.
- Payment setup remains unimplemented until explicit approval.

## Validation Plan

- Unit tests for cost calculation.
- Unit tests for pricing effective-date selection.
- Unit tests for AI policy evaluation order.
- Unit tests for tenant isolation.
- API tests for Org Admin authorization.
- API tests that Department Admin cannot change company AI policy.
- Mobile typecheck and unit tests.
- Physical iPhone validation for dashboard layout and toggles.
- Manual test with two tenants proving disabling tenant A does not affect tenant B.

## Implementation Approval Boundary

This document is a plan only. Implementation of the usage visualization and AI disable controls may begin after Gerald approves it.

Payment setup, prepaid credits, auto-reload, invoices, and Stripe/payment-provider integration must not be implemented until Gerald gives separate explicit approval.
