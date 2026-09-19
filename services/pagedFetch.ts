import { logger } from '../utils/logger';

/**
 * Paged reads over PostgREST.
 *
 * Supabase applies a server-side row cap (`db-max-rows`, 1000 by default) to
 * every response. A plain `.select('*')` therefore returns *part of* the table
 * and reports no error — which silently lost inventory items and transaction
 * history. Anything that must see the whole table goes through here instead.
 *
 * `db-max-rows` is a project-wide setting and the cap is not discoverable from
 * the client, so the page size is deliberately conservative and the loop ends
 * on the first short page.
 */

/** Assumed server-side cap. Overridable in case the project raised it. */
const PAGE_SIZE = 1000;

/** Hard stop so a runaway table cannot hang the app; logs when it trips. */
const MAX_ROWS = 20_000;

export interface Page<T> {
  data: T[] | null;
  error: unknown;
}

/**
 * Fetches every row a query can return, one page at a time.
 *
 * @param buildPage receives the inclusive `from`/`to` row offsets and must apply
 *                  them with `.range(from, to)` while preserving its own
 *                  `.order()` — an unstable order can repeat or skip rows.
 * @param label     table name used in logs.
 */
export const fetchAllRows = async <T>(
  buildPage: (from: number, to: number) => PromiseLike<Page<T>>,
  label: string
): Promise<T[]> => {
  const rows: T[] = [];

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE - 1, MAX_ROWS - 1);
    const { data, error } = await buildPage(from, to);
    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);

    // A short page means the table is exhausted.
    if (page.length < to - from + 1) return rows;
  }

  logger.warn(`${label}: stopped at the ${MAX_ROWS}-row safety cap; results are incomplete.`);
  return rows;
};
