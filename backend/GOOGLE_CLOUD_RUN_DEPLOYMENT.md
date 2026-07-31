# Synzapp Backend Google Cloud Run Deployment

This document is the source of truth for moving the Synzapp backend from Render to Google Cloud Run with a free-tier-friendly setup.

## Recommended Architecture

Use Cloud Run for the Synzapp backend API and realtime WebSocket service.

- Runtime: Cloud Run service, request-based billing, `min-instances=0`.
- Build: Dockerfile in `backend/`, deployed from source with `gcloud run deploy --source .`.
- Identity: Google-managed Cloud Run service account.
- Firebase access: Application Default Credentials from the Cloud Run service account.
- Secrets: Secret Manager, injected into Cloud Run as environment variables.
- Storage: Existing Firebase Storage bucket.
- Health check: `/health`.

This avoids storing Firebase service-account JSON in Cloud Run when the backend runs inside the same Google Cloud project. `FIREBASE_SERVICE_ACCOUNT_JSON` remains available only as an escape hatch for local or non-Google hosting.

## Free-Tier Guardrails

Cloud Run is the right first target because it can scale to zero and uses request-based billing. Keep these settings for the first Google Cloud deployment:

- `--min-instances=0`
- `--max-instances=3`
- `--cpu=1`
- `--memory=512Mi`
- `--concurrency=80`
- `--timeout=3600`

Important enterprise note: interpreter reminders currently run as an in-process worker. With `min-instances=0`, Cloud Run can scale down when idle, so reminders are best-effort while no requests are warming the service. The enterprise-ready reminder architecture is a separate Cloud Scheduler or Cloud Run Job worker with a locked-down service-to-service endpoint.

## One-Time Google Cloud Setup

Run these from your terminal after installing the Google Cloud CLI.

```bash
gcloud auth login
gcloud config set project synzapp-a7ee3

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com \
  firestore.googleapis.com \
  firebase.googleapis.com \
  firebaseappcheck.googleapis.com
```

Create a dedicated runtime service account:

```bash
export PROJECT_ID="synzapp-a7ee3"
export RUN_SA_NAME="synzapp-backend-run"
export RUN_SA="$RUN_SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

gcloud iam service-accounts create "$RUN_SA_NAME" \
  --display-name="Synzapp Cloud Run backend"
```

Grant the backend only the access it needs:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$RUN_SA" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$RUN_SA" \
  --role="roles/firebaseauth.admin"

gcloud storage buckets add-iam-policy-binding gs://synzapp-a7ee3.firebasestorage.app \
  --member="serviceAccount:$RUN_SA" \
  --role="roles/storage.objectAdmin"

gcloud iam service-accounts add-iam-policy-binding "$RUN_SA" \
  --member="serviceAccount:$RUN_SA" \
  --role="roles/iam.serviceAccountTokenCreator"
