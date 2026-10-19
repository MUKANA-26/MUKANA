import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Applies every migration (except 0009, which needs pg_cron/pg_net) to an in-memory Postgres (PGlite)
// with minimal stand-ins for Supabase's auth and storage schemas. Run with:  npm run test:sql
const migDir = fileURLToPath(new URL("../migrations", import.meta.url));
const db = new PGlite({ extensions: { pg_trgm, pgcrypto } });

const stubs = `
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth;
create table auth.users (instance_id uuid, id uuid primary key default gen_random_uuid(), aud text, role text, email text unique, encrypted_password text, email_confirmed_at timestamptz,
  raw_user_meta_data jsonb, raw_app_meta_data jsonb default '{}'::jsonb, created_at timestamptz, updated_at timestamptz, confirmation_token text, recovery_token text, email_change_token_new text, email_change text);
create table auth.identities (id uuid primary key, user_id uuid references auth.users(id) on delete cascade, provider_id text, provider text, identity_data jsonb, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
create schema extensions;
create function extensions.crypt(text, text) returns text language sql as $$ select md5($1 || $2) $$; -- stand-in: PGlite has no bcrypt; real Postgres uses pgcrypto
create function extensions.gen_salt(text) returns text language sql as $$ select 'salt'::text $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, status text, factor_type text default 'totp');
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)] $$;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
grant select on all tables in schema storage to authenticated, anon;
grant select on all tables in schema auth to authenticated;
`;
await db.exec(stubs);

const files = readdirSync(migDir).filter((f) => f.endsWith(".sql") && !f.startsWith("0009")).sort();
for (const f of files) {
  try {
    await db.exec(readFileSync(path.join(migDir, f), "utf8"));
    console.log("OK  ", f);
  } catch (e) {
    console.log("FAIL", f, "\n   ", e.message, e.position ? `(pos ${e.position})` : "");
    process.exit(1);
  }
}

globalThis.db = db;
export { db };
