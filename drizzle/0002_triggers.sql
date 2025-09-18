-- Applied upd_updated_at_stamp() to all tables that belong to public schema (default schema)
-- and have the `updated_at` column.
DO $$
DECLARE tbname text;
BEGIN FOR tbname IN
SELECT table_name
FROM information_schema.columns
WHERE table_schema = 'public'
    AND column_name = 'updated_at' LOOP EXECUTE format(
        'CREATE OR REPLACE TRIGGER upd_updated_at_stamp 
              BEFORE UPDATE 
              ON %I 
              FOR EACH ROW 
              EXECUTE FUNCTION upd_updated_at_stamp()',
        tbname
    );
END LOOP;
END;
$$ LANGUAGE plpgsql;