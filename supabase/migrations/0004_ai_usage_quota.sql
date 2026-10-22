alter table ai_usage add column if not exists ip_hash text;
alter table ai_usage drop constraint if exists ai_usage_ip_hash_format;
alter table ai_usage add constraint ai_usage_ip_hash_format check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$');
create index if not exists ai_usage_ip_created_idx on ai_usage (ip_hash, created_at) where ip_hash is not null;
create index if not exists ai_usage_created_idx on ai_usage (created_at);
create or replace function public.ai_tokens_since(since timestamptz) returns bigint language sql stable security invoker set search_path = public as $$ select coalesce(sum(coalesce(prompt_tokens, 0) + coalesce(completion_tokens, 0)), 0)::bigint from ai_usage where created_at >= since; $$;
revoke execute on function public.ai_tokens_since(timestamptz) from public, anon, authenticated;
grant execute on function public.ai_tokens_since(timestamptz) to service_role;