```

If `SYNZAPP_REQUIRE_APP_CHECK=true`, also grant the service account Firebase App Check access from the Google Cloud console or Firebase console.

## Secret Manager

Do not place secrets in `cloudrun.env.yaml`, GitHub, or mobile builds.

Render currently stores every runtime key in one place, but Cloud Run should split them by sensitivity and by owner. The backend code still reads values from `process.env`; Cloud Run can inject Secret Manager values as environment variables at runtime, so the application code does not need to know whether a value came from `cloudrun.env.yaml` or Secret Manager.

### Render Variable Migration Matrix

Use this split when moving away from Render:

| Render key | Google Cloud destination | Reason |
| --- | --- | --- |
| `OPENAI_API_KEY` | Secret Manager | Provider credential. |
| `PHONE_HASH_SECRET` | Secret Manager | Used for private phone lookup hashing. |
| `PHONE_ENCRYPTION_SECRET` | Secret Manager | Used for encrypted phone data. |
| `APNS_AUTH_KEY` | Secret Manager | Apple private key content. |
| `APNS_KEY_ID` | Secret Manager | APNs credential identifier. |
| `APNS_TEAM_ID` | Secret Manager | Apple team credential identifier. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Do not use on Cloud Run when using the runtime service account. Secret Manager only as a fallback. | Cloud Run should use Application Default Credentials from `synzapp-backend-run`. |
| `FIREBASE_PROJECT_ID` | `cloudrun.env.yaml` | Non-secret project identifier. |
| `FIREBASE_STORAGE_BUCKET` | `cloudrun.env.yaml` | Non-secret bucket name; access is controlled by IAM. |
| `CORS_ORIGIN` | `cloudrun.env.yaml` | Non-secret policy config; set to exact web origin before production. |
| `SYNZAPP_REQUIRE_APP_CHECK` | `cloudrun.env.yaml` | Non-secret feature/security switch. |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `cloudrun.env.yaml` | Non-secret rate-limit config. |
| `AUTH_RATE_LIMIT_MAX` | `cloudrun.env.yaml` | Non-secret rate-limit config. |
| `OTP_RATE_LIMIT_WINDOW_MS` | `cloudrun.env.yaml` | Non-secret rate-limit config. |
| `OTP_RATE_LIMIT_MAX` | `cloudrun.env.yaml` | Non-secret rate-limit config. |
| `OPENAI_MODEL` | `cloudrun.env.yaml` | Non-secret model selector. |
| `OPENAI_REQUEST_TIMEOUT_MS` | `cloudrun.env.yaml` | Non-secret timeout config. |
| `OPENAI_INTERPRETER_REALTIME_MODEL` | `cloudrun.env.yaml` | Non-secret model selector. |
| `OPENAI_INTERPRETER_TRANSCRIPTION_MODEL` | `cloudrun.env.yaml` | Non-secret model selector. |
| `OPENAI_INTERPRETER_SEGMENT_MODEL` | `cloudrun.env.yaml` | Non-secret model selector. |
| `OPENAI_INTERPRETER_SEGMENT_TTS_MODEL` | `cloudrun.env.yaml` | Non-secret model selector. |
| `OPENAI_INTERPRETER_SEGMENT_TTS_VOICE` | `cloudrun.env.yaml` | Non-secret voice selector. |
| `OPENAI_INTERPRETER_SUMMARY_MODEL` | `cloudrun.env.yaml` | Non-secret model selector. |
| `OPENAI_INTERPRETER_SUMMARY_TTS_MODEL` | `cloudrun.env.yaml` | Non-secret model selector. |
| `OPENAI_INTERPRETER_SUMMARY_TTS_VOICE` | `cloudrun.env.yaml` | Non-secret voice selector. |
| `INTERPRETER_MAX_TARGET_LANGUAGES` | `cloudrun.env.yaml` | Non-secret product limit. |
| `INTERPRETER_RETENTION_DAYS` | `cloudrun.env.yaml` | Non-secret retention policy value. |
| `INTERPRETER_AUDIO_RETENTION` | `cloudrun.env.yaml` | Non-secret retention policy switch. |
| `INTERPRETER_SEGMENT_AUDIO_ENABLED` | `cloudrun.env.yaml` | Non-secret feature switch. |
| `INTERPRETER_SUMMARY_ENABLED` | `cloudrun.env.yaml` | Non-secret feature switch. |
| `INTERPRETER_SUMMARY_AUDIO_ENABLED` | `cloudrun.env.yaml` | Non-secret feature switch. |
| `INTERPRETER_REMINDER_WORKER_ENABLED` | `cloudrun.env.yaml` | Non-secret worker switch. |
| `INTERPRETER_REMINDER_WORKER_INTERVAL_MS` | `cloudrun.env.yaml` | Non-secret worker config. |
| `INTERPRETER_REMINDER_WORKER_BATCH_SIZE` | `cloudrun.env.yaml` | Non-secret worker config. |
| `INTERPRETER_REMINDER_WORKER_TENANT_BATCH_SIZE` | `cloudrun.env.yaml` | Non-secret worker config. |
| `APNS_BUNDLE_ID` | `cloudrun.env.yaml` | Non-secret app identifier. |
| `APNS_ENVIRONMENT` | `cloudrun.env.yaml` | Non-secret deployment mode. |
| `NODE_VERSION` | Not needed for Cloud Run. | The Dockerfile pins Node at build/runtime. |
| `VITE_*` keys | Web hosting/build environment, not backend Cloud Run. | These are client-facing web values and are not read by the backend service. |
| `VITE_SYNZAPP_API_URL` | Web/mobile client config, not backend Cloud Run. | Set it to the Cloud Run service URL after deploy. |

Create the backend secrets:

```bash
read -s OPENAI_API_KEY_VALUE
printf '%s' "$OPENAI_API_KEY_VALUE" | gcloud secrets create synzapp-openai-api-key --data-file=-
unset OPENAI_API_KEY_VALUE

