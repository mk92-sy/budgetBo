-- Allow owners of personal parties (is_personal = TRUE and created_by = auth.uid())
-- to perform transactions operations on their personal party's transactions.

-- DROP existing policies (will recreate below)
DROP POLICY IF EXISTS "Party members can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Party members can update transactions" ON transactions;
DROP POLICY IF EXISTS "Party members can delete transactions" ON transactions;

-- Recreate INSERT policy with additional allowance for personal party owners
CREATE POLICY "Party members can insert transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      party_id IS NULL
      OR is_user_party_member(party_id, auth.uid())
      OR (
        party_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM parties p WHERE p.id = party_id AND p.is_personal = TRUE AND p.created_by = auth.uid()
        )
      )
    )
  );

-- Recreate UPDATE policy with personal owner allowance
CREATE POLICY "Party members can update transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (party_id IS NOT NULL AND is_user_party_member(party_id, auth.uid()))
    OR (
      party_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM parties p WHERE p.id = party_id AND p.is_personal = TRUE AND p.created_by = auth.uid()
      )
  )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      party_id IS NULL
      OR is_user_party_member(party_id, auth.uid())
      OR (
        party_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM parties p WHERE p.id = party_id AND p.is_personal = TRUE AND p.created_by = auth.uid()
        )
      )
    )
  );

-- Recreate DELETE policy with personal owner allowance
CREATE POLICY "Party members can delete transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (party_id IS NOT NULL AND is_user_party_member(party_id, auth.uid()))
    OR (
      party_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM parties p WHERE p.id = party_id AND p.is_personal = TRUE AND p.created_by = auth.uid()
      )
    )
  );