
-- W03-BE2: Full-text Search cho Event
-- Cot search_vector da ton tai, KHONG ALTER TABLE lan nua.

CREATE EXTENSION IF NOT EXISTS unaccent;

--> statement-breakpoint

CREATE OR REPLACE FUNCTION events_update_search_vector()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(
      to_tsvector(
        'simple',
        unaccent(COALESCE(NEW.title, ''))
      ),
      'A'
    )
    ||
    setweight(
      to_tsvector(
        'simple',
        unaccent(
          COALESCE(NEW.city, '') || ' ' ||
          COALESCE(NEW.category, '')
        )
      ),
      'B'
    )
    ||
    setweight(
      to_tsvector(
        'simple',
        unaccent(COALESCE(NEW.description, ''))
      ),
      'C'
    );

  RETURN NEW;
END;
$$;

--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_events_search_vector ON events;

--> statement-breakpoint

CREATE TRIGGER trg_events_search_vector
BEFORE INSERT OR UPDATE OF title, description, city, category
ON events
FOR EACH ROW
EXECUTE FUNCTION events_update_search_vector();

--> statement-breakpoint

-- Khoi tao du lieu tim kiem cho cac Event cu
UPDATE events
SET title = title
WHERE search_vector IS NULL;

--> statement-breakpoint

-- Tao GIN Index
CREATE INDEX IF NOT EXISTS idx_events_search_vector
ON events USING GIN (search_vector);
