# Letting the browser upload straight to storage

Evidence files no longer travel through the API. The browser asks for a signed
URL and `PUT`s the file to Cloud Storage itself, which is the only way a file
larger than a request body can be sent at all.

A browser will not make that request until the bucket says it may. The mobile
app never needed this — CORS is a browser rule — which is why action
attachments have reached 50 MB for a long time without it.

## Applying it

```bash
gcloud storage buckets update gs://synzapp-a7ee3.firebasestorage.app \
  --cors-file=backend/storage-cors.json
```

Check what is set:

```bash
gcloud storage buckets describe gs://synzapp-a7ee3.firebasestorage.app \
  --format="default(cors_config)"
```

## What it allows, and what it does not

`PUT` and the `OPTIONS` preflight before it, from the listed origins only.
Nothing is opened for reading: downloads still go through the API, which checks
who is asking. A wildcard origin would let any website on the internet use a
signed URL it somehow obtained, so the list is explicit.

Add a production domain here when one is pointed at the app, or uploads from it
will fail with a CORS error and no other symptom.
