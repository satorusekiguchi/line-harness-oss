/**
 * EC Tracking Endpoints
 *
 * GET  /track            — pixel tracking (1x1 GIF, embed as <img> in EC site)
 * POST /api/track/ec     — JSON tracking (fetch() from EC site JS)
 * POST /api/track/purchase — EC purchase webhook (Shopify / custom EC)
 *
 * All endpoints look up the friend by LINE UUID (`uid`) passed from the EC site.
 * The EC site obtains the UUID via LIFF or the /auth/line OAuth flow.
 */

import { Hono } from 'hono';
import type { Env } from '../index.js';
import { jstNow } from '@line-crm/db';
import { fireEvent } from '../services/event-bus.js';

const tracking = new Hono<Env>();

// ── helpers ─────────────────────────────────────────────────────────────────

/** Look up friend by LINE UUID (user_id stored in friends.user_id) */
async function friendByUid(db: D1Database, uid: string) {
  return db
    .prepare(`SELECT * FROM friends WHERE user_id = ? LIMIT 1`)
    .bind(uid)
    .first<{ id: string; line_user_id: string; display_name: string | null; is_following: number }>();
}

/** Look up conversion_point by event_type */
async function pointByType(db: D1Database, eventType: string) {
  return db
    .prepare(`SELECT * FROM conversion_points WHERE event_type = ? LIMIT 1`)
    .bind(eventType)
    .first<{ id: string; name: string; event_type: string; value: number | null }>();
}

/** Record a conversion event */
async function record(
  db: D1Database,
  opts: {
    conversionPointId: string;
    friendId: string;
    userId?: string | null;
    affiliateCode?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO conversion_events
         (id, conversion_point_id, friend_id, user_id, affiliate_code, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      opts.conversionPointId,
      opts.friendId,
      opts.userId ?? null,
      opts.affiliateCode ?? null,
      opts.metadata ? JSON.stringify(opts.metadata) : null,
      jstNow(),
    )
    .run();
  return id;
}

// 1x1 transparent GIF bytes
const PIXEL_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

// ── GET /track — pixel tracking ─────────────────────────────────────────────
// ECサイトに <img> タグで埋め込む。ブラウザが画像を読み込むだけでCV計測される。
// Usage: <img src="https://worker.../track?cp=product_view&uid=UUID" style="display:none" />

tracking.get('/track', async (c) => {
  const cp = c.req.query('cp');   // event_type e.g. "product_view"
  const uid = c.req.query('uid'); // LINE UUID from LIFF/auth
  const ref = c.req.query('ref'); // optional reference
  const aff = c.req.query('aff'); // optional affiliate code
  const val = c.req.query('val'); // optional override value (for purchase)

  // Always return the pixel — never block page load
  const respond = () =>
    new Response(PIXEL_GIF, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        // Allow embedding from EC site domains
        'Access-Control-Allow-Origin': '*',
      },
    });

  if (!cp || !uid) return respond();

  try {
    const [friend, point] = await Promise.all([
      friendByUid(c.env.DB, uid),
      pointByType(c.env.DB, cp),
    ]);

    if (!friend || !point) return respond();

    const metadata: Record<string, unknown> = {};
    if (ref) metadata.ref = ref;
    if (val) metadata.value_override = Number(val);
    metadata.user_agent = c.req.header('user-agent') ?? '';
    metadata.source = 'pixel';

    // Update conversion point value if val is provided (e.g. actual purchase amount)
    const convPointId = point.id;
    if (val && (cp === 'purchase' || cp === 'coupon_used')) {
      metadata.revenue = Number(val);
    }

    await record(c.env.DB, {
      conversionPointId: convPointId,
      friendId: friend.id,
      userId: uid,
      affiliateCode: aff ?? null,
      metadata,
    });

    // オートメーションをトリガー（エラーはページロードをブロックしない）
    void fireEvent(c.env.DB, 'cv_fire', {
      friendId: friend.id,
      eventData: { cv_event_type: cp, source: 'pixel', ref, value: val ? Number(val) : undefined },
    }).catch(e => console.error('/track fireEvent error:', e));
  } catch (err) {
    console.error('/track pixel error:', err);
  }

  return respond();
});

// ── POST /api/track/ec — JSON tracking ──────────────────────────────────────
// ECサイトから fetch() で呼び出す。uid でフレンドを特定してCV記録。
// Body: { eventType, uid, value?, affiliateCode?, metadata? }

