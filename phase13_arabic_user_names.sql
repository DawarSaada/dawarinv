-- phase13 — Arabic names for the app users.
--
-- Why this is needed: the user directory renders `isAr ? name_ar || name : name`
-- (`UserManagement`, `UserModal`, and `App.tsx`'s `getUserName` for ledger rows).
-- `name_ar` was NULL for the central accounts and an empty string for the three
-- branch accounts, and `branch_name_ar` was empty too, so every list of people,
-- every "performed by" and every branch label stayed English on Arabic screens.
--
-- Names mirror the branch they belong to, exactly as the English ones do.
--
-- Idempotent: safe to run more than once.
--
-- Rollback:
--   update public.app_users set name_ar = null, branch_name_ar = null
--    where username in ('admin','warehouse','employee');
--   update public.app_users set name_ar = '', branch_name_ar = ''
--    where username in ('b01','b02','b03');

update public.app_users set name_ar = 'مدير النظام'      where username = 'admin';
update public.app_users set name_ar = 'المشرف الرئيسي'   where username = 'warehouse';
update public.app_users set name_ar = 'موظف المعمل'      where username = 'employee';

update public.app_users set name_ar = 'الجوافة', branch_name_ar = 'الجوافة' where username = 'b01';
update public.app_users set name_ar = 'الجامعة', branch_name_ar = 'الجامعة' where username = 'b02';
update public.app_users set name_ar = 'حبونا',   branch_name_ar = 'حبونا'   where username = 'b03';

-- Verify:
--   select username, name, name_ar, branch_name, branch_name_ar from public.app_users order by username;
