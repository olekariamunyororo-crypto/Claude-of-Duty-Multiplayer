import crypto from 'node:crypto';
const DEV = process.env.DEV_AUTH === '1';
const SECRET = process.env.GUEST_SECRET || crypto.randomBytes(32).toString('hex');
const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
const clean = (n) => String(n || '').replace(/[^\w \-]/g, '').trim().slice(0, 20) || 'player';

export async function verify(token) {
  if (typeof token !== 'string' || token.length > 300) throw new Error('bad token');
  if (DEV && token.startsWith('dev:')) {
    const name = clean(token.slice(4));
    return { sub: 'dev-' + name, name };
  }
  if (token.startsWith('guest:new:')) {
    const sub = 'g-' + crypto.randomUUID();
    return { sub, name: clean(token.slice(10)), cred: sub + '.' + sign(sub) };
  }
  if (token.startsWith('guest:cred:')) {
    const [cred, ...rest] = token.slice(11).split(':');
    const [sub, sig] = cred.split('.');
    const good = sub && sig ? sign(sub) : '';
    if (!good || sig.length !== good.length ||
        !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) throw new Error('bad cred');
    return { sub, name: clean(rest.join(':')) };
  }
  throw new Error('unsupported login');
}
