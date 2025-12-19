-- Allow parties to represent personal budget books as well
-- Make invite_code nullable and add is_personal flag

ALTER TABLE parties ALTER COLUMN invite_code DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parties' AND column_name = 'is_personal'
  ) THEN
    ALTER TABLE parties ADD COLUMN is_personal BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Allow owners to delete their own personal budget entries
DROP POLICY IF EXISTS "Party hosts can delete parties" ON parties;

CREATE POLICY "Party hosts can delete parties"
  ON parties FOR DELETE
  USING (
    is_user_party_host(parties.id, auth.uid())
    OR (is_personal = TRUE AND parties.created_by = auth.uid())
  );

-- Allow owners to update their own personal budget entries (rename)
DROP POLICY IF EXISTS "Party hosts can update parties" ON parties;

CREATE POLICY "Party hosts can update parties"
  ON parties FOR UPDATE
  USING (
    is_user_party_host(parties.id, auth.uid())
    OR (is_personal = TRUE AND parties.created_by = auth.uid())
  );

-- Ensure select permissions still allow searching by invite_code (already allowed by previous policy)

