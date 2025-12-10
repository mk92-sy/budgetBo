-- UUID 생성용 확장
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Parties 테이블
CREATE TABLE IF NOT EXISTS parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기존 테이블에 created_by 컬럼이 없을 때 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parties' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE parties
      ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    ALTER TABLE parties
      ALTER COLUMN created_by SET DEFAULT auth.uid();
  END IF;
END $$;

-- Party Members 테이블
CREATE TABLE IF NOT EXISTS party_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('host', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(party_id, user_id)
);

-- 기존 party_members에 display_name 컬럼이 없을 경우 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'party_members' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE party_members ADD COLUMN display_name TEXT;
  END IF;
END $$;

-- Transactions 테이블
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categories 테이블
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, party_id, type, name)
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_party_id ON transactions(party_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_party_id ON categories(party_id);
CREATE INDEX IF NOT EXISTS idx_party_members_party_id ON party_members(party_id);
CREATE INDEX IF NOT EXISTS idx_party_members_user_id ON party_members(user_id);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_members ENABLE ROW LEVEL SECURITY;

-- 역할 권한 부여 (authenticated 역할이 접근 가능하도록)
GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON parties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON party_members TO authenticated;

-- 기존 정책이 있다면 삭제 (재실행 대비)
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions" ON transactions;
DROP POLICY IF EXISTS "Party members can view transactions" ON transactions;
DROP POLICY IF EXISTS "Party members can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Party members can update transactions" ON transactions;
DROP POLICY IF EXISTS "Party members can delete transactions" ON transactions;

DROP POLICY IF EXISTS "Users can view their own categories" ON categories;
DROP POLICY IF EXISTS "Users can insert their own categories" ON categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON categories;
DROP POLICY IF EXISTS "Users can delete their own categories" ON categories;
DROP POLICY IF EXISTS "Party members can view categories" ON categories;
DROP POLICY IF EXISTS "Party members can insert categories" ON categories;
DROP POLICY IF EXISTS "Party members can update categories" ON categories;
DROP POLICY IF EXISTS "Party members can delete categories" ON categories;

DROP POLICY IF EXISTS "Party members can view parties" ON parties;
DROP POLICY IF EXISTS "Users can create parties" ON parties;
DROP POLICY IF EXISTS "Authenticated can insert parties" ON parties;
DROP POLICY IF EXISTS "Party hosts can update parties" ON parties;
DROP POLICY IF EXISTS "Party hosts can delete parties" ON parties;
DROP POLICY IF EXISTS "Authenticated can view own or member parties" ON parties;
DROP POLICY IF EXISTS "Authenticated can view parties" ON parties;

DROP POLICY IF EXISTS "Party members can view party members" ON party_members;
DROP POLICY IF EXISTS "Users can join parties" ON party_members;
DROP POLICY IF EXISTS "Users can leave parties" ON party_members;
DROP POLICY IF EXISTS "Users can view own memberships" ON party_members;
DROP POLICY IF EXISTS "Hosts can remove members" ON party_members;
DROP POLICY IF EXISTS "Members can view same party memberships" ON party_members;

-- RLS 무한 재귀를 방지하기 위한 security definer 함수
-- 이 함수는 RLS를 우회하여 party_members 테이블을 직접 조회할 수 있습니다
-- SECURITY DEFINER로 인해 함수 소유자(postgres) 권한으로 실행되므로 RLS를 우회합니다
CREATE OR REPLACE FUNCTION is_user_party_member(check_party_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM party_members
    WHERE party_id = check_party_id
    AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- 호스트 권한 확인을 위한 security definer 함수
CREATE OR REPLACE FUNCTION is_user_party_host(check_party_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM party_members
    WHERE party_id = check_party_id
    AND user_id = check_user_id
    AND role = 'host'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Transactions 정책: 개인 데이터 또는 같은 파티 데이터 접근 허용
CREATE POLICY "Party members can view transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (party_id IS NOT NULL AND is_user_party_member(party_id, auth.uid()))
  );

CREATE POLICY "Party members can insert transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      party_id IS NULL
      OR is_user_party_member(party_id, auth.uid())
    )
  );

CREATE POLICY "Party members can update transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (party_id IS NOT NULL AND is_user_party_member(party_id, auth.uid()))
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      party_id IS NULL
      OR is_user_party_member(party_id, auth.uid())
    )
  );

CREATE POLICY "Party members can delete transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (party_id IS NOT NULL AND is_user_party_member(party_id, auth.uid()))
  );

-- Categories 정책: 개인 데이터 또는 같은 파티 데이터 접근 허용
CREATE POLICY "Party members can view categories"
  ON categories FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (party_id IS NOT NULL AND is_user_party_member(party_id, auth.uid()))
  );

CREATE POLICY "Party members can insert categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      party_id IS NULL
      OR is_user_party_member(party_id, auth.uid())
    )
  );

CREATE POLICY "Party members can update categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (party_id IS NOT NULL AND is_user_party_member(party_id, auth.uid()))
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      party_id IS NULL
      OR is_user_party_member(party_id, auth.uid())
    )
  );

CREATE POLICY "Party members can delete categories"
  ON categories FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (party_id IS NOT NULL AND is_user_party_member(party_id, auth.uid()))
  );

-- Parties 정책: 파티 멤버는 파티 정보를 조회할 수 있음
-- 파티 조회: 내 membership 기준
CREATE POLICY "Party members can view parties"
  ON parties FOR SELECT
  USING (
    is_user_party_member(parties.id, auth.uid())
  );

-- 인증된 사용자는 파티 생성 가능 (created_by = auth.uid() 확보)
CREATE POLICY "Authenticated can insert parties"
  ON parties FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- 파티 조회: 인증된 사용자는 조회 가능 (초대 코드로 검색 허용)
CREATE POLICY "Authenticated can view parties"
  ON parties FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Party hosts can update parties"
  ON parties FOR UPDATE
  USING (
    is_user_party_host(parties.id, auth.uid())
  );

CREATE POLICY "Party hosts can delete parties"
  ON parties FOR DELETE
  USING (
    is_user_party_host(parties.id, auth.uid())
  );

-- Party Members 정책 (조회: 파티 멤버면 ok, 삭제: 호스트는 다른 멤버 강퇴 가능)
CREATE POLICY "Users can view own memberships"
  ON party_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 같은 파티 멤버 조회 허용 (파티 멤버 리스트용)
-- security definer 함수를 사용하여 무한 재귀 방지
CREATE POLICY "Members can view same party memberships"
  ON party_members FOR SELECT
  TO authenticated
  USING (
    is_user_party_member(party_id, auth.uid())
  );

CREATE POLICY "Users can join parties"
  ON party_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave parties"
  ON party_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Hosts can remove members"
  ON party_members FOR DELETE
  TO authenticated
  USING (
    is_user_party_host(party_members.party_id, auth.uid())
  );

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거가 있으면 삭제 (재실행 대비)
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
DROP TRIGGER IF EXISTS update_parties_updated_at ON parties;

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parties_updated_at
  BEFORE UPDATE ON parties
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
