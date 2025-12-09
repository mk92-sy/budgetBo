# Supabase 설정 가이드

이 프로젝트는 Supabase를 사용하여 데이터를 저장합니다. 구글 계정별로 데이터가 분리되어 저장됩니다.

## 1. Supabase 프로젝트 생성

1. [Supabase](https://supabase.com)에 접속하여 계정을 생성합니다.
2. 새 프로젝트를 생성합니다.
3. 프로젝트 설정에서 다음 정보를 확인합니다:
   - Project URL
   - Anon (public) key

## 2. 환경 변수 설정

`.env` 파일에 다음 정보를 추가합니다:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 3. 데이터베이스 스키마 생성

Supabase 대시보드의 SQL Editor에서 `supabase/migrations/001_initial_schema.sql` 파일의 내용을 실행합니다.

또는 Supabase CLI를 사용하는 경우:

```bash
supabase db push
```

## 4. Google OAuth 설정

1. Supabase 대시보드에서 **Authentication** > **Providers**로 이동합니다.
2. **Google**을 활성화합니다.
3. Google Cloud Console에서 OAuth 2.0 클라이언트 ID를 생성하고:
   - Authorized redirect URIs에 Supabase 콜백 URL 추가
   - Client ID와 Client Secret을 Supabase에 입력합니다.

## 5. 데이터베이스 구조

### Tables

- **transactions**: 거래 내역
  - `user_id`: 사용자 ID (Google 계정)
  - `party_id`: 파티 ID (선택사항)
  - `date`: 거래 날짜
  - `type`: 거래 유형 (income/expense)
  - `category`: 카테고리
  - `amount`: 금액
  - `description`: 설명

- **categories**: 카테고리
  - `user_id`: 사용자 ID
  - `party_id`: 파티 ID (선택사항)
  - `type`: 카테고리 유형 (income/expense)
  - `name`: 카테고리 이름

- **parties**: 파티 (공동 가계부)
  - `name`: 파티 이름
  - `invite_code`: 초대 코드

- **party_members**: 파티 멤버
  - `party_id`: 파티 ID
  - `user_id`: 사용자 ID
  - `role`: 역할 (host/member)

## 6. Row Level Security (RLS)

모든 테이블에 RLS가 활성화되어 있으며, 사용자는 자신의 데이터만 접근할 수 있습니다.

## 7. 마이그레이션

기존 AsyncStorage 데이터를 Supabase로 마이그레이션하려면 별도의 마이그레이션 스크립트가 필요합니다. 현재는 새로 시작하는 사용자만 Supabase를 사용합니다.
