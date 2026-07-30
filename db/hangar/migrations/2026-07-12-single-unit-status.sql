-- Migration 2026-07-12: replace the Unit status+lifecycle pair with one state.
--
-- Asset lifecycle remains available for the inventory-item and wishlist lanes,
-- but Unit rows carry their full operator-facing state in assets.status and
-- therefore keep lifecycle NULL. The migration is repeatable and also folds
-- the retired Unit-only `in-mission` value into `operational`; mission activity
-- belongs to the missions table.

BEGIN;
SET client_min_messages = warning;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'asset_status' AND e.enumlabel = 'integrating'
  ) OR EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'asset_status' AND e.enumlabel = 'in-mission'
  ) THEN
    EXECUTE $sql$
      CREATE TYPE asset_status_next AS ENUM (
        'operational','needs-attention','blocked','inventory','integrating',
        'deployed','owned','on-order','researching','wishlist','watching',
        'planned','buy-next','received','retired','rejected'
      )
    $sql$;
    EXECUTE $sql$
      ALTER TABLE assets
      ALTER COLUMN status TYPE asset_status_next
      USING (
        CASE WHEN status::text = 'in-mission' THEN 'operational' ELSE status::text END
      )::asset_status_next
    $sql$;
    EXECUTE 'DROP TYPE asset_status';
    EXECUTE 'ALTER TYPE asset_status_next RENAME TO asset_status';
  END IF;
END
$$;

WITH expected(id,status) AS (
  VALUES
    ('beast','operational'),
    ('oak-d-lite','integrating'),
    ('d500-lidar','integrating'),
    ('stock-ups','operational'),
    ('driver-board','operational'),
    ('rover-slot-2','planned'),
    ('workstation','operational'),
    ('pi5','operational'),
    ('orin-nano','integrating'),
    ('jetson-thor','researching'),
    ('udm-pro-max','operational'),
    ('unifi-aps','operational'),
    ('unifi-cams','operational'),
    ('home-assistant','operational'),
    ('rog-kithara','operational')
)
UPDATE assets a
SET status = expected.status::asset_status,
    lifecycle = NULL,
    updated_at = now()
FROM expected
WHERE a.id = expected.id
  AND (a.status::text IS DISTINCT FROM expected.status OR a.lifecycle IS NOT NULL);

DO $$
BEGIN
  IF EXISTS (
    WITH expected(id,status) AS (
      VALUES
        ('beast','operational'),
        ('oak-d-lite','integrating'),
        ('d500-lidar','integrating'),
        ('stock-ups','operational'),
        ('driver-board','operational'),
        ('rover-slot-2','planned'),
        ('workstation','operational'),
        ('pi5','operational'),
        ('orin-nano','integrating'),
        ('jetson-thor','researching'),
        ('udm-pro-max','operational'),
        ('unifi-aps','operational'),
        ('unifi-cams','operational'),
        ('home-assistant','operational'),
        ('rog-kithara','operational')
    )
    SELECT 1
    FROM expected
    LEFT JOIN assets a ON a.id = expected.id
    WHERE a.id IS NULL OR a.status::text <> expected.status OR a.lifecycle IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Unit status migration did not converge';
  END IF;
END
$$;

COMMIT;
