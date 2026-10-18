import assert from 'node:assert/strict';
import { test } from 'node:test';
import { b64u, encrypt, unb64u, vapidHeader } from '../src/push.ts';

test('matches the RFC 8291 example', async () => {
  const body = await encrypt(
    'When I grow up, I want to be a watermelon',
    {
      endpoint:
        'https://push.example.net/push/JzLQ3raZJfFBR0aqvOMsLrt54w4rJUsV',
      keys: {
        p256dh:
          'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
        auth: 'BTBZMqHH6r4Tts7J_aSIgg',
      },
    },
    {
      asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
      asPublic:
        'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
      salt: 'DGv6ra1nlYgDCS1FRnbzlw',
    },
  );
  assert.equal(
    b64u(body),
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
  );
});

test('VAPID tokens verify with the public key', async () => {
  const pair = (await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const raw = new Uint8Array(
    (await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer,
  );
  const jwk = (await crypto.subtle.exportKey(
    'jwk',
    pair.privateKey,
  )) as JsonWebKey;
  const header = await vapidHeader('https://fcm.googleapis.com/fcm/send/abc', {
    publicKey: b64u(raw),
    privateJwk: jwk,
    subject: 'https://tend.ashwin.co.in',
  });
  const token = header.match(/t=([^,]+)/)?.[1] ?? '';
  const [h, b, s] = token.split('.');
  const claims = JSON.parse(new TextDecoder().decode(unb64u(b ?? '')));
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    pair.publicKey,
    unb64u(s ?? ''),
    new TextEncoder().encode(`${h}.${b}`),
  );
  assert.ok(ok);
  assert.match(header, new RegExp(`k=${b64u(raw)}$`));
});
