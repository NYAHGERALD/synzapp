import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { validateContactInput } from '../src/services/contactIntakeService.ts';

const service = readFileSync(
  new URL('../src/services/contactIntakeService.ts', import.meta.url),
  'utf8'
);
const routes = readFileSync(
  new URL('../src/routes/contactRoutes.ts', import.meta.url),
  'utf8'
);

describe('the public form tells people what is wrong', () => {
  const valid = {
    email: 'someone@example.com',
    message: 'We are evaluating Synzapp for our support team and have questions.',
    name: 'Amara Obi',
    subject: 'Evaluation questions'
  };

  it('accepts a complete message', () => {
    assert.equal(validateContactInput(valid), null);
  });

  it('asks for a name', () => {
    assert.match(validateContactInput({ ...valid, name: '  ' }) || '', /your name/i);
  });

  it('asks for a usable address', () => {
    assert.match(validateContactInput({ ...valid, email: 'not-an-address' }) || '', /reply to/i);
  });

  it('accepts unusual but real addresses', () => {
    // A stricter pattern rejects genuine addresses, and the cost of that is an
    // enquiry nobody ever receives.
    for (const email of ['a+tag@sub.example.co.uk', "o'brien@example.com", 'x@y.io']) {
      assert.equal(validateContactInput({ ...valid, email }), null, email);
    }
  });

  it('accepts a short question', () => {
    // "how far" was rejected by a ten-character minimum, after the person had
    // already pressed send. Somebody with a brief question is still a customer.
    for (const message of ['how far', 'Pricing?', 'Is it GDPR ready']) {
      assert.equal(validateContactInput({ ...valid, message }), null, message);
    }
  });

  it('still refuses an empty message', () => {
    assert.match(validateContactInput({ ...valid, message: '   ' }) || '', /write your message/i);
  });
});

describe('the public form cannot be used to read anything', () => {
  it('nothing lists public enquiries', () => {
    // A form that can also read its own collection becomes a way to harvest
    // everyone else's enquiries.
    assert.doesNotMatch(service, /where\('kind', '==', 'PUBLIC_ENQUIRY'\)/);
  });

  it('the acknowledgement gives nothing away', () => {
    // A response that varied by outcome would let somebody probe what we hold.
    assert.match(routes, /res\.status\(202\)\.json\(\{ received: true \}\)/);
  });

  it('is rate limited by connection', () => {
    assert.match(routes, /publicContactLimiter/);
    assert.match(routes, /getClientIp/);
  });

  it('bounds what it stores', () => {
    // An unbounded field on a public form runs up somebody else's storage bill.
    assert.match(service, /\.slice\(0, 5000\)/);
  });
});

describe('support requests cannot be raised for another company', () => {
  it('takes the organization from the session, not the form', () => {
    assert.match(routes, /tenantId: session\.user\.tenantId/);
    assert.doesNotMatch(routes, /tenantId: body\./);
  });

  it('refuses a session that is not active', () => {
    assert.match(routes, /session\.access !== 'ACTIVE'/);
  });

  it('only ever lists one organization\'s own requests', () => {
    assert.match(service, /where\('tenantId', '==', tenantId\)/);
  });

  it('records that a request was raised', () => {
    assert.match(routes, /SUPPORT_REQUEST_RAISED/);
  });
});
