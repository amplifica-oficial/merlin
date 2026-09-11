-- Deduplicate landing page slugs across projects (keep oldest).
-- Suffixed rows become {slug}-{8 hex chars of id}, truncated to 50 chars.
WITH ranked AS (
    SELECT
        id,
        slug,
        ROW_NUMBER() OVER (PARTITION BY slug ORDER BY "createdAt" ASC, id ASC) AS rn
    FROM "landing_pages"
)
UPDATE "landing_pages" AS lp
SET slug = LEFT(ranked.slug, GREATEST(1, 50 - 9)) || '-' || LEFT(REPLACE(ranked.id, '-', ''), 8)
FROM ranked
WHERE lp.id = ranked.id
  AND ranked.rn > 1;

-- Second pass: if the suffix still collided, fall back to a unique hex id.
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY slug ORDER BY "createdAt" ASC, id ASC) AS rn
    FROM "landing_pages"
)
UPDATE "landing_pages" AS lp
SET slug = LEFT(REPLACE(ranked.id, '-', ''), 32)
FROM ranked
WHERE lp.id = ranked.id
  AND ranked.rn > 1;

DROP INDEX IF EXISTS "landing_pages_projectId_slug_key";

CREATE UNIQUE INDEX "landing_pages_slug_key" ON "landing_pages"("slug");
