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
const pub = Buffer.from(raw).toString('base64url');
console.log(`VAPID_PUBLIC=${pub}`);
console.log(
  `VAPID_PRIVATE=${JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d })}`,
);

export {};
