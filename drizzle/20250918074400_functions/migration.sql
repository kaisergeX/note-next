-- The pgcrypto extension is required for gen_random_bytes() used in generate_ulid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Function: generate_ulid()
-- Purpose: Generates a ULID-like UUID by combining the current timestamp (in milliseconds) and random bytes.
-- Output Format: Returns a UUID value where the first 12 hex digits encode the timestamp and the remaining 20 hex digits are random.
-- Rationale: This approach provides a sortable, unique identifier similar to ULID using PostgreSQL's built-in functions.
CREATE OR REPLACE FUNCTION generate_ulid() RETURNS uuid AS $$
SELECT (
        lpad(
            to_hex(
                floor(
                    extract(
                        epoch
                        FROM clock_timestamp()
                    ) * 1000
                )::bigint
            ),
            12,
            '0'
        ) || encode(gen_random_bytes(10), 'hex')
    )::uuid;
$$ LANGUAGE SQL;
--> statement-breakpoint
-- Function: upd_updated_at_stamp()
-- Purpose: Each time a row data is updated, the `updated_at` column will be updated automatically.
CREATE OR REPLACE FUNCTION upd_updated_at_stamp() RETURNS TRIGGER AS $upd_updated_at_stamp$ BEGIN IF row(NEW.*) IS DISTINCT
FROM row(OLD.*) THEN NEW.updated_at = now();
RETURN NEW;
ELSE RETURN OLD;
END IF;
END;
$upd_updated_at_stamp$ LANGUAGE plpgsql;