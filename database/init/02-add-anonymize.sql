-- ============================================================================
-- Migration 02: add the anonymize flag as a real column on salary.submissions.
--
-- Postgres's docker-entrypoint-initdb.d/ only runs on an empty data volume,
-- so this file is a no-op on fresh deploys (the column is already in
-- 01-schema.sql). On EXISTING deployments, run this manually once:
--
--     docker compose exec -T postgres \
--       psql -U $POSTGRES_USER -d $POSTGRES_DB < database/init/02-add-anonymize.sql
--
-- Idempotent: safe to run repeatedly.
-- ============================================================================

ALTER TABLE salary.submissions
    ADD COLUMN IF NOT EXISTS anonymize BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill: rows with no submitter_token were anonymous by definition;
-- rows with a token must have been non-anonymous, so flip those.
UPDATE salary.submissions
   SET anonymize = FALSE
 WHERE submitter_token IS NOT NULL
   AND anonymize = TRUE;
