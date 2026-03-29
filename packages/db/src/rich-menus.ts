import { jstNow } from './utils.js';

// =============================================================================
// Rich Menu Configs — LINE Rich Menu alias / segment management
// =============================================================================

export interface RichMenuConfig {
  id: string;
  line_account_id: string | null;
  rich_menu_id: string;
  name: string;
  description: string | null;
  target_segment: string | null;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface UpsertRichMenuConfigInput {
  richMenuId: string;
  lineAccountId?: string | null;
  name?: string;
  description?: string | null;
  targetSegment?: string | null;
  isDefault?: boolean;
}

export async function getRichMenuConfigs(
  db: D1Database,
  lineAccountId?: string | null,
): Promise<RichMenuConfig[]> {
  if (lineAccountId) {
    const result = await db
      .prepare(
        `SELECT * FROM rich_menu_configs WHERE line_account_id = ? OR line_account_id IS NULL ORDER BY created_at DESC`,
      )
      .bind(lineAccountId)
      .all<RichMenuConfig>();
    return result.results;
  }
  const result = await db
    .prepare(`SELECT * FROM rich_menu_configs ORDER BY created_at DESC`)
    .all<RichMenuConfig>();
  return result.results;
}

export async function getRichMenuConfigByRichMenuId(
  db: D1Database,
  richMenuId: string,
): Promise<RichMenuConfig | null> {
  return db
    .prepare(`SELECT * FROM rich_menu_configs WHERE rich_menu_id = ?`)
    .bind(richMenuId)
    .first<RichMenuConfig>();
}

export async function upsertRichMenuConfig(
  db: D1Database,
  input: UpsertRichMenuConfigInput,
): Promise<RichMenuConfig> {
  const existing = await getRichMenuConfigByRichMenuId(db, input.richMenuId);
  const now = jstNow();

  if (existing) {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
    if (input.description !== undefined) { fields.push('description = ?'); values.push(input.description); }
    if (input.targetSegment !== undefined) { fields.push('target_segment = ?'); values.push(input.targetSegment); }
    if (input.isDefault !== undefined) { fields.push('is_default = ?'); values.push(input.isDefault ? 1 : 0); }
    if (input.lineAccountId !== undefined) { fields.push('line_account_id = ?'); values.push(input.lineAccountId); }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(existing.id);

    if (fields.length > 1) {
      await db
        .prepare(`UPDATE rich_menu_configs SET ${fields.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();
    }

    return (await getRichMenuConfigByRichMenuId(db, input.richMenuId))!;
  }

  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO rich_menu_configs (id, line_account_id, rich_menu_id, name, description, target_segment, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.lineAccountId ?? null,
      input.richMenuId,
      input.name ?? 'リッチメニュー',
      input.description ?? null,
      input.targetSegment ?? null,
      input.isDefault ? 1 : 0,
      now,
      now,
    )
    .run();

  return (await getRichMenuConfigByRichMenuId(db, input.richMenuId))!;
}

export async function deleteRichMenuConfig(
  db: D1Database,
  richMenuId: string,
): Promise<void> {
  await db
    .prepare(`DELETE FROM rich_menu_configs WHERE rich_menu_id = ?`)
    .bind(richMenuId)
    .run();
}
