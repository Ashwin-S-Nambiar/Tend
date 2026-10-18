import type { Env } from './device.ts';

export { Device } from './device.ts';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function cors(req: Request, env: Env) {
  const origin = req.headers.get('origin') ?? '';
  const allowed = env.ORIGINS.split(',').map((s) => s.trim());
  const h = new Headers({
    'access-control-allow-methods': 'PUT, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  });
  if (allowed.includes(origin)) h.set('access-control-allow-origin', origin);
  return h;
}

function json(body: unknown, status: number, headers: Headers) {
  headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(req: Request, env: Env) {
    const headers = cors(req, env);
    if (req.method === 'OPTIONS')
      return new Response(null, { status: 204, headers });
    const url = new URL(req.url);
    if (url.pathname === '/health') return json({ ok: true }, 200, headers);
    const [, route, id] = url.pathname.split('/');
    if (!route || !id || !ID.test(id))
      return json({ error: 'not found' }, 404, headers);
    const device = env.DEVICE.get(env.DEVICE.idFromName(id));
    const body =
      req.method === 'DELETE'
        ? {}
        : ((await req.json().catch(() => ({}))) as Record<string, unknown>);

    if (route === 'plan' && req.method === 'PUT') {
      const sub = body.subscription as
        | { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
        | undefined;
      if (
        !sub?.endpoint?.startsWith('https://') ||
        !sub.keys?.p256dh ||
        !sub.keys.auth
      )
        return json({ error: 'bad subscription' }, 400, headers);
      const items = Array.isArray(body.items)
        ? (body.items as { key: string; at: number }[])
        : [];
      const logged = Array.isArray(body.logged)
        ? (body.logged as string[]).filter((k) => KEY.test(k))
        : [];
      const count = await device.plan(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        },
        items.filter((i) => KEY.test(i.key)),
        logged,
        id,
        url.origin,
      );
      return json({ ok: true, count }, 200, headers);
    }
    if (route === 'plan' && req.method === 'DELETE') {
      await device.clear();
      return json({ ok: true }, 200, headers);
    }
    const key =
      typeof body.key === 'string' && KEY.test(body.key) ? body.key : null;
    if (route === 'mark' && req.method === 'POST' && key) {
      await device.mark(key);
      return json({ ok: true }, 200, headers);
    }
    if (route === 'snooze' && req.method === 'POST' && key) {
      await device.snooze(key);
      return json({ ok: true }, 200, headers);
    }
    return json({ error: 'not found' }, 404, headers);
  },
} satisfies ExportedHandler<Env>;
