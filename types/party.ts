export interface Party {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: number;
  members: PartyMember[];
}

export interface PartyMember {
  userId: string;
  role: 'host' | 'member';
  joinedAt: number;
}

export interface UserParty {
  partyId: string;
  role: 'host' | 'member';
  joinedAt: number;
}

