-- =====================================================================
-- Tech Salary Transparency - Database Schema
-- =====================================================================
-- Three logical schemas on a single PostgreSQL instance:
--   identity  -> users (email, password hash)
--   salary    -> salary submissions (NO direct link to user email)
--   community -> votes (links anon submissions to voters)
--
-- Privacy design: salary.submissions stores an optional `submitter_token`
-- (an opaque UUID chosen by the identity-service at signup time) rather
-- than a user_id or email FK. When a submission is anonymous, the field
-- is NULL. This guarantees salary records cannot be joined back to PII.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS salary;
CREATE SCHEMA IF NOT EXISTS community;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- IDENTITY SCHEMA
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS identity.users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(100),
    -- Opaque token exposed to other services so they never see the email.
    submitter_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON identity.users(email);

-- ---------------------------------------------------------------------
-- SALARY SCHEMA
-- ---------------------------------------------------------------------
CREATE TYPE salary.submission_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE IF NOT EXISTS salary.submissions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- NULL when the user chose "anonymize". Otherwise an opaque token —
    -- NEVER an email or user_id. Cross-schema FK is intentionally avoided
    -- to enforce the privacy boundary at the service layer.
    submitter_token   UUID,
    -- Explicit record of the user's anonymize choice at submission time.
    -- Even if a submitter_token is present (logged-in user, not asking
    -- for anonymity), anonymize=FALSE; if NULL token, anonymize=TRUE.
    anonymize         BOOLEAN NOT NULL DEFAULT TRUE,
    company           VARCHAR(120) NOT NULL,
    role_title        VARCHAR(120) NOT NULL,
    level             VARCHAR(40)  NOT NULL,
    location          VARCHAR(120),
    years_experience  NUMERIC(4,1) NOT NULL CHECK (years_experience >= 0),
    base_salary       NUMERIC(12,2) NOT NULL CHECK (base_salary >= 0),
    bonus             NUMERIC(12,2) DEFAULT 0 CHECK (bonus >= 0),
    equity            NUMERIC(12,2) DEFAULT 0 CHECK (equity >= 0),
    currency          CHAR(3) NOT NULL DEFAULT 'USD',
    status            salary.submission_status NOT NULL DEFAULT 'PENDING',
    vote_score        INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_submissions_status   ON salary.submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_company  ON salary.submissions(LOWER(company));
CREATE INDEX IF NOT EXISTS idx_submissions_role     ON salary.submissions(LOWER(role_title));
CREATE INDEX IF NOT EXISTS idx_submissions_level    ON salary.submissions(level);

-- ---------------------------------------------------------------------
-- COMMUNITY SCHEMA
-- ---------------------------------------------------------------------
CREATE TYPE community.vote_value AS ENUM ('UP', 'DOWN');

CREATE TABLE IF NOT EXISTS community.votes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL,
    -- Who voted, as an opaque token (no email).
    voter_token     UUID NOT NULL,
    value           community.vote_value NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- A user may only vote once per submission.
    UNIQUE (submission_id, voter_token)
);

CREATE INDEX IF NOT EXISTS idx_votes_submission ON community.votes(submission_id);

-- ---------------------------------------------------------------------
-- SEED DATA (small set so the UI is not empty on first boot)
-- ---------------------------------------------------------------------
INSERT INTO salary.submissions
    (company, role_title, level, location, years_experience,
     base_salary, bonus, equity, currency, status, vote_score, approved_at, anonymize)
VALUES
    ('Google',    'Software Engineer',      'L4', 'Mountain View, CA', 3.0, 165000, 25000, 40000, 'USD', 'APPROVED', 5, NOW(), TRUE),
    ('Google',    'Software Engineer',      'L5', 'Mountain View, CA', 6.0, 210000, 45000, 90000, 'USD', 'APPROVED', 8, NOW(), TRUE),
    ('Meta',      'Software Engineer',      'E4', 'Menlo Park, CA',    4.0, 180000, 30000, 65000, 'USD', 'APPROVED', 4, NOW(), TRUE),
    ('Meta',      'Product Manager',        'E5', 'New York, NY',      7.0, 210000, 50000, 80000, 'USD', 'APPROVED', 6, NOW(), TRUE),
    ('Amazon',    'SDE II',                 'L5', 'Seattle, WA',       3.5, 160000, 20000, 55000, 'USD', 'APPROVED', 3, NOW(), TRUE),
    ('Amazon',    'SDE III',                'L6', 'Seattle, WA',       6.5, 195000, 40000, 95000, 'USD', 'APPROVED', 7, NOW(), TRUE),
    ('Microsoft', 'Software Engineer',      '62', 'Redmond, WA',       4.0, 155000, 22000, 45000, 'USD', 'APPROVED', 4, NOW(), TRUE),
    ('Apple',     'ICT4',                   'ICT4', 'Cupertino, CA',   5.0, 185000, 30000, 70000, 'USD', 'APPROVED', 5, NOW(), TRUE),
    ('Netflix',   'Senior Software Engineer','SR', 'Los Gatos, CA',    7.0, 450000,     0,     0, 'USD', 'APPROVED', 9, NOW(), TRUE),
    ('Stripe',    'Software Engineer',      'L3', 'Remote',            3.0, 175000, 25000, 60000, 'USD', 'APPROVED', 4, NOW(), TRUE),
    ('Airbnb',    'Data Scientist',         'L4', 'San Francisco, CA', 4.0, 170000, 25000, 55000, 'USD', 'APPROVED', 3, NOW(), TRUE),
    ('Shopify',   'Senior Developer',       'L5', 'Remote',            6.0, 165000, 20000, 50000, 'CAD', 'APPROVED', 3, NOW(), TRUE),
    ('Uber',      'Software Engineer II',   'L4', 'San Francisco, CA', 3.5, 170000, 28000, 60000, 'USD', 'PENDING',  1, NULL, TRUE),
    ('Salesforce','MTS',                    'MTS', 'San Francisco, CA',3.0, 155000, 20000, 40000, 'USD', 'PENDING',  0, NULL, TRUE);
