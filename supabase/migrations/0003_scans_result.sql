alter table scans add column if not exists result jsonb;
delete from scans where result is null;
alter table scans alter column result set not null;
alter table scans drop constraint if exists scans_result_is_object;
alter table scans add constraint scans_result_is_object check (jsonb_typeof(result) = 'object');
