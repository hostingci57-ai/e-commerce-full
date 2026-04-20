-- =============================================================================
-- ECF — Database roles
-- Must be run by a superuser AFTER the Prisma migrate has created all tables.
-- Idempotent: safe to re-run.
--
-- NOTE: This file contains placeholder tokens for the role passwords. It is
-- NOT intended to be run directly with `psql -f`. Apply it through
-- `pnpm --filter @ecf/db db:init`, which substitutes:
--   %%ECF_APP_PASSWORD%%      → $ECF_APP_PASSWORD
--   %%ECF_LANDLORD_PASSWORD%% → $ECF_LANDLORD_PASSWORD
-- For production, generate strong passwords (>= 32 random chars) and set the
-- env vars via your secret manager. Never commit real passwords to git.
-- =============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- --- Roles -------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ecf_app') THEN
    CREATE ROLE ecf_app LOGIN PASSWORD '%%ECF_APP_PASSWORD%%';
  ELSE
    ALTER ROLE ecf_app WITH LOGIN PASSWORD '%%ECF_APP_PASSWORD%%';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ecf_landlord') THEN
    CREATE ROLE ecf_landlord LOGIN PASSWORD '%%ECF_LANDLORD_PASSWORD%%' BYPASSRLS;
  ELSE
    ALTER ROLE ecf_landlord WITH LOGIN PASSWORD '%%ECF_LANDLORD_PASSWORD%%' BYPASSRLS;
  END IF;
END$$;

-- --- Grants ------------------------------------------------------------------

-- Base connect + schema
GRANT CONNECT ON DATABASE e_commerce_full TO ecf_app, ecf_landlord;
GRANT USAGE   ON SCHEMA public TO ecf_app, ecf_landlord;

-- Landlord: full access to all current + future tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ecf_landlord;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ecf_landlord;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ecf_landlord;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ecf_landlord;

-- App role: read/write on tenant data, read-only on globals
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ecf_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ecf_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ecf_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO ecf_app;

-- Hard restriction: ecf_app may only SELECT on global tables
REVOKE INSERT, UPDATE, DELETE ON tenants       FROM ecf_app;
REVOKE INSERT, UPDATE, DELETE ON plans         FROM ecf_app;
REVOKE INSERT, UPDATE, DELETE ON landlord_users FROM ecf_app;

-- Append-only tables: REVOKE UPDATE / DELETE at role level (policy + grant)
REVOKE UPDATE, DELETE ON consent_records      FROM ecf_app;
REVOKE UPDATE, DELETE ON audit_events         FROM ecf_app;
REVOKE UPDATE, DELETE ON order_status_history FROM ecf_app;
