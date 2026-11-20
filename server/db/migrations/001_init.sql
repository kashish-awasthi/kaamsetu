-- KaamSetu schema: workers, employers, jobs and a hiring pipeline.

CREATE TYPE user_role AS ENUM ('worker', 'employer');
CREATE TYPE shift_type AS ENUM ('day', 'night', 'rotational', 'flexible');
CREATE TYPE application_status AS ENUM ('applied', 'shortlisted', 'interview', 'hired', 'rejected');

CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  role          user_role   NOT NULL,
  name          TEXT        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  -- Indian mobile numbers: 10 digits starting 6-9. Phone is the login, as it is for most frontline workers.
  phone         TEXT        NOT NULL UNIQUE CHECK (phone ~ '^[6-9][0-9]{9}$'),
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE worker_profiles (
  user_id          BIGINT   PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  city             TEXT     NOT NULL,
  skills           TEXT[]   NOT NULL DEFAULT '{}',
  experience_years SMALLINT NOT NULL DEFAULT 0 CHECK (experience_years BETWEEN 0 AND 50)
);

CREATE TABLE companies (
  id       BIGSERIAL PRIMARY KEY,
  owner_id BIGINT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  name     TEXT   NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120)
);

CREATE TABLE categories (
  slug  TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

CREATE TABLE jobs (
  id          BIGSERIAL   PRIMARY KEY,
  company_id  BIGINT      NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  title       TEXT        NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description TEXT        NOT NULL,
  category    TEXT        NOT NULL REFERENCES categories (slug),
  city        TEXT        NOT NULL,
  salary_min  INTEGER     NOT NULL CHECK (salary_min > 0),
  salary_max  INTEGER     NOT NULL,
  shift       shift_type  NOT NULL,
  openings    INTEGER     NOT NULL DEFAULT 1 CHECK (openings > 0),
  skills      TEXT[]      NOT NULL DEFAULT '{}',
  is_open     BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Full-text search document, kept in sync by Postgres itself. Title matches rank above description matches.
  search      TSVECTOR GENERATED ALWAYS AS (
                setweight(to_tsvector('simple', title), 'A') ||
                setweight(to_tsvector('simple', description), 'B')
              ) STORED,
  CHECK (salary_max >= salary_min)
);

-- The job feed always shows open jobs, newest first, usually filtered by city and/or category.
-- Partial indexes skip closed jobs entirely; (created_at, id) supports keyset pagination.
CREATE INDEX jobs_feed_idx          ON jobs (created_at DESC, id DESC) WHERE is_open;
CREATE INDEX jobs_city_feed_idx     ON jobs (city, created_at DESC, id DESC) WHERE is_open;
CREATE INDEX jobs_category_feed_idx ON jobs (category, created_at DESC, id DESC) WHERE is_open;
CREATE INDEX jobs_search_idx        ON jobs USING GIN (search);
CREATE INDEX jobs_company_idx       ON jobs (company_id, created_at DESC);

CREATE TABLE applications (
  id         BIGSERIAL          PRIMARY KEY,
  job_id     BIGINT             NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  worker_id  BIGINT             NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status     application_status NOT NULL DEFAULT 'applied',
  created_at TIMESTAMPTZ        NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ        NOT NULL DEFAULT now(),
  -- One application per worker per job, enforced by the database even under concurrent requests.
  UNIQUE (job_id, worker_id)
);

CREATE INDEX applications_worker_idx ON applications (worker_id, created_at DESC);
CREATE INDEX applications_job_status_idx ON applications (job_id, status);

-- Audit trail: every status change, who made it and when. Powers the worker's timeline.
CREATE TABLE application_events (
  id             BIGSERIAL          PRIMARY KEY,
  application_id BIGINT             NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  from_status    application_status,
  to_status      application_status NOT NULL,
  actor_id       BIGINT             REFERENCES users (id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ        NOT NULL DEFAULT now()
);

CREATE INDEX application_events_app_idx ON application_events (application_id, created_at);

INSERT INTO categories (slug, label) VALUES
  ('delivery', 'Delivery'),
  ('driver', 'Driver'),
  ('warehouse', 'Warehouse'),
  ('security', 'Security'),
  ('electrician', 'Electrician'),
  ('plumber', 'Plumber'),
  ('housekeeping', 'Housekeeping'),
  ('cook', 'Cook'),
  ('retail', 'Retail'),
  ('telecaller', 'Telecaller'),
  ('construction', 'Construction'),
  ('factory', 'Factory');
