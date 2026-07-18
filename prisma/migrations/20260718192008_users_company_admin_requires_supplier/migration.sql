-- Mirrors the old Laravel migration 2026_07_16_000021 (see
-- CODEBASEAPI_SUMMARY.md §4/§5): capabilities are additive, so a company
-- admin must also be a supplier. Prisma schema can't express cross-column
-- CHECK constraints natively, same pattern as the other two raw-SQL
-- constraint migrations in this project.
ALTER TABLE "users"
  ADD CONSTRAINT "users_company_admin_requires_supplier"
  CHECK (NOT "is_company_admin" OR "is_supplier");
