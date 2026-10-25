import { mintEventId } from './pixel';

/**
 * This browser's device id for the store's fake-order guard (myapp
 * App\Support\OrderDeviceGuard): one order per device until the store has
 * handled it, and the orders list's "Block device". Keyed on the DEVICE,
 * never the IP — in Bangladesh one IP is shared by many shoppers.
 *
 * Minted once, kept in localStorage AND a first-party cookie, each restoring
 * the other — clearing one of the two keeps the id. Same origin for the shop
 * and its funnels, so both order forms send the same id. Random, nothing
 * about the device in it; a private window or another browser is another
 * device (the guard says as much — it raises the cost of fake orders, it is
 * no identity check).
 *
 * Never throws: storage or cookies blocked → a per-page id (the guard then
 * sees a new device each load, which only means it does not hold that
 * shopper back).
 */
const STORAGE_KEY = 'replybd:device';
const COOKIE = 'rbd_dev';
/** What the API accepts (OrderDeviceGuard::deviceId). */
const VALID = /^[A-Za-z0-9_-]{8,64}$/;

let pageId: string | null = null;

function readCookie(): string | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)rbd_dev=([^;]+)/);
    const v = m ? decodeURIComponent(m[1]) : null;
    return v && VALID.test(v) ? v : null;
  } catch {
    return null;
  }
}

function writeCookie(id: string): void {
  try {
    // Two years; Lax — it is only read by this page's own script.
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE}=${encodeURIComponent(id)}; Max-Age=63072000; Path=/; SameSite=Lax${secure}`;
  } catch {
    /* cookies blocked */
  }
}

export function deviceId(): string {
  if (typeof window === 'undefined') return '';
  let stored: string | null = null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    stored = v && VALID.test(v) ? v : null;
  } catch {
    /* storage blocked */
  }
  const id = stored ?? readCookie() ?? pageId ?? mintEventId().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  pageId = id;
  try {
    if (stored !== id) localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* storage blocked */
  }
  if (readCookie() !== id) writeCookie(id);
  return id;
}
