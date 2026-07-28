import 'dotenv/config';

const openAiApiKey = process.env.OPENAI_API_KEY;
const realtimeModel = process.env.OPENAI_INTERPRETER_REALTIME_MODEL || 'gpt-realtime-translate';
const targetLanguage = process.argv[2] || 'es';

if (!openAiApiKey) {
  console.error('OPENAI_API_KEY is not configured.');
  process.exit(1);
}

const safetyIdentifier = 'synzapp-interpreter-local-diagnostic';

const secretResponse = await fetch('https://api.openai.com/v1/realtime/translations/client_secrets', {
  body: JSON.stringify({
    session: {
      audio: {
        output: {
          language: targetLanguage
        }
      },
      model: realtimeModel
    }
  }),
  headers: {
    Authorization: `Bearer ${openAiApiKey}`,
    'Content-Type': 'application/json',
    'OpenAI-Safety-Identifier': safetyIdentifier
  },
  method: 'POST'
});
const secretBody = await secretResponse.text();
const secretJson = safeJson(secretBody);
const clientSecret = extractClientSecret(secretJson);

console.log(JSON.stringify({
  clientSecretCreated: Boolean(clientSecret),
  model: realtimeModel,
  step: 'client_secret',
  status: secretResponse.status,
  targetLanguage
}, null, 2));

if (!clientSecret) {
  console.log(JSON.stringify({
    providerMessage: getProviderMessage(secretBody),
    step: 'client_secret_error'
  }, null, 2));
  process.exit(1);
}

const sdpResponse = await fetch('https://api.openai.com/v1/realtime/translations/calls', {
  body: getDiagnosticRealtimeOfferSdp(),
  headers: {
    Authorization: `Bearer ${clientSecret}`,
    'Content-Type': 'application/sdp',
    'OpenAI-Safety-Identifier': safetyIdentifier
  },
  method: 'POST'
});
const sdpBody = await sdpResponse.text();
const credentialAccepted = sdpResponse.status === 400 &&
  /invalid.*sdp|invalid.*offer|invalid_offer/i.test(sdpBody);

console.log(JSON.stringify({
  credentialAccepted,
  expectedInvalidOfferResponse: credentialAccepted,
  providerMessage: credentialAccepted
    ? 'Realtime credential was accepted. The diagnostic SDP was rejected as expected.'
    : getProviderMessage(sdpBody),
  step: 'sdp_exchange',
  status: sdpResponse.status
}, null, 2));

process.exit(credentialAccepted ? 0 : 1);

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractClientSecret(response) {
  if (!response || typeof response !== 'object') {
    return null;
  }

  if (typeof response.value === 'string') {
    return response.value;
  }

  if (typeof response.client_secret === 'string') {
    return response.client_secret;
  }

  if (
    response.client_secret &&
    typeof response.client_secret === 'object' &&
    typeof response.client_secret.value === 'string'
  ) {
    return response.client_secret.value;
  }

  return null;
}

function getProviderMessage(responseBody) {
  const parsed = safeJson(responseBody);
  const message = parsed?.error?.message;

  return typeof message === 'string' ? message : responseBody.slice(0, 240);
}

function getDiagnosticRealtimeOfferSdp() {
  return [
    'v=0',
    'o=- 46117317 2 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'm=audio 9 UDP/TLS/RTP/SAVPF 111',
    'c=IN IP4 0.0.0.0',
    'a=rtpmap:111 opus/48000/2',
    ''
  ].join('\r\n');
}
