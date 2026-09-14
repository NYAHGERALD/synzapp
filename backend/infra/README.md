# API edge infrastructure

Configuration for the HTTPS load balancer and Cloud Armor policy in front of
`synzapp-backend`. **None of this is applied.** The plan and the reasoning are
in `SYNZAPP_API_EDGE_SECURITY_PLAN.md` at the repo root.

## Why a load balancer and not an API Gateway

GCP's API Gateway does not pass WebSocket upgrades, and this service runs three
WebSocket servers — chat, calls and RCA realtime. A load balancer passes them,
and is the supported way to put Cloud Armor in front of Cloud Run.

## Before anything is run

Two APIs are disabled on the project and must be enabled first:

```bash
gcloud services enable compute.googleapis.com certificatemanager.googleapis.com \
  --project synzapp-a7ee3
```

This starts billing for the forwarding rule (roughly $18/month) plus Cloud Armor
policy and rule charges. It is a spending decision, not a deployment step.

## Applying it

```bash
# 1. A serverless NEG pointing at the existing Cloud Run service.
gcloud compute network-endpoint-groups create synzapp-api-neg \
  --region=us-central1 --network-endpoint-type=serverless \
  --cloud-run-service=synzapp-backend --project synzapp-a7ee3

# 2. The Cloud Armor policy, from the file beside this one.
gcloud compute security-policies create synzapp-api-edge \
  --project synzapp-a7ee3
gcloud compute security-policies import synzapp-api-edge \
  --source=cloud-armor-policy.yaml --project synzapp-a7ee3

# 3. A backend service carrying the policy.
gcloud compute backend-services create synzapp-api-backend \
  --global --load-balancing-scheme=EXTERNAL_MANAGED \
  --security-policy=synzapp-api-edge --project synzapp-a7ee3
gcloud compute backend-services add-backend synzapp-api-backend \
  --global --network-endpoint-group=synzapp-api-neg \
  --network-endpoint-group-region=us-central1 --project synzapp-a7ee3

# 4. A managed certificate for the API hostname.
gcloud compute ssl-certificates create synzapp-api-cert \
  --domains=api.synzapp.com --global --project synzapp-a7ee3

# 5. Address, proxy and forwarding rule.
gcloud compute addresses create synzapp-api-ip --global --project synzapp-a7ee3
gcloud compute url-maps create synzapp-api-map \
  --default-service synzapp-api-backend --global --project synzapp-a7ee3
gcloud compute target-https-proxies create synzapp-api-proxy \
  --url-map=synzapp-api-map --ssl-certificates=synzapp-api-cert \
  --global --project synzapp-a7ee3
gcloud compute forwarding-rules create synzapp-api-forwarding \
  --global --target-https-proxy=synzapp-api-proxy --ports=443 \
  --address=synzapp-api-ip --load-balancing-scheme=EXTERNAL_MANAGED \
  --project synzapp-a7ee3
```

Then create an **A record** for `api.synzapp.com` pointing at the reserved
address, and wait for the certificate to report ACTIVE. Only the domain owner
can do this.

## Verifying, before anything depends on it

The certificate serving is not the test. The test is a WebSocket upgrade, because
that is what an API Gateway would have broken and what the product needs:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://api.synzapp.com/api/rca/knowledge/ask   # expect 401
curl -sS -i -N -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
  -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
  https://api.synzapp.com/ | head -1   # expect 101, not 400 or 426
```

## Closing the direct route, last

Only once the above serves traffic, and only once both client defaults point at
`api.synzapp.com` and any mobile build carrying the `run.app` URL has aged out:

```bash
gcloud run services update synzapp-backend --region us-central1 \
  --ingress internal-and-cloud-load-balancing --project synzapp-a7ee3
```

Run out of order, this takes the product offline. A phone still on an older
build loses chat the moment it lands.
