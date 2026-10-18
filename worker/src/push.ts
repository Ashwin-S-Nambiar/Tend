const enc = new TextEncoder();

export function b64u(bytes: ArrayBuffer | Uint8Array) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64u(s: string) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}

async function hmac(key: Uint8Array, data: Uint8Array) {
  const k = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

function publicJwk(raw: Uint8Array): JsonWebKey {
  return {
    kty: 'EC',
    crv: 'P-256',
    x: b64u(raw.slice(1, 33)),
    y: b64u(raw.slice(33, 65)),
    ext: true,
  };
}

export type Subscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function encrypt(
  payload: string,
  sub: Subscription,
  fixed?: { asPrivate: string; asPublic: string; salt: string },
) {
  const uaPublic = unb64u(sub.keys.p256dh);
  const auth = unb64u(sub.keys.auth);
  let asPublic: Uint8Array;
  let asKey: CryptoKey;
  if (fixed) {
    asPublic = unb64u(fixed.asPublic);
    asKey = await crypto.subtle.importKey(
      'jwk',
      { ...publicJwk(asPublic), d: fixed.asPrivate },
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits'],
    );
  } else {
    const pair = (await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    )) as CryptoKeyPair;
    asKey = pair.privateKey;
    asPublic = new Uint8Array(
      (await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer,
    );
  }
  const salt = fixed
    ? unb64u(fixed.salt)
    : crypto.getRandomValues(new Uint8Array(16));
  const ua = await crypto.subtle.importKey(
    'raw',
    uaPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: ua } as unknown as SubtleCryptoDeriveKeyAlgorithm,
      asKey,
      256,
    ),
  );

  const prkKey = await hmac(auth, shared);
  const ikm = await hmac(
    prkKey,
    concat(
      enc.encode('WebPush: info\0'),
      uaPublic,
      asPublic,
      new Uint8Array([1]),
    ),
  );
  const prk = await hmac(salt, ikm);
  const cek = (
    await hmac(
      prk,
      concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])),
    )
  ).slice(0, 16);
  const nonce = (
    await hmac(
      prk,
      concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])),
    )
  ).slice(0, 12);

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, [
    'encrypt',
  ]);
  const plain = concat(enc.encode(payload), new Uint8Array([2]));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

export type Vapid = {
  publicKey: string;
  privateJwk: JsonWebKey;
  subject: string;
};

const jwtCache = new Map<string, { token: string; until: number }>();

export async function vapidHeader(
  endpoint: string,
  v: Vapid,
  now = Date.now(),
) {
  const aud = new URL(endpoint).origin;
  const hit = jwtCache.get(aud);
  if (hit && hit.until > now + 60_000)
    return `vapid t=${hit.token}, k=${v.publicKey}`;
  const exp = Math.floor(now / 1000) + 12 * 3600;
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud, exp, sub: v.subject })));
  const key = await crypto.subtle.importKey(
    'jwk',
    v.privateJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    enc.encode(`${head}.${body}`),
  );
  const token = `${head}.${body}.${b64u(sig)}`;
  jwtCache.set(aud, { token, until: exp * 1000 });
  return `vapid t=${token}, k=${v.publicKey}`;
}

export async function send(
  sub: Subscription,
  payload: object,
  v: Vapid,
  ttl = 3600,
) {
  const body = await encrypt(JSON.stringify(payload), sub);
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      authorization: await vapidHeader(sub.endpoint, v),
      'content-encoding': 'aes128gcm',
      'content-type': 'application/octet-stream',
      ttl: String(ttl),
      urgency: 'high',
    },
    body,
  });
}
