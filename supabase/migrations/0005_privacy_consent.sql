alter table profiles add column if not exists privacy_version text;
alter table profiles add column if not exists privacy_accepted_at timestamptz;
alter table profiles drop constraint if exists profiles_privacy_consent_both;
alter table profiles add constraint profiles_privacy_consent_both check ((privacy_version is null) = (privacy_accepted_at is null));
revoke insert, update on profiles from anon, authenticated;
grant insert (id, display_name, avatar_url) on profiles to authenticated;
grant update (display_name, avatar_url) on profiles to authenticated;
