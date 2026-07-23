-- Migration 2026-07-23: rename documents.archive_path -> library_path.
--
-- src/data/types.ts renamed DocumentRef.archivePath -> libraryPath, and the seeded
-- library folder prefix moved from UGV-Beast-Archive/ to beast/ (see
-- docs/hardware-library.md). schema.sql and seed.sql already reflect this; this
-- migration brings an existing live database in line. It is intentionally
-- repeatable: the column/constraint renames only act while the old names are
-- still present, and the value rewrite only touches rows still carrying the old
-- UGV-Beast-Archive/ prefix.

BEGIN;
SET client_min_messages = warning;

DO $$
BEGIN
  IF to_regclass('public.documents') IS NULL THEN
    RAISE EXCEPTION '2026-07-03-connected-twin.sql must be applied first';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'archive_path'
  ) THEN
    ALTER TABLE documents RENAME COLUMN archive_path TO library_path;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_archive_path_key') THEN
    ALTER TABLE documents RENAME CONSTRAINT documents_archive_path_key TO documents_library_path_key;
  END IF;
END
$$;

UPDATE documents
SET library_path = 'beast/' || substring(library_path FROM length('UGV-Beast-Archive/') + 1)
WHERE library_path LIKE 'UGV-Beast-Archive/%';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'library_path'
  ) THEN
    RAISE EXCEPTION 'documents.library_path column is missing after migration';
  END IF;
  IF EXISTS (SELECT 1 FROM documents WHERE library_path LIKE 'UGV-Beast-Archive/%') THEN
    RAISE EXCEPTION 'documents still carry the old UGV-Beast-Archive/ prefix';
  END IF;
  IF EXISTS (SELECT 1 FROM documents WHERE library_path NOT LIKE 'beast/%') THEN
    RAISE EXCEPTION 'documents.library_path rows exist outside the beast/ prefix';
  END IF;
END
$$;

COMMIT;
