export interface Party {
  id: string;
  name: string;
  inviteCode?: string | null;
  createdAt: number;
  members?: PartyMember[];
}

export interface PartyMember {
  userId: string;
  role: "host" | "member";
  joinedAt: number;
  displayName?: string;
}

export interface UserParty {
  partyId: string;
  role: "host" | "member";
  joinedAt: number;
}

// 가계부 타입 정의
export type BudgetBookType = "personal" | "shared";

export interface BudgetBook {
  id: string; // 'personal' 또는 파티 ID
  name: string;
  type: BudgetBookType;
  inviteCode?: string; // 공유 가계부인 경우만
  role?: "host" | "member"; // 공유 가계부인 경우만
  members?: PartyMember[]; // 공유 가계부인 경우만
  isPersonal?: boolean; // 사용자가 생성한 개인 가계부
  createdBy?: string; // 파티(가계부) 생성자
  createdAt: number;
}
