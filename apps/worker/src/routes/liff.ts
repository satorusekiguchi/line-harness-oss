import { Hono } from 'hono';
import {
  getFriendByLineUserId,
  createUser,
  getUserByEmail,
  linkFriendToUser,
  upsertFriend,
  getEntryRouteByRefCode,
  recordRefTracking,
  addTagToFriend,
  getLineAccountByChannelId,
  getLineAccounts,
  jstNow,
} from '@line-crm/db';
import type { Env } from '../index.js';

const liffRoutes = new Hono<Env>();

// ─── LINE Login OAuth (bot_prompt=aggressive) ───────────────────

/**
 * GET /auth/line — redirect to LINE Login with bot_prompt=aggressive
 *
 * This is THE friend-add URL. Put this on LPs, SNS, ads.
 * Query params:
 *   ?ref=xxx     — attribution tracking
 *   ?redirect=url — redirect after completion
 *   ?gclid=xxx   — Google Ads click ID
 *   ?fbclid=xxx  — Meta Ads click ID
 *   ?utm_source=xxx, utm_medium, utm_campaign, utm_content, utm_term — UTM params
 */
liffRoutes.get('/auth/line', async (c) => {
  const ref = c.req.query('ref') || '';
  const redirect = c.req.query('redirect') || '';
  const gclid = c.req.query('gclid') || '';
  const fbclid = c.req.query('fbclid') || '';
  const utmSource = c.req.query('utm_source') || '';
  const utmMedium = c.req.query('utm_medium') || '';
  const utmCampaign = c.req.query('utm_campaign') || '';
  const accountParam = c.req.query('account') || '';
  const uidParam = c.req.query('uid') || ''; // existing user UUID for cross-account linking
  const baseUrl = new URL(c.req.url).origin;

  // Multi-account: resolve LINE Login channel + LIFF from DB if account param provided
  let channelId = c.env.LINE_LOGIN_CHANNEL_ID;
  let liffUrl = c.env.LIFF_URL || '';
  if (accountParam) {
    const account = await getLineAccountByChannelId(c.env.DB, accountParam);
    if (account?.login_channel_id) {
      channelId = account.login_channel_id;
    }
    if (account?.liff_id) {
      liffUrl = `https://liff.line.me/${account.liff_id}`;
    }
  }
  const callbackUrl = `${baseUrl}/auth/callback`;

  // Build OAuth URL (for desktop fallback)
  // Pack all tracking params into state so they survive the OAuth redirect
  const state = JSON.stringify({ ref, redirect, gclid, fbclid, utmSource, utmMedium, utmCampaign, account: accountParam, uid: uidParam });
  const encodedState = btoa(state);
  const loginUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');
  loginUrl.searchParams.set('response_type', 'code');
  loginUrl.searchParams.set('client_id', channelId);
  loginUrl.searchParams.set('redirect_uri', callbackUrl);
  loginUrl.searchParams.set('scope', 'profile openid email');
  loginUrl.searchParams.set('bot_prompt', 'aggressive');
  loginUrl.searchParams.set('state', encodedState);

  // LIFF_URL が未設定の場合は OAuth フローに直接リダイレクト
  if (!liffUrl) {
    return c.redirect(loginUrl.toString());
  }

  // Build LIFF URL with ref + ad params (for mobile → LINE app)
  const liffIdMatch = liffUrl.match(/liff\.line\.me\/([0-9]+-[A-Za-z0-9]+)/);
  const liffParams = new URLSearchParams();
  if (liffIdMatch) liffParams.set('liffId', liffIdMatch[1]);
  if (ref) liffParams.set('ref', ref);
  if (redirect) liffParams.set('redirect', redirect);
  if (gclid) liffParams.set('gclid', gclid);
  if (fbclid) liffParams.set('fbclid', fbclid);
  if (utmSource) liffParams.set('utm_source', utmSource);
  const liffTarget = liffParams.toString()
    ? `${liffUrl}?${liffParams.toString()}`
    : liffUrl;

  // Build LIFF URL with params (opens LINE app directly on mobile + QR on PC)
  const qrParams = new URLSearchParams();
  if (ref) qrParams.set('ref', ref);
  if (uidParam) qrParams.set('uid', uidParam);
  if (accountParam) qrParams.set('account', accountParam);
  const qrUrl = qrParams.toString() ? `${liffUrl}?${qrParams.toString()}` : liffUrl;

  // Mobile: redirect to LIFF URL (opens LINE app directly)
  // Exception: cross-account links (account param) use OAuth directly
  // because Account A's LIFF can't open from Account B's LINE chat
  const ua = (c.req.header('user-agent') || '').toLowerCase();
  const isMobile = /iphone|ipad|android|mobile/.test(ua);
  if (isMobile) {
    if (accountParam) {
      // Cross-account: use OAuth (LIFF won't work across accounts)
      return c.redirect(loginUrl.toString());
    }
    return c.redirect(qrUrl);
  }

  // PC: show QR code page
  return c.html(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LINE で友だち追加</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Hiragino Sans', system-ui, sans-serif; background: #0d1117; color: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 48px; text-align: center; max-width: 480px; width: 90%; }
    h1 { font-size: 24px; font-weight: 800; margin-bottom: 8px; }
    .sub { font-size: 14px; color: rgba(255,255,255,0.5); margin-bottom: 32px; }
    .qr { background: #fff; border-radius: 16px; padding: 24px; display: inline-block; margin-bottom: 24px; }
    .qr img { display: block; width: 240px; height: 240px; }
    .hint { font-size: 13px; color: rgba(255,255,255,0.4); line-height: 1.6; }
    .badge { display: inline-block; margin-top: 24px; padding: 8px 20px; border-radius: 20px; font-size: 12px; font-weight: 600; color: #06C755; background: rgba(6,199,85,0.1); border: 1px solid rgba(6,199,85,0.2); }
  </style>
</head>
<body>
  <div class="card">
    <h1>LINE Harness を体験</h1>
    <p class="sub">スマートフォンで QR コードを読み取ってください</p>
    <div class="qr">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(qrUrl)}" alt="QR Code">
    </div>
    <p class="hint">LINE アプリのカメラまたは<br>スマートフォンのカメラで読み取れます</p>
    <div class="badge">LINE Harness OSS</div>
  </div>
</body>
</html>`);
});

/**
 * GET /auth/callback — LINE Login callback
 *
 * Exchanges code for tokens, extracts sub (UUID), links friend.
 */
liffRoutes.get('/auth/callback', async (c) => {
  const code = c.req.query('code');
  const stateParam = c.req.query('state') || '';
  const error = c.req.query('error');

  // Parse state (contains ref, redirect, and ad click IDs)
  let ref = '';
  let redirect = '';
  let gclid = '';
  let fbclid = '';
  let utmSource = '';
  let utmMedium = '';
  let utmCampaign = '';
  let accountParam = '';
  let uidParam = '';
  try {
    const parsed = JSON.parse(atob(stateParam));
    ref = parsed.ref || '';
    redirect = parsed.redirect || '';
    gclid = parsed.gclid || '';
    fbclid = parsed.fbclid || '';
    utmSource = parsed.utmSource || '';
    utmMedium = parsed.utmMedium || '';
    utmCampaign = parsed.utmCampaign || '';
    accountParam = parsed.account || '';
    uidParam = parsed.uid || '';
  } catch {
    // ignore
  }

  if (error || !code) {
    return c.html(errorPage(error || 'Authorization failed'));
  }

  try {
    const baseUrl = new URL(c.req.url).origin;
    const callbackUrl = `${baseUrl}/auth/callback`;

    // Multi-account: resolve LINE Login credentials from DB
    let loginChannelId = c.env.LINE_LOGIN_CHANNEL_ID;
    let loginChannelSecret = c.env.LINE_LOGIN_CHANNEL_SECRET;
    if (accountParam) {
      const account = await getLineAccountByChannelId(c.env.DB, accountParam);
      if (account?.login_channel_id && account?.login_channel_secret) {
        loginChannelId = account.login_channel_id;
        loginChannelSecret = account.login_channel_secret;
      }
    }

    // Exchange code for tokens
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
        client_id: loginChannelId,
        client_secret: loginChannelSecret,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Token exchange failed:', errText);
      return c.html(errorPage('Token exchange failed'));
    }

    const tokens = await tokenRes.json<{
      access_token: string;
      id_token: string;
      token_type: string;
    }>();

    // Verify ID token to get sub (use resolved login channel ID, not env default)
    const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        id_token: tokens.id_token,
        client_id: loginChannelId,
      }),
    });

    if (!verifyRes.ok) {
      return c.html(errorPage('ID token verification failed'));
    }

    const verified = await verifyRes.json<{
      sub: string;
      name?: string;
      email?: string;
      picture?: string;
    }>();

    // Get profile via access token
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    let displayName = verified.name || 'Unknown';
    let pictureUrl: string | null = null;
    if (profileRes.ok) {
      const profile = await profileRes.json<{
        userId: string;
        displayName: string;
        pictureUrl?: string;
      }>();
      displayName = profile.displayName;
      pictureUrl = profile.pictureUrl || null;
    }

    const db = c.env.DB;
    const lineUserId = verified.sub;

    // Upsert friend (may not exist yet if webhook hasn't fired)
    const friend = await upsertFriend(db, {
      lineUserId,
      displayName,
      pictureUrl,
      statusMessage: null,
    });

    // Create or find user → link
    let userId: string | null = null;

    // Check if already linked
    const existingUserId = (friend as unknown as Record<string, unknown>).user_id as string | null;
    if (existingUserId) {
      userId = existingUserId;
    } else {
      // Cross-account linking: if uid is provided, use that existing UUID
      if (uidParam) {
        userId = uidParam;
      }

      // Try to find by email
      if (!userId && verified.email) {
        const existingUser = await getUserByEmail(db, verified.email);
        if (existingUser) userId = existingUser.id;
      }

      // Create new user only if no existing UUID found
      if (!userId) {
        const newUser = await createUser(db, {
          email: verified.email || null,
          displayName,
        });
        userId = newUser.id;
      }

      // Link friend to user
      await linkFriendToUser(db, friend.id, userId);
    }

    // Attribution tracking
    if (ref) {
      // Save ref_code on the friend record (first touch wins — only set if not already set)
      await db
        .prepare(`UPDATE friends SET ref_code = ? WHERE id = ? AND ref_code IS NULL`)
        .bind(ref, friend.id)
        .run();

      // Look up entry route config
      const route = await getEntryRouteByRefCode(db, ref);

      // Persist tracking event
      await recordRefTracking(db, {
        refCode: ref,
        friendId: friend.id,
        entryRouteId: route?.id ?? null,
        sourceUrl: null,
      });

      if (route) {
        // Auto-tag the friend
        if (route.tag_id) {
          await addTagToFriend(db, friend.id, route.tag_id);
        }
        // Auto-enroll in scenario (scenario_id stored; enrollment handled by scenario engine)
        // Future: call enrollFriendInScenario(db, friend.id, route.scenario_id) here
      }
    }

    // Save ad click IDs + UTM to friend metadata (for future ad API postback)
    const adMeta: Record<string, string> = {};
    if (gclid) adMeta.gclid = gclid;
    if (fbclid) adMeta.fbclid = fbclid;
    if (utmSource) adMeta.utm_source = utmSource;
    if (utmMedium) adMeta.utm_medium = utmMedium;
    if (utmCampaign) adMeta.utm_campaign = utmCampaign;

    if (Object.keys(adMeta).length > 0) {
      const existingMeta = await db
        .prepare('SELECT metadata FROM friends WHERE id = ?')
        .bind(friend.id)
        .first<{ metadata: string }>();
      const merged = { ...JSON.parse(existingMeta?.metadata || '{}'), ...adMeta };
      await db
        .prepare('UPDATE friends SET metadata = ?, updated_at = ? WHERE id = ?')
        .bind(JSON.stringify(merged), jstNow(), friend.id)
        .run();
    }

    // Auto-enroll in friend_add scenarios + immediate delivery (skip delivery window)
    try {
      const { getScenarios, enrollFriendInScenario: enroll, getScenarioSteps } = await import('@line-crm/db');
      const { LineClient } = await import('@line-crm/line-sdk');
      const { buildMessage, expandVariables } = await import('../services/step-delivery.js');

      // Resolve which account this friend belongs to
      const matchedAccountId = accountParam
        ? (await getLineAccountByChannelId(db, accountParam))?.id ?? null
        : null;

      // Get access token for this account
      let accessToken = c.env.LINE_CHANNEL_ACCESS_TOKEN;
      if (accountParam) {
        const acct = await getLineAccountByChannelId(db, accountParam);
        if (acct) accessToken = acct.channel_access_token;
      }
      const lineClient = new LineClient(accessToken);

      const scenarios = await getScenarios(db);
      for (const scenario of scenarios) {
        const scenarioAccountMatch = !scenario.line_account_id || !matchedAccountId || scenario.line_account_id === matchedAccountId;
        if (scenario.trigger_type === 'friend_add' && scenario.is_active && scenarioAccountMatch) {
          const existing = await db
            .prepare('SELECT id FROM friend_scenarios WHERE friend_id = ? AND scenario_id = ?')
            .bind(friend.id, scenario.id)
            .first<{ id: string }>();
          if (!existing) {
            await enroll(db, friend.id, scenario.id);

            // Immediate delivery of first step (skip delivery window)
            const steps = await getScenarioSteps(db, scenario.id);
            const firstStep = steps[0];
            if (firstStep && firstStep.delay_minutes === 0) {
              const expandedContent = expandVariables(
                firstStep.message_content,
                friend as { id: string; display_name: string | null; user_id: string | null },
                c.env.WORKER_URL,
              );
              await lineClient.pushMessage(lineUserId, [buildMessage(firstStep.message_type, expandedContent)]);
            }
          }
        }
      }
    } catch (err) {
      console.error('OAuth scenario enrollment error:', err);
    }

    // Redirect or show completion
    if (redirect) {
      return c.redirect(redirect);
    }

    // If friend is not yet following this bot, redirect to friend-add page
    if (accountParam) {
      const account = await getLineAccountByChannelId(db, accountParam);
      if (account) {
        // Fetch bot basic ID for friend-add URL
        try {
          const botInfo = await fetch('https://api.line.me/v2/bot/info', {
            headers: { Authorization: `Bearer ${account.channel_access_token}` },
          });
          if (botInfo.ok) {
            const bot = await botInfo.json() as { basicId?: string };
            if (bot.basicId) {
              return c.redirect(`https://line.me/R/ti/p/${bot.basicId}`);
            }
          }
        } catch {
          // Fall through to completion page
        }
      }
    }

    return c.html(completionPage(displayName, pictureUrl, ref));

  } catch (err) {
    console.error('Auth callback error:', err);
    return c.html(errorPage('Internal error'));
  }
});

