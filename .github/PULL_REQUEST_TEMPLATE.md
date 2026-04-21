# Pull request

## Summary
<!-- 1–3 bullets describing what this PR changes and why. -->

## Scope
- [ ] API (`@ecf/api`)
- [ ] Storefront (`@ecf/storefront`)
- [ ] Tenant admin (`@ecf/tenant-admin`)
- [ ] Landlord admin (`@ecf/landlord-admin`)
- [ ] DB / Prisma (`@ecf/db`)
- [ ] Validation / types
- [ ] Infra / CI / Docker

## Checklist
- [ ] `pnpm typecheck` passes
- [ ] `pnpm --filter @ecf/api test:unit` passes (if API changed)
- [ ] E2E suite covered or updated (if behaviour changed)
- [ ] DB migration added / `db:init` (RLS + roles) still applies
- [ ] No new secrets committed; `.env.example` updated if required
- [ ] Docs / README updated where relevant

## Notes for reviewer
<!-- Risk, rollout, follow-ups. -->