openssl rand -base64 32 | gcloud secrets create synzapp-phone-hash-secret --data-file=-
openssl rand -base64 32 | gcloud secrets create synzapp-phone-encryption-secret --data-file=-

read -s APNS_TEAM_ID_VALUE
printf '%s' "$APNS_TEAM_ID_VALUE" | gcloud secrets create synzapp-apns-team-id --data-file=-
unset APNS_TEAM_ID_VALUE

read -s APNS_KEY_ID_VALUE
printf '%s' "$APNS_KEY_ID_VALUE" | gcloud secrets create synzapp-apns-key-id --data-file=-
unset APNS_KEY_ID_VALUE

gcloud secrets create synzapp-apns-auth-key --data-file=/absolute/path/to/AuthKey_XXXXXXXXXX.p8
```

Allow the Cloud Run service account to read those secrets:

```bash
for secret in \
  synzapp-openai-api-key \
  synzapp-phone-hash-secret \
  synzapp-phone-encryption-secret \
  synzapp-apns-team-id \
  synzapp-apns-key-id \
  synzapp-apns-auth-key
do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:$RUN_SA" \
    --role="roles/secretmanager.secretAccessor"
done
```

## Deploy

Prepare the non-secret environment file:

```bash
cd /Users/geraldnyah/Documents/MeetingIntelligence/SYNZAPP/backend
cp cloudrun.env.example.yaml cloudrun.env.yaml
```

Before production, edit `cloudrun.env.yaml`:

- Change `CORS_ORIGIN` from `*` to the deployed Synzapp web origin.
- Change `APNS_ENVIRONMENT` to `production` for production iOS builds.
- Set `SYNZAPP_REQUIRE_APP_CHECK=true` only after App Check is fully configured for web and mobile clients.

Deploy:

```bash
export PROJECT_ID="synzapp-a7ee3"
export REGION="us-central1"
export SERVICE_NAME="synzapp-backend"
export RUN_SA="synzapp-backend-run@$PROJECT_ID.iam.gserviceaccount.com"

gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --service-account "$RUN_SA" \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 3 \
  --cpu 1 \
  --memory 512Mi \
  --concurrency 80 \
  --timeout 3600 \
  --env-vars-file cloudrun.env.yaml \
  --set-secrets OPENAI_API_KEY=synzapp-openai-api-key:latest,PHONE_HASH_SECRET=synzapp-phone-hash-secret:latest,PHONE_ENCRYPTION_SECRET=synzapp-phone-encryption-secret:latest,APNS_TEAM_ID=synzapp-apns-team-id:latest,APNS_KEY_ID=synzapp-apns-key-id:latest,APNS_AUTH_KEY=synzapp-apns-auth-key:latest
```

After deploy, Cloud Run prints a service URL. Test it:

```bash
curl https://YOUR_CLOUD_RUN_URL/health
curl https://YOUR_CLOUD_RUN_URL/health/ready
```

## Update Synzapp Clients

Once Cloud Run is live, update the client API URLs:

- Web: `VITE_SYNZAPP_API_URL=https://YOUR_CLOUD_RUN_URL`
- Mobile: `EXPO_PUBLIC_SYNZAPP_API_URL=https://YOUR_CLOUD_RUN_URL`

Then rebuild mobile if the mobile app currently has the old backend URL baked into a release build.

## Production Hardening After The First Deploy

1. Replace `CORS_ORIGIN=*` with the exact web domain.
2. Turn on `SYNZAPP_REQUIRE_APP_CHECK=true`.
3. Move interpreter reminders to Cloud Scheduler or Cloud Run Jobs.
4. Add uptime checks for `/health/ready`.
5. Add alerting for 5xx rate, latency, instance count, and rejected OpenAI/APNs requests.
6. Review Cloud Run logs before switching mobile production traffic.
7. Cap max instances while testing cost, then raise only after load testing.

## Official References

- Cloud Run pricing and free tier: https://cloud.google.com/run/pricing
- Cloud Run source deployments: https://cloud.google.com/run/docs/deploying-source-code
- Cloud Run environment variables: https://cloud.google.com/run/docs/configuring/services/environment-variables
- Cloud Run secrets from Secret Manager: https://cloud.google.com/run/docs/configuring/services/secrets
- Cloud Run request timeout: https://cloud.google.com/run/docs/configuring/request-timeout
- Cloud Run WebSockets: https://cloud.google.com/run/docs/triggering/websockets
- Secret Manager: https://cloud.google.com/security/products/secret-manager
