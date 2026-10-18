import { DurableObject } from 'cloudflare:workers';
import { type Subscription, send } from './push.ts';

export type Env = {
  DEVICE: DurableObjectNamespace<Device>;
  ORIGINS: string;
  VAPID_PUBLIC: string;
  VAPID_PRIVATE: string;
  VAPID_SUBJECT: string;
};

export type Item = { key: string; at: number; follow: 0 | 1 };

const FOLLOW_MS = 30 * 60_000;
const SNOOZE_MS = 10 * 60_000;
const MAX_ITEMS = 300;

export class Device extends DurableObject<Env> {
  private sub() {
    return this.ctx.storage.kv.get<Subscription>('sub');
  }

  private items() {
    return this.ctx.storage.kv.get<Item[]>('items') ?? [];
  }

  private async save(items: Item[]) {
    const sorted = items.sort((a, b) => a.at - b.at).slice(0, MAX_ITEMS);
    this.ctx.storage.kv.put('items', sorted);
    const first = sorted[0];
    if (first) await this.ctx.storage.setAlarm(first.at);
    else await this.ctx.storage.deleteAlarm();
  }

  async plan(
    sub: Subscription,
    items: { key: string; at: number }[],
    logged: string[],
    device: string,
    api: string,
  ) {
    this.ctx.storage.kv.put('sub', sub);
    this.ctx.storage.kv.put('device', device);
    this.ctx.storage.kv.put('api', api);
    const now = Date.now();
    const keep = this.items().filter(
      (i) => i.follow && !logged.includes(i.key) && i.at > now,
    );
    const fresh: Item[] = items
      .filter(
        (i) =>
          typeof i.key === 'string' &&
          Number.isFinite(i.at) &&
          i.at > now - 60_000,
      )
      .map((i) => ({ key: i.key, at: i.at, follow: 0 }));
    await this.save([
      ...keep,
      ...fresh.filter((f) => !keep.some((k) => k.key === f.key)),
    ]);
    return this.items().length;
  }

  async mark(key: string) {
    await this.save(
      this.items().filter(
        (i) => !(i.key === key && (i.follow || i.at > Date.now())),
      ),
    );
  }

  async snooze(key: string) {
    const rest = this.items().filter((i) => i.key !== key);
    await this.save([...rest, { key, at: Date.now() + SNOOZE_MS, follow: 0 }]);
  }

  async clear() {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  override async alarm() {
    const sub = this.sub();
    if (!sub) return this.clear();
    const now = Date.now();
    const items = this.items();
    const due = items.filter((i) => i.at <= now + 1000);
    const later = items.filter((i) => i.at > now + 1000);
    const device = this.ctx.storage.kv.get<string>('device');
    const api = this.ctx.storage.kv.get<string>('api');
    const vapid = {
      publicKey: this.env.VAPID_PUBLIC,
      privateJwk: JSON.parse(this.env.VAPID_PRIVATE) as JsonWebKey,
      subject: this.env.VAPID_SUBJECT,
    };
    const next: Item[] = [...later];
    for (const item of due) {
      const last = later.filter((i) => !i.follow).length === 0 && !item.follow;
      const res = await send(
        sub,
        { key: item.key, follow: item.follow, device, api, last: last ? 1 : 0 },
        vapid,
      );
      if (res.status === 404 || res.status === 410) return this.clear();
      if (!res.ok && res.status >= 500)
        throw new Error(`push service ${res.status}`);
      if (!item.follow)
        next.push({ key: item.key, at: item.at + FOLLOW_MS, follow: 1 });
    }
    await this.save(next.filter((i) => i.at > now));
  }
}
