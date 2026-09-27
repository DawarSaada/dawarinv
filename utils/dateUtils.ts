/**
 * Universal date formatter ensuring all dates strictly follow DD-MM-YYYY format (e.g. 27-09-2026).
 * Safely parses ISO date strings (YYYY-MM-DD), Date objects, timestamps, and slashes without timezone shifts.
 */
export const formatDateDDMMYYYY = (val: string | Date | number | null | undefined): string => {
  if (!val) return '-';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '-';
    // Match YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
    const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      return `${day}-${month}-${year}`;
    }
    // Match M/D/YYYY or MM/DD/YYYY
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
      const month = slashMatch[1].padStart(2, '0');
      const day = slashMatch[2].padStart(2, '0');
      const year = slashMatch[3];
      return `${day}-${month}-${year}`;
    }
  }

  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

/**
 * Universal date-time formatter ensuring dates follow DD-MM-YYYY HH:mm (e.g. 27-09-2026 14:30).
 */
export const formatDateTimeDDMMYYYY = (val: string | Date | number | null | undefined): string => {
  if (!val) return '-';
  const d = new Date(val);
  if (isNaN(d.getTime())) return formatDateDDMMYYYY(val);
  const dateStr = formatDateDDMMYYYY(d);
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${dateStr} ${hours}:${mins}`;
};

