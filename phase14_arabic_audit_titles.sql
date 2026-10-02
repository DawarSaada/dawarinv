-- phase14_arabic_audit_titles.sql
--
-- Translates the audit titles that the app itself generated in English.
--
-- `audits.title` is free text, so the app can only translate the two parts it
-- appends (the recurrence marker and the location name) — `utils/auditText.ts`
-- does that at display time, in both directions. The *subject* is whatever
-- whoever scheduled the count typed, and seven rows in the live database were
-- seeded through the UI in English. On an Arabic screen they read
-- "Weekly Audits 1 (الأسبوع 2) - الجامعة": half translated, half not, which is
-- exactly what the audit list looked like.
--
-- This migration rewrites only those seven titles. It matches on the exact
-- stored strings, so re-running it is a no-op and nothing a user types later can
-- be swept up by it. `ScheduleAuditModal` now composes titles in the interface
-- language, so no new English rows are created.
--
-- Rollback: the original strings are the `WHERE` clause below. To undo, run the
-- same statements with the two sides swapped (title = '<original>'), or restore
-- `audits.title` from a backup:
--   UPDATE audits SET title = 'Weekly Audits 1 (Week 2) - Jamia'
--    WHERE title = 'جرد أسبوعي 1 (الأسبوع 2) - الجامعة';
--   ... and likewise for the other six.

BEGIN;

-- Recurring series "Weekly Audits 1", second occurrence, one row per location.
UPDATE audits SET title = 'جرد أسبوعي 1 (الأسبوع 2) - الجامعة' WHERE title = 'Weekly Audits 1 (Week 2) - Jamia';
UPDATE audits SET title = 'جرد أسبوعي 1 (الأسبوع 2) - الجوافة' WHERE title = 'Weekly Audits 1 (Week 2) - Jawafa';
UPDATE audits SET title = 'جرد أسبوعي 1 (الأسبوع 2) - المعمل'   WHERE title = 'Weekly Audits 1 (Week 2) - Mammal';
UPDATE audits SET title = 'جرد أسبوعي 1 (الأسبوع 2) - المستودع' WHERE title = 'Weekly Audits 1 (Week 2) - Warehouse';

-- First occurrence of the same series.
UPDATE audits SET title = 'جرد أسبوعي 1 - الجامعة' WHERE title = 'Weekly Audits 1 - Jamia';
UPDATE audits SET title = 'جرد أسبوعي 1 - الجوافة' WHERE title = 'Weekly Audits 1 - Jawafa';

-- A one-off title typed in English.
UPDATE audits SET title = 'الجرد الأول' WHERE title = '1st Audit';

COMMIT;

-- Verify (expect 0 rows):
--   SELECT id, title FROM audits
--    WHERE title LIKE 'Weekly Audits%' OR title = '1st Audit';