tracking.post('/api/track/ec', async (c) => {
  try {
    const body = await c.req.json<{
      eventType: string;
      uid: string;
      value?: number | null;
      affiliateCode?: string | null;
      metadata?: Record<string, unknown> | null;
    }>();

    if (!body.eventType || !body.uid) {
      return c.json({ success: false, error: 'eventType and uid are required' }, 400);
    }

    const [friend, point] = await Promise.all([
      friendByUid(c.env.DB, body.uid),
      pointByType(c.env.DB, body.eventType),
    ]);

    if (!friend) return c.json({ success: false, error: 'friend not found' }, 404);
    if (!point) return c.json({ success: false, error: 'conversion point not found for event type' }, 404);

    const meta: Record<string, unknown> = { ...(body.metadata ?? {}), source: 'api' };
    if (body.value != null) meta.revenue = body.value;

    const eventId = await record(c.env.DB, {
      conversionPointId: point.id,
      friendId: friend.id,
      userId: body.uid,
      affiliateCode: body.affiliateCode ?? null,
      metadata: meta,
    });

    // オートメーションをトリガー
    void fireEvent(c.env.DB, 'cv_fire', {
      friendId: friend.id,
      eventData: { cv_event_type: body.eventType, source: 'api', value: body.value },
    }).catch(e => console.error('/api/track/ec fireEvent error:', e));

    return c.json({
      success: true,
      data: { id: eventId, eventType: body.eventType, friendId: friend.id },
    }, 201);
  } catch (err) {
    console.error('POST /api/track/ec error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ── POST /api/track/purchase — EC purchase webhook ──────────────────────────
// Shopify Order webhook または独自EC の購入完了通知を受け取る。
// Body: { uid, orderId, amount, couponCode?, affiliateCode?, items? }

tracking.post('/api/track/purchase', async (c) => {
  try {
    const body = await c.req.json<{
      uid: string;
      orderId: string;
      amount: number;
      couponCode?: string | null;
      affiliateCode?: string | null;
      items?: Array<{ name: string; quantity: number; price: number }> | null;
    }>();

    if (!body.uid || !body.orderId || body.amount == null) {
      return c.json({ success: false, error: 'uid, orderId, and amount are required' }, 400);
    }

    const friend = await friendByUid(c.env.DB, body.uid);
    if (!friend) return c.json({ success: false, error: 'friend not found' }, 404);

    const results: string[] = [];

    // 1. 購入完了CV
    const purchasePoint = await pointByType(c.env.DB, 'purchase');
    if (purchasePoint) {
      const id = await record(c.env.DB, {
        conversionPointId: purchasePoint.id,
        friendId: friend.id,
        userId: body.uid,
        affiliateCode: body.affiliateCode ?? null,
        metadata: {
          order_id: body.orderId,
          revenue: body.amount,
          items: body.items ?? [],
          source: 'purchase_webhook',
        },
      });
      results.push(id);
    }

    // 2. クーポン使用CV（クーポンコードが含まれている場合）
    if (body.couponCode) {
      const couponPoint = await pointByType(c.env.DB, 'coupon_used');
      if (couponPoint) {
        const id = await record(c.env.DB, {
          conversionPointId: couponPoint.id,
          friendId: friend.id,
          userId: body.uid,
          affiliateCode: body.affiliateCode ?? null,
          metadata: {
            order_id: body.orderId,
            coupon_code: body.couponCode,
            revenue: body.amount,
            source: 'purchase_webhook',
          },
        });
        results.push(id);
      }
    }

    // オートメーションをトリガー（purchase + 必要に応じて coupon_used）
    void Promise.allSettled([
      fireEvent(c.env.DB, 'cv_fire', {
        friendId: friend.id,
        eventData: {
          cv_event_type: 'purchase',
          order_id: body.orderId,
          revenue: body.amount,
          source: 'purchase_webhook',
        },
      }),
      ...(body.couponCode ? [
        fireEvent(c.env.DB, 'cv_fire', {
          friendId: friend.id,
          eventData: { cv_event_type: 'coupon_used', coupon_code: body.couponCode, source: 'purchase_webhook' },
        }),
      ] : []),
    ]).catch(e => console.error('/api/track/purchase fireEvent error:', e));

    return c.json({
      success: true,
      data: { eventIds: results, orderId: body.orderId, friendId: friend.id },
    }, 201);
  } catch (err) {
    console.error('POST /api/track/purchase error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export { tracking };
