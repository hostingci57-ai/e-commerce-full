-- =============================================================================
-- ECF — Row-Level Security policies
-- Applied AFTER Prisma migrate + init-roles.sql.
-- Tenant-scoped tables enforce `tenant_id = current_setting('app.current_tenant_id')`.
-- ecf_landlord has BYPASSRLS, so it sees everything.
-- =============================================================================

-- Helper to apply the canonical "tenant isolation" policy to a table.
-- We use FORCE ROW LEVEL SECURITY so even the table owner is subject to RLS.
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'tenant_members',
    'refresh_tokens',
    'roles',
    'brands',
    'categories',
    'products',
    'product_options',
    'product_option_values',
    'product_variants',
    'category_products',
    'media_assets',
    'customers',
    'customer_addresses',
    'consent_records',
    'orders',
    'order_lines',
    'order_status_history',
    'inventory_reservations',
    'outbox_events',
    'processed_events',
    'audit_events'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE  ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
  END LOOP;
END$$;

-- --- Generic tenant-scoped tables -------------------------------------------

CREATE POLICY tenant_isolation ON tenant_members
  USING      (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON brands
  USING      (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON categories
  USING      (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON products
  USING      (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON product_options
  USING      (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON product_option_values
  USING      (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON product_variants
  USING      (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON category_products
  USING      (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON media_assets
  USING      (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON customers
  USING      (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON customer_addresses
  USING      (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON orders
  USING      (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON order_lines
  USING      (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON inventory_reservations
  USING      (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON outbox_events
  USING      (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON processed_events
  USING      (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- --- Append-only tables (INSERT + SELECT only) ------------------------------

CREATE POLICY tenant_isolation ON consent_records
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation_insert ON consent_records
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON audit_events
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation_insert ON audit_events
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation ON order_status_history
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
CREATE POLICY tenant_isolation_insert ON order_status_history
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- --- Refresh tokens: also scoped to the acting user (where tenantId is null) -

DROP POLICY IF EXISTS tenant_isolation ON refresh_tokens;
CREATE POLICY refresh_token_scope ON refresh_tokens
  USING (
    user_id = current_setting('app.current_user_id', true)::uuid
    AND (
      tenant_id IS NULL
      OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
  )
  WITH CHECK (
    user_id = current_setting('app.current_user_id', true)::uuid
    AND (
      tenant_id IS NULL
      OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
  );

-- --- Roles: expose global/system rows (tenant_id IS NULL) to everyone -------

DROP POLICY IF EXISTS tenant_isolation ON roles;
CREATE POLICY roles_global_or_tenant ON roles
  USING (
    tenant_id IS NULL
    OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  )
  WITH CHECK (
    tenant_id IS NOT NULL
    AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );
