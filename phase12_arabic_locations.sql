-- phase12 — Arabic names and descriptions for the five locations.
--
-- Why this is needed: the app prefers the database row over the built-in list
-- (`useLocationsQuery` reads `locations` and only falls back to
-- `constants.LOCATIONS` when the table is empty), so anything wrong here is what
-- the Arabic interface shows. Measured on the live project before this fix:
--
--   warehouse  name_ar = "مستودع\r\n"   (no definite article, plus a CRLF)
--   mammal     name_ar = "معمل"         (no definite article)
--   all five   description_ar = NULL    (so Arabic screens showed English text)
--
-- The branches (b01 الجوافة, b02 الجامعة, b03 حبونا) already carry the right
-- names; they only gain an Arabic description.
--
-- Idempotent: safe to run more than once.
--
-- Rollback, if ever needed:
--   update public.locations set name_ar = 'مستودع', description_ar = null where id = 'warehouse';
--   update public.locations set name_ar = 'معمل',   description_ar = null where id = 'mammal';
--   update public.locations set description_ar = null where id in ('b01','b02','b03');

update public.locations
   set name_ar = 'المستودع',
       description_ar = 'مرفق التخزين الرئيسي للمواد والمواد الخام.'
 where id = 'warehouse';

update public.locations
   set name_ar = 'المعمل',
       description_ar = 'وحدة الإنتاج والمعالجة.'
 where id = 'mammal';

update public.locations
   set name_ar = coalesce(nullif(btrim(name_ar), ''), 'الجوافة'),
       description_ar = 'فرع دوار السعادة - الجوافة'
 where id = 'b01';

update public.locations
   set name_ar = coalesce(nullif(btrim(name_ar), ''), 'الجامعة'),
       description_ar = 'فرع دوار السعادة - الجامعة'
 where id = 'b02';

update public.locations
   set name_ar = coalesce(nullif(btrim(name_ar), ''), 'حبونا'),
       description_ar = 'فرع دوار السعادة - حبونا'
 where id = 'b03';

-- Any other stray whitespace in a stored name (the warehouse row had a CRLF).
update public.locations
   set name = btrim(name), name_ar = btrim(name_ar)
 where name <> btrim(name) or name_ar <> btrim(name_ar);

-- Verify:
--   select id, name, name_ar, description_ar from public.locations order by id;
