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

### 4-1. Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속합니다.
2. 새 프로젝트를 생성하거나 기존 프로젝트를 선택합니다.
3. **APIs & Services** > **OAuth consent screen**으로 이동합니다:
   - User Type을 선택 (일반적으로 "External" 선택)
   - 앱 정보 입력 (앱 이름, 사용자 지원 이메일, 개발자 연락처 정보)
   - Scopes는 기본값으로 두어도 됩니다
   - 테스트 사용자 추가 (개발 중인 경우)

4. **APIs & Services** > **Credentials**로 이동합니다.
5. **+ CREATE CREDENTIALS** > **OAuth client ID**를 선택합니다.
6. Application type을 **Web application**으로 선택합니다.
7. **Authorized redirect URIs**에 다음 URL을 추가합니다:
   ```
   https://[your-project-ref].supabase.co/auth/v1/callback
   ```
   - `[your-project-ref]`는 Supabase 프로젝트의 참조 ID입니다
   - Supabase 대시보드 > Settings > API에서 확인할 수 있습니다
   - 예: `https://bxbbvdozwjxpwgcqdpzd.supabase.co/auth/v1/callback`
   - **참고**: 모바일 앱만 사용하는 경우 이 URL 하나만 추가하면 됩니다
   - 웹도 함께 사용하는 경우 웹 URL도 추가해야 합니다 (예: `http://localhost:8081/auth/callback`)

8. **Authorized JavaScript origins**에는 다음을 추가합니다:
   ```
   https://[your-project-ref].supabase.co
   ```
   - 예: `https://bxbbvdozwjxpwgcqdpzd.supabase.co`
   - **중요**: 프로토콜(`https://`)은 포함하되, 경로(`/auth/v1/callback` 등)는 포함하지 않습니다
   - 웹도 사용하는 경우 웹 도메인도 추가합니다 (예: `http://localhost:8081`)

9. 생성된 **Client ID**와 **Client Secret**을 복사합니다.

### 4-2. Supabase 설정

1. Supabase 대시보드에서 **Authentication** > **Providers**로 이동합니다.
2. **Google**을 활성화합니다.
3. Google Cloud Console에서 복사한 **Client ID**와 **Client Secret**을 입력합니다.
4. **Save**를 클릭합니다.

4. **중요: 리다이렉트 URL 설정**
   Supabase 대시보드에서 **Authentication** > **URL Configuration**로 이동하여 다음 URL들을 추가합니다:

   - **Site URL**:
     - 모바일 앱만 사용하는 경우: 기본값 그대로 두어도 됩니다 (예: `http://localhost:3000`)
     - 웹도 함께 사용하는 경우: 웹 애플리케이션의 URL을 설정 (예: `http://localhost:8081` 또는 프로덕션 도메인)

   - **Redirect URLs** (반드시 추가 필요):
     - 개발 환경 (Expo Go):
       - `exp://localhost:8081/--/auth/callback`
       - `exp://192.168.x.x:8081/--/auth/callback` (로컬 네트워크 IP 사용 시)
       - **참고**: `--`는 Expo Router의 경로 구분자로, 고정된 구문입니다. 임의의 문자열이 아닙니다.

     - 프로덕션 (빌드된 앱):
       - `budgetbook://auth/callback`

     - 웹:
       - `http://localhost:8081/auth/callback` (로컬 개발)
       - 실제 도메인 URL (프로덕션)

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