// ─── 肌診断アンケート ────────────────────────────────────────────

/**
 * GET /api/liff/skin-diagnosis — 肌診断アンケートフォームHTML
 *
 * LIFF URL として設定し、LINE チャット内ブラウザで開くフォーム。
 * 回答後に POST /api/liff/skin-diagnosis に送信し、タグを自動付与する。
 */
liffRoutes.get('/api/liff/skin-diagnosis', async (c) => {
  const workerUrl = c.env.WORKER_URL || new URL(c.req.url).origin;
  return c.html(skinDiagnosisFormHtml(workerUrl));
});

/**
 * POST /api/liff/skin-diagnosis — 肌診断結果を保存してタグを付与
 *
 * Body: { lineUserId, skinType, concern, ageGroup, gender, careSteps }
 */
liffRoutes.post('/api/liff/skin-diagnosis', async (c) => {
  try {
    const body = await c.req.json<{
      lineUserId: string;
      skinType?: string;
      concern?: string;
      ageGroup?: string;
      gender?: string;
      careSteps?: string;
    }>();

    if (!body.lineUserId) {
      return c.json({ success: false, error: 'lineUserId is required' }, 400);
    }

    const db = c.env.DB;
    const friend = await getFriendByLineUserId(db, body.lineUserId);
    if (!friend) {
      return c.json({ success: false, error: 'Friend not found' }, 404);
    }

    // タグ名 → ID マッピングを使って自動タグ付与
    const tagNamesToAdd: string[] = [];
    if (body.skinType) tagNamesToAdd.push(`肌質:${body.skinType}`);
    if (body.concern) tagNamesToAdd.push(`悩み:${body.concern}`);
    if (body.ageGroup) tagNamesToAdd.push(`年代:${body.ageGroup}`);
    if (body.gender) tagNamesToAdd.push(`性別:${body.gender}`);
    if (body.careSteps) tagNamesToAdd.push(`ケア習慣:${body.careSteps}`);

    for (const tagName of tagNamesToAdd) {
      // タグが存在しなければ作成
      let tag = await db
        .prepare(`SELECT id FROM tags WHERE name = ?`)
        .bind(tagName)
        .first<{ id: string }>();

      if (!tag) {
        const tagId = crypto.randomUUID();
        const now = new Date(Date.now() + 9 * 3600_000).toISOString().replace('Z', '+09:00');
        await db
          .prepare(`INSERT OR IGNORE INTO tags (id, name, color, created_at) VALUES (?, ?, '#8B5CF6', ?)`)
          .bind(tagId, tagName, now)
          .run();
        tag = { id: tagId };
      }

      // friend_tags に追加（重複は無視）
      const now = new Date(Date.now() + 9 * 3600_000).toISOString().replace('Z', '+09:00');
      await db
        .prepare(`INSERT OR IGNORE INTO friend_tags (friend_id, tag_id, assigned_at) VALUES (?, ?, ?)`)
        .bind(friend.id, tag.id, now)
        .run();
    }

    // 診断結果を metadata に保存
    const existingMeta = await db
      .prepare('SELECT metadata FROM friends WHERE id = ?')
      .bind(friend.id)
      .first<{ metadata: string }>();
    const meta = JSON.parse(existingMeta?.metadata || '{}') as Record<string, unknown>;
    if (body.skinType) meta.skin_type = body.skinType;
    if (body.concern) meta.concern = body.concern;
    if (body.ageGroup) meta.age_group = body.ageGroup;
    if (body.gender) meta.gender = body.gender;
    if (body.careSteps) meta.care_steps = body.careSteps;
    meta.skin_diagnosed_at = new Date(Date.now() + 9 * 3600_000).toISOString().replace('Z', '+09:00');

    await db
      .prepare('UPDATE friends SET metadata = ?, updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(meta), new Date(Date.now() + 9 * 3600_000).toISOString().replace('Z', '+09:00'), friend.id)
      .run();

    return c.json({ success: true, data: { tagsAdded: tagNamesToAdd } });
  } catch (err) {
    console.error('POST /api/liff/skin-diagnosis error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ─── Existing LIFF endpoints ────────────────────────────────────

// POST /api/liff/profile - get friend by LINE userId (public, no auth)
liffRoutes.post('/api/liff/profile', async (c) => {
  try {
    const body = await c.req.json<{ lineUserId: string }>();
    if (!body.lineUserId) {
      return c.json({ success: false, error: 'lineUserId is required' }, 400);
    }

    const friend = await getFriendByLineUserId(c.env.DB, body.lineUserId);
    if (!friend) {
      return c.json({ success: false, error: 'Friend not found' }, 404);
    }

    return c.json({
      success: true,
      data: {
        id: friend.id,
        displayName: friend.display_name,
        isFollowing: Boolean(friend.is_following),
        userId: (friend as unknown as Record<string, unknown>).user_id ?? null,
      },
    });
  } catch (err) {
    console.error('POST /api/liff/profile error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// POST /api/liff/link - link friend to user UUID (public, verified via LINE ID token)
liffRoutes.post('/api/liff/link', async (c) => {
  try {
    const body = await c.req.json<{
      idToken: string;
      displayName?: string | null;
      ref?: string;
      existingUuid?: string;
    }>();

    if (!body.idToken) {
      return c.json({ success: false, error: 'idToken is required' }, 400);
    }

    // Try verifying with default Login channel, then DB accounts
    const loginChannelIds = [c.env.LINE_LOGIN_CHANNEL_ID];
    const dbAccounts = await getLineAccounts(c.env.DB);
    for (const acct of dbAccounts) {
      if (acct.login_channel_id && !loginChannelIds.includes(acct.login_channel_id)) {
        loginChannelIds.push(acct.login_channel_id);
      }
    }

    let verifyRes: Response | null = null;
    for (const channelId of loginChannelIds) {
      verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ id_token: body.idToken, client_id: channelId }),
      });
      if (verifyRes.ok) break;
    }

    if (!verifyRes?.ok) {
      return c.json({ success: false, error: 'Invalid ID token' }, 401);
    }

    const verified = await verifyRes.json<{ sub: string; email?: string; name?: string }>();
    const lineUserId = verified.sub;
    const email = verified.email || null;

    const db = c.env.DB;
    const friend = await getFriendByLineUserId(db, lineUserId);
    if (!friend) {
      return c.json({ success: false, error: 'Friend not found' }, 404);
    }

    if ((friend as unknown as Record<string, unknown>).user_id) {
      // Still save ref even if already linked
      if (body.ref) {
        await db.prepare('UPDATE friends SET ref_code = ? WHERE id = ? AND ref_code IS NULL')
          .bind(body.ref, friend.id).run();
      }
      return c.json({
        success: true,
        data: { userId: (friend as unknown as Record<string, unknown>).user_id, alreadyLinked: true },
      });
    }

    let userId: string | null = null;
    if (email) {
      const existingUser = await getUserByEmail(db, email);
      if (existingUser) userId = existingUser.id;
    }

    if (!userId) {
      const newUser = await createUser(db, {
        email,
        displayName: body.displayName || verified.name,
      });
      userId = newUser.id;
    }

    await linkFriendToUser(db, friend.id, userId);

    // Save ref_code from LIFF (first touch wins)
    if (body.ref) {
      await db.prepare('UPDATE friends SET ref_code = ? WHERE id = ? AND ref_code IS NULL')
        .bind(body.ref, friend.id).run();

      // Record ref tracking
      try {
        const route = await getEntryRouteByRefCode(db, body.ref);
        await recordRefTracking(db, {
          refCode: body.ref,
          friendId: friend.id,
          entryRouteId: route?.id ?? null,
          sourceUrl: null,
        });
      } catch { /* silent */ }
    }

    return c.json({
      success: true,
      data: { userId, alreadyLinked: false },
    });
  } catch (err) {
    console.error('POST /api/liff/link error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ─── Attribution Analytics ──────────────────────────────────────

/**
 * GET /api/analytics/ref-summary — ref code analytics summary
 */
liffRoutes.get('/api/analytics/ref-summary', async (c) => {
  try {
    const db = c.env.DB;
    const lineAccountId = c.req.query('lineAccountId');
    const accountFilter = lineAccountId ? 'AND f.line_account_id = ?' : '';
    const accountBinds = lineAccountId ? [lineAccountId] : [];

    const rows = await db
      .prepare(
        `SELECT
          er.ref_code,
          er.name,
          COUNT(DISTINCT rt.friend_id) as friend_count,
          COUNT(rt.id) as click_count,
          MAX(rt.created_at) as latest_at
        FROM entry_routes er
        LEFT JOIN ref_tracking rt ON er.ref_code = rt.ref_code
        LEFT JOIN friends f ON f.id = rt.friend_id ${accountFilter ? `${accountFilter}` : ''}
        GROUP BY er.ref_code, er.name
        ORDER BY friend_count DESC`,
      )
      .bind(...accountBinds)
      .all<{
        ref_code: string;
        name: string;
        friend_count: number;
        click_count: number;
        latest_at: string | null;
      }>();

    const totalStmt = lineAccountId
      ? db.prepare(`SELECT COUNT(*) as count FROM friends WHERE line_account_id = ?`).bind(lineAccountId)
      : db.prepare(`SELECT COUNT(*) as count FROM friends`);
    const totalFriendsRes = await totalStmt.first<{ count: number }>();

    const refStmt = lineAccountId
      ? db.prepare(`SELECT COUNT(*) as count FROM friends WHERE ref_code IS NOT NULL AND ref_code != '' AND line_account_id = ?`).bind(lineAccountId)
      : db.prepare(`SELECT COUNT(*) as count FROM friends WHERE ref_code IS NOT NULL AND ref_code != ''`);
    const friendsWithRefRes = await refStmt.first<{ count: number }>();

    const totalFriends = totalFriendsRes?.count ?? 0;
    const friendsWithRef = friendsWithRefRes?.count ?? 0;

    return c.json({
      success: true,
      data: {
        routes: (rows.results ?? []).map((r) => ({
          refCode: r.ref_code,
          name: r.name,
          friendCount: r.friend_count,
          clickCount: r.click_count,
          latestAt: r.latest_at,
        })),
        totalFriends,
        friendsWithRef,
        friendsWithoutRef: totalFriends - friendsWithRef,
      },
    });
  } catch (err) {
    console.error('GET /api/analytics/ref-summary error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/analytics/ref/:refCode — detailed friend list for a single ref code
 */
liffRoutes.get('/api/analytics/ref/:refCode', async (c) => {
  try {
    const db = c.env.DB;
    const refCode = c.req.param('refCode');

    const routeRow = await db
      .prepare(`SELECT ref_code, name FROM entry_routes WHERE ref_code = ?`)
      .bind(refCode)
      .first<{ ref_code: string; name: string }>();

    if (!routeRow) {
      return c.json({ success: false, error: 'Entry route not found' }, 404);
    }

    const lineAccountId = c.req.query('lineAccountId');
    const accountFilter = lineAccountId ? 'AND f.line_account_id = ?' : '';
    const binds = lineAccountId ? [refCode, refCode, lineAccountId] : [refCode, refCode];

    const friends = await db
      .prepare(
        `SELECT
          f.id,
          f.display_name,
          f.ref_code,
          rt.created_at as tracked_at
        FROM friends f
        LEFT JOIN ref_tracking rt ON f.id = rt.friend_id AND rt.ref_code = ?
        WHERE f.ref_code = ? ${accountFilter}
        ORDER BY rt.created_at DESC`,
      )
      .bind(...binds)
      .all<{
        id: string;
        display_name: string;
        ref_code: string | null;
        tracked_at: string | null;
      }>();

    return c.json({
      success: true,
      data: {
        refCode: routeRow.ref_code,
        name: routeRow.name,
        friends: (friends.results ?? []).map((f) => ({
          id: f.id,
          displayName: f.display_name,
          trackedAt: f.tracked_at,
        })),
      },
    });
  } catch (err) {
    console.error('GET /api/analytics/ref/:refCode error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// POST /api/links/wrap - wrap a URL with LIFF redirect proxy
liffRoutes.post('/api/links/wrap', async (c) => {
  try {
    const body = await c.req.json<{ url: string; ref?: string }>();
    if (!body.url) {
      return c.json({ success: false, error: 'url is required' }, 400);
    }

    const liffUrl = c.env.LIFF_URL;
    if (!liffUrl) {
      return c.json({ success: false, error: 'LIFF_URL not configured' }, 500);
    }

    const params = new URLSearchParams({ redirect: body.url });
    if (body.ref) {
      params.set('ref', body.ref);
    }

    const wrappedUrl = `${liffUrl}?${params.toString()}`;
    return c.json({ success: true, data: { url: wrappedUrl } });
  } catch (err) {
    console.error('POST /api/links/wrap error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// ─── HTML Templates ─────────────────────────────────────────────

function authLandingPage(liffUrl: string, oauthUrl: string): string {
  // Extract LIFF ID from URL like https://liff.line.me/{LIFF_ID}?ref=test
  const liffIdMatch = liffUrl.match(/liff\.line\.me\/([^?]+)/);
  const liffId = liffIdMatch ? liffIdMatch[1] : '';
  // Query string part (e.g., ?ref=test)
  const qsIndex = liffUrl.indexOf('?');
  const liffQs = qsIndex >= 0 ? liffUrl.slice(qsIndex) : '';

  // line:// scheme to force open LINE app with LIFF
  const lineSchemeUrl = `https://line.me/R/app/${liffId}${liffQs}`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LINE で開く</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Hiragino Sans', system-ui, sans-serif; background: #06C755; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 16px; padding: 40px 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); text-align: center; max-width: 400px; width: 90%; }
    .line-icon { font-size: 48px; margin-bottom: 16px; }
    h2 { font-size: 20px; color: #333; margin-bottom: 8px; }
    .sub { font-size: 14px; color: #999; margin-bottom: 24px; }
    .btn { display: block; width: 100%; padding: 16px; border: none; border-radius: 8px; font-size: 16px; font-weight: 700; text-decoration: none; text-align: center; cursor: pointer; transition: opacity 0.15s; font-family: inherit; }
    .btn:active { opacity: 0.85; }
    .btn-line { background: #06C755; color: #fff; margin-bottom: 12px; }
    .btn-web { background: #f5f5f5; color: #666; font-size: 13px; padding: 12px; }
    .loading { margin-top: 16px; font-size: 13px; color: #999; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="card" id="card">
    <div class="line-icon">💬</div>
    <h2>LINEで開く</h2>
    <p class="sub">LINEアプリが起動します</p>
    <a href="${escapeHtml(lineSchemeUrl)}" class="btn btn-line" id="openBtn">LINEアプリで開く</a>
    <a href="${escapeHtml(oauthUrl)}" class="btn btn-web" id="pcBtn">PCの方・LINEが開かない方</a>
    <p class="loading hidden" id="loading">LINEアプリを起動中...</p>
  </div>
  <script>
    var lineUrl = '${escapeHtml(lineSchemeUrl)}';
    var ua = navigator.userAgent.toLowerCase();
    var isMobile = /iphone|ipad|android/.test(ua);
    var isLine = /line\\//.test(ua);
    var isIOS = /iphone|ipad/.test(ua);
    var isAndroid = /android/.test(ua);

    if (isLine) {
      // Already in LINE — go to LIFF directly
      window.location.href = '${escapeHtml(liffUrl)}';
    } else if (isMobile) {
      // Mobile browser — try to open LINE app
      document.getElementById('loading').classList.remove('hidden');
      document.getElementById('openBtn').classList.add('hidden');

      // Use line.me/R/app/ which is a Universal Link (iOS) / App Link (Android)
      // This opens LINE app directly without showing browser login
      setTimeout(function() {
        window.location.href = lineUrl;
      }, 100);

      // Fallback: if LINE app doesn't open within 2s, show the button
      setTimeout(function() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('openBtn').classList.remove('hidden');
        document.getElementById('openBtn').textContent = 'もう一度試す';
      }, 2500);
    }
  </script>
</body>
</html>`;
}

function completionPage(displayName: string, pictureUrl: string | null, ref: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>登録完了</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Hiragino Sans', system-ui, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 16px; padding: 40px 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; max-width: 400px; width: 90%; }
    .check { width: 64px; height: 64px; border-radius: 50%; background: #06C755; color: #fff; font-size: 32px; line-height: 64px; margin: 0 auto 16px; }
    h2 { font-size: 20px; color: #06C755; margin-bottom: 16px; }
    .profile { display: flex; align-items: center; justify-content: center; gap: 12px; margin: 16px 0; }
    .profile img { width: 48px; height: 48px; border-radius: 50%; }
    .profile .name { font-size: 16px; font-weight: 600; }
    .message { font-size: 14px; color: #666; line-height: 1.6; margin-top: 12px; }
    .ref { display: inline-block; margin-top: 12px; padding: 4px 12px; background: #f0f0f0; border-radius: 12px; font-size: 11px; color: #999; }
  </style>
</head>
<body>
  <div class="card">
    <div class="check">✓</div>
    <h2>登録完了！</h2>
    <div class="profile">
      ${pictureUrl ? `<img src="${pictureUrl}" alt="">` : ''}
      <p class="name">${escapeHtml(displayName)} さん</p>
    </div>
    <p class="message">ありがとうございます！<br>これからお役立ち情報をお届けします。<br>このページは閉じて大丈夫です。</p>
    ${ref ? `<p class="ref">${escapeHtml(ref)}</p>` : ''}
  </div>
</body>
</html>`;
}

function errorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>エラー</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Hiragino Sans', system-ui, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: #fff; border-radius: 16px; padding: 40px 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); text-align: center; max-width: 400px; width: 90%; }
    h2 { font-size: 18px; color: #e53e3e; margin-bottom: 12px; }
    p { font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="card">
    <h2>エラー</h2>
    <p>${escapeHtml(message)}</p>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function skinDiagnosisFormHtml(workerUrl: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>nú:d 肌タイプ診断</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Hiragino Sans', 'Yu Gothic', system-ui, sans-serif; background: #fafaf9; color: #1c1917; min-height: 100vh; }
    .header { background: #fff; border-bottom: 1px solid #e7e5e4; padding: 16px 20px; text-align: center; }
    .header h1 { font-size: 18px; font-weight: 700; letter-spacing: 0.05em; color: #1c1917; }
    .header p { font-size: 12px; color: #78716c; margin-top: 4px; }
    .progress { height: 3px; background: #e7e5e4; }
    .progress-bar { height: 3px; background: #1c1917; width: 0%; transition: width 0.3s ease; }
    .container { max-width: 480px; margin: 0 auto; padding: 24px 20px 40px; }
    .step { display: none; }
    .step.active { display: block; }
    .step-label { font-size: 11px; font-weight: 600; color: #78716c; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; }
    .step h2 { font-size: 20px; font-weight: 700; line-height: 1.4; margin-bottom: 6px; }
    .step .sub { font-size: 13px; color: #78716c; margin-bottom: 24px; line-height: 1.6; }
    .options { display: flex; flex-direction: column; gap: 10px; }
    .option { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #fff; border: 1.5px solid #e7e5e4; border-radius: 12px; cursor: pointer; transition: all 0.15s; }
    .option:active { background: #fafaf9; }
    .option.selected { border-color: #1c1917; background: #fafaf9; }
    .option-icon { font-size: 22px; width: 32px; text-align: center; }
    .option-text { flex: 1; }
    .option-text strong { display: block; font-size: 14px; font-weight: 600; }
    .option-text span { font-size: 12px; color: #78716c; }
    .option-check { width: 20px; height: 20px; border: 1.5px solid #d6d3d1; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .option.selected .option-check { background: #1c1917; border-color: #1c1917; }
    .option.selected .option-check::after { content: ''; display: block; width: 8px; height: 8px; background: #fff; border-radius: 50%; }
    .nav { display: flex; justify-content: space-between; align-items: center; margin-top: 28px; }
    .btn { padding: 14px 28px; border-radius: 40px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; font-family: inherit; }
    .btn-back { background: transparent; color: #78716c; padding-left: 0; }
    .btn-next { background: #1c1917; color: #fff; min-width: 120px; }
    .btn-next:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-submit { background: #1c1917; color: #fff; width: 100%; padding: 16px; font-size: 15px; border-radius: 12px; }
    .complete { text-align: center; padding: 40px 0; }
    .complete .icon { font-size: 48px; margin-bottom: 16px; }
    .complete h2 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    .complete p { font-size: 14px; color: #78716c; line-height: 1.7; }
    .loading { text-align: center; padding: 40px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>nú:d 肌タイプ診断</h1>
    <p>あなたの肌を教えてください（約30秒）</p>
  </div>
  <div class="progress"><div class="progress-bar" id="progressBar"></div></div>

  <div class="container" id="formContainer">
    <!-- Step 1: 肌質 -->
    <div class="step active" id="step1" data-key="skinType">
      <p class="step-label">Q1 / 5</p>
      <h2>現在の肌の状態は？</h2>
      <p class="sub">最も当てはまるものを選んでください</p>
      <div class="options">
        <label class="option" data-value="乾燥">
          <span class="option-icon">🌵</span>
          <div class="option-text"><strong>乾燥が気になる</strong><span>つっぱり・粉ふきが起きやすい</span></div>
          <div class="option-check"></div>
        </label>
        <label class="option" data-value="脂性">
          <span class="option-icon">💧</span>
          <div class="option-text"><strong>ベタつきが気になる</strong><span>テカリが出やすい</span></div>
          <div class="option-check"></div>
        </label>
        <label class="option" data-value="混合">
          <span class="option-icon">🔄</span>
          <div class="option-text"><strong>季節によって変わる</strong><span>部位や時期で変動する</span></div>
          <div class="option-check"></div>
        </label>
        <label class="option" data-value="普通">
          <span class="option-icon">✨</span>
          <div class="option-text"><strong>特に気にならない</strong><span>比較的安定している</span></div>
          <div class="option-check"></div>
        </label>
      </div>
      <div class="nav">
        <span></span>
        <button class="btn btn-next" id="next1" disabled>次へ</button>
      </div>
    </div>

    <!-- Step 2: 肌悩み -->
    <div class="step" id="step2" data-key="concern">
      <p class="step-label">Q2 / 5</p>
      <h2>最も気になる肌悩みは？</h2>
      <p class="sub">1つ選んでください</p>
      <div class="options">
        <label class="option" data-value="乾燥・カサつき">
          <span class="option-icon">🍂</span>
          <div class="option-text"><strong>乾燥・カサつき</strong></div>
          <div class="option-check"></div>
        </label>
        <label class="option" data-value="毛穴">
          <span class="option-icon">🔍</span>
          <div class="option-text"><strong>毛穴の目立ち</strong></div>
          <div class="option-check"></div>
        </label>
        <label class="option" data-value="ハリ不足">
          <span class="option-icon">🕰️</span>
          <div class="option-text"><strong>ハリ・弾力不足</strong></div>
          <div class="option-check"></div>
        </label>
        <label class="option" data-value="敏感・ゆらぎ">
          <span class="option-icon">🌸</span>
          <div class="option-text"><strong>敏感・ゆらぎ肌</strong></div>
          <div class="option-check"></div>
        </label>
        <label class="option" data-value="髭剃り後の荒れ">
          <span class="option-icon">🪒</span>
          <div class="option-text"><strong>髭剃り後の荒れ</strong></div>
          <div class="option-check"></div>
        </label>
      </div>
      <div class="nav">
        <button class="btn btn-back" id="back2">← 戻る</button>
        <button class="btn btn-next" id="next2" disabled>次へ</button>
      </div>
    </div>

    <!-- Step 3: 年代 -->
    <div class="step" id="step3" data-key="ageGroup">
      <p class="step-label">Q3 / 5</p>
      <h2>年代を教えてください</h2>
      <p class="sub">より適切なケア情報をお届けするために</p>
      <div class="options">
        <label class="option" data-value="20代"><span class="option-icon">🌱</span><div class="option-text"><strong>20代</strong></div><div class="option-check"></div></label>
        <label class="option" data-value="30代"><span class="option-icon">🌿</span><div class="option-text"><strong>30代</strong></div><div class="option-check"></div></label>
        <label class="option" data-value="40代"><span class="option-icon">🌳</span><div class="option-text"><strong>40代</strong></div><div class="option-check"></div></label>
        <label class="option" data-value="50代以上"><span class="option-icon">🌲</span><div class="option-text"><strong>50代以上</strong></div><div class="option-check"></div></label>
      </div>
      <div class="nav">
        <button class="btn btn-back" id="back3">← 戻る</button>
        <button class="btn btn-next" id="next3" disabled>次へ</button>
      </div>
    </div>

    <!-- Step 4: 性別 -->
    <div class="step" id="step4" data-key="gender">
      <p class="step-label">Q4 / 5</p>
      <h2>性別を教えてください</h2>
      <p class="sub">任意。回答しなくても問題ありません</p>
      <div class="options">
        <label class="option" data-value="女性"><span class="option-icon">🌺</span><div class="option-text"><strong>女性</strong></div><div class="option-check"></div></label>
        <label class="option" data-value="男性"><span class="option-icon">🌊</span><div class="option-text"><strong>男性</strong></div><div class="option-check"></div></label>
        <label class="option" data-value="回答しない"><span class="option-icon">🔒</span><div class="option-text"><strong>回答しない</strong></div><div class="option-check"></div></label>
      </div>
      <div class="nav">
        <button class="btn btn-back" id="back4">← 戻る</button>
        <button class="btn btn-next" id="next4" disabled>次へ</button>
      </div>
    </div>

    <!-- Step 5: ケアステップ数 -->
    <div class="step" id="step5" data-key="careSteps">
      <p class="step-label">Q5 / 5</p>
      <h2>現在のスキンケア<br>ステップ数は？</h2>
      <p class="sub">日頃のルーティンを教えてください</p>
      <div class="options">
        <label class="option" data-value="1〜2ステップ"><span class="option-icon">1️⃣</span><div class="option-text"><strong>1〜2ステップ</strong><span>シンプルケア派</span></div><div class="option-check"></div></label>
        <label class="option" data-value="3〜4ステップ"><span class="option-icon">3️⃣</span><div class="option-text"><strong>3〜4ステップ</strong><span>スタンダードケア</span></div><div class="option-check"></div></label>
        <label class="option" data-value="5ステップ以上"><span class="option-icon">5️⃣</span><div class="option-text"><strong>5ステップ以上</strong><span>しっかりケア派</span></div><div class="option-check"></div></label>
      </div>
      <div class="nav">
        <button class="btn btn-back" id="back5">← 戻る</button>
        <button class="btn btn-next" id="next5" disabled>確認する</button>
      </div>
    </div>

    <!-- 送信中 -->
    <div class="step" id="stepLoading">
      <div class="loading">
        <p>診断結果を保存中...</p>
      </div>
    </div>

    <!-- 完了 -->
    <div class="step" id="stepComplete">
      <div class="complete">
        <div class="icon">✅</div>
        <h2>診断完了！</h2>
        <p>ありがとうございます。<br>あなたの肌タイプに合わせた<br>情報をお届けします。<br><br>このページを閉じてください。</p>
      </div>
    </div>
  </div>

  <script>
    var WORKER_URL = '${workerUrl}';
    var answers = {};
    var currentStep = 1;
    var totalSteps = 5;

    function updateProgress() {
      var pct = (currentStep - 1) / totalSteps * 100;
      document.getElementById('progressBar').style.width = pct + '%';
    }

    function showStep(n) {
      document.querySelectorAll('.step').forEach(function(el) { el.classList.remove('active'); });
      var el = document.getElementById('step' + n) || document.getElementById('stepLoading');
      if (el) el.classList.add('active');
      currentStep = n;
      updateProgress();
    }

    // 選択肢クリック
    document.querySelectorAll('.options').forEach(function(optGroup) {
      optGroup.querySelectorAll('.option').forEach(function(opt) {
        opt.addEventListener('click', function() {
          optGroup.querySelectorAll('.option').forEach(function(o) { o.classList.remove('selected'); });
          opt.classList.add('selected');
          var stepEl = opt.closest('.step');
          var nextBtn = stepEl.querySelector('.btn-next');
          if (nextBtn) nextBtn.disabled = false;
          var key = stepEl.dataset.key;
          answers[key] = opt.dataset.value;
        });
      });
    });

    // ナビゲーション
    for (var i = 1; i <= totalSteps; i++) {
      (function(idx) {
        var nextBtn = document.getElementById('next' + idx);
        var backBtn = document.getElementById('back' + idx);
        if (nextBtn) {
          nextBtn.addEventListener('click', function() {
            if (idx < totalSteps) {
              showStep(idx + 1);
            } else {
              submitDiagnosis();
            }
          });
        }
        if (backBtn) {
          backBtn.addEventListener('click', function() { showStep(idx - 1); });
        }
      })(i);
    }

    async function submitDiagnosis() {
      document.querySelectorAll('.step').forEach(function(el) { el.classList.remove('active'); });
      document.getElementById('stepLoading').classList.add('active');

      var lineUserId = null;
      if (typeof liff !== 'undefined' && liff.isLoggedIn && liff.isLoggedIn()) {
        var profile = await liff.getProfile();
        lineUserId = profile.userId;
      } else {
        // フォールバック: URLパラメータから取得
        lineUserId = new URLSearchParams(window.location.search).get('lineUserId');
      }

      if (!lineUserId) {
        document.getElementById('stepLoading').classList.remove('active');
        document.getElementById('stepComplete').classList.add('active');
        return;
      }

      try {
        var res = await fetch(WORKER_URL + '/api/liff/skin-diagnosis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.assign({ lineUserId: lineUserId }, answers))
        });
        var data = await res.json();
        console.log('diagnosis result:', data);
      } catch (e) {
        console.error('diagnosis error:', e);
      }

      document.getElementById('stepLoading').classList.remove('active');
      document.getElementById('stepComplete').classList.add('active');
      document.getElementById('progressBar').style.width = '100%';

      // LIFFを閉じる（LIFFアプリ内の場合）
      if (typeof liff !== 'undefined' && liff.closeWindow) {
        setTimeout(function() { liff.closeWindow(); }, 2000);
      }
    }

    updateProgress();
  </script>
</body>
</html>`;
}

export { liffRoutes };
