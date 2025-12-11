-- Insert default personal categories when a new auth.users row is created
-- This trigger runs as a security definer so it can bypass RLS and insert into public.categories

CREATE OR REPLACE FUNCTION public.insert_default_categories_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert defaults only if the user has no personal categories matching them
  WITH defaults(type, name) AS (
    VALUES
      ('income','월급'),
      ('income','기타'),
      ('expense','식비'),
      ('expense','생필품'),
      ('expense','공과금'),
      ('expense','월세'),
      ('expense','기타')
  ), to_insert AS (
    SELECT gen_random_uuid() AS id, NEW.id AS user_id, NULL::uuid AS party_id, d.type, d.name, NOW() AS created_at
    FROM defaults d
    LEFT JOIN public.categories c
      ON c.user_id = NEW.id
      AND c.party_id IS NULL
      AND c.type = d.type
      AND c.name = d.name
    WHERE c.id IS NULL
  )
  INSERT INTO public.categories (id, user_id, party_id, type, name, created_at)
  SELECT id, user_id, party_id, type, name, created_at FROM to_insert;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users so defaults are provisioned automatically on signup
DROP TRIGGER IF EXISTS insert_default_categories_trigger ON auth.users;
CREATE TRIGGER insert_default_categories_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.insert_default_categories_for_new_user();

-- Note: This migration requires that the role executing it has permission to create functions
-- and triggers, and that the pgcrypto extension (gen_random_uuid) is available (created in 001_initial_schema.sql).
