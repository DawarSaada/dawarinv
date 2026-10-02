import { supabase } from './supabase';
import { logger } from '../utils/logger';

/**
 * Keep a count sheet's product names in step with the stock rows it points at.
 *
 * `apply_audit_variances` finds the row to update **by name**, but a count sheet
 * is a snapshot taken when the audit was created. A rename since then makes the
 * RPC miss the row it should have updated and try to INSERT it instead, which the
 * case-insensitive unique index rejects and aborts the whole apply with:
 *
 *   duplicate key value violates unique constraint "inventory_items_location_name_en_ci"
 *
 * Every audit item already stores the id of the row it was built from, so the
 * comparison can be exact: for each variance row, read the stock row it points at
 * and, when the two names differ only by case or extra whitespace, rewrite the
 * snapshot with the name the stock row now uses. It only ever copies a spelling
 * that row already has, so what was counted cannot change meaning, and anything
 * else (a genuine rename, or an item that has since been merged away) is left
 * alone for the RPC's create branch.
 *
 * `phase15_audit_apply_item_matching.sql` removes the cause server-side by
 * resolving the row by id first; this keeps an un-migrated database working.
 */

const fold = (value?: string | null) => (value || '').trim().replace(/\s+/g, ' ').toLowerCase();

export interface AuditSheetAlignment {
  /** Variance rows that carry the id of the stock row they were counted from. */
  checked: number;
  /** Snapshots rewritten to the spelling the stock row now uses. */
  aligned: number;
  /** The tidy-up itself failed; the apply still went ahead with the sheet as it was. */
  failed: boolean;
}

export const alignAuditSheetWithStock = async (auditId: string): Promise<AuditSheetAlignment> => {
  const result: AuditSheetAlignment = { checked: 0, aligned: 0, failed: false };

  try {
    const { data: sheet, error } = await supabase
      .from('audit_items')
      .select('id, item_id, item_name_en, item_name_ar')
      .eq('audit_id', auditId)
      .not('item_id', 'is', null)
      .not('variance', 'is', null)
      .neq('variance', 0);

    if (error) throw error;
    if (!sheet?.length) return result;
    result.checked = sheet.length;

    const ids = Array.from(new Set(sheet.map((row: any) => row.item_id).filter(Boolean)));
    const { data: stock, error: stockError } = await supabase
      .from('inventory_items')
      .select('id, name_en, name_ar')
      .in('id', ids);

    if (stockError) throw stockError;
    const liveById = new Map((stock || []).map((row: any) => [row.id, row]));

    for (const row of sheet as any[]) {
      const live: any = liveById.get(row.item_id);
      if (!live) continue;

      const patch: Record<string, string> = {};
      if (live.name_en !== row.item_name_en && fold(live.name_en) === fold(row.item_name_en)) {
        patch.item_name_en = live.name_en;
      }
      if (
        live.name_ar &&
        row.item_name_ar &&
        live.name_ar !== row.item_name_ar &&
        fold(live.name_ar) === fold(row.item_name_ar)
      ) {
        patch.item_name_ar = live.name_ar;
      }
      if (Object.keys(patch).length === 0) continue;

      const { error: patchError } = await supabase.from('audit_items').update(patch).eq('id', row.id);
      if (patchError) throw patchError;
      result.aligned += 1;
    }
  } catch (error) {
    // Never block the apply on the tidy-up: the RPC is still the authority, and a
    // failure here is diagnosable from the console.
    logger.warn('Audit sheet alignment skipped', error);
    result.failed = true;
  }

  return result;
};
