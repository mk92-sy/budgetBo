import AsyncStorage from '@react-native-async-storage/async-storage';
import { Party, PartyMember, UserParty } from '@/types/party';

const PARTY_STORAGE_KEY = '@budgetbook_party';
const USER_PARTY_KEY = '@budgetbook_user_party';
const USER_ID_KEY = '@budgetbook_user_id';

// 사용자 ID 가져오기 또는 생성
export const getOrCreateUserId = async (): Promise<string> => {
  try {
    let userId = await AsyncStorage.getItem(USER_ID_KEY);
    if (!userId) {
      userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem(USER_ID_KEY, userId);
    }
    return userId;
  } catch (e) {
    console.error('Error getting user ID:', e);
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await AsyncStorage.setItem(USER_ID_KEY, userId);
    return userId;
  }
};

// 초대코드 생성
export const generateInviteCode = (): string => {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
};

// 파티 생성
export const createParty = async (name: string): Promise<Party> => {
  const userId = await getOrCreateUserId();
  const party: Party = {
    id: `party_${Date.now()}`,
    name,
    inviteCode: generateInviteCode(),
    createdAt: Date.now(),
    members: [
      {
        userId,
        role: 'host',
        joinedAt: Date.now(),
      },
    ],
  };

  await AsyncStorage.setItem(PARTY_STORAGE_KEY, JSON.stringify(party));
  await AsyncStorage.setItem(USER_PARTY_KEY, JSON.stringify({
    partyId: party.id,
    role: 'host',
    joinedAt: Date.now(),
  }));

  return party;
};

// 파티 가져오기
export const getParty = async (): Promise<Party | null> => {
  try {
    const jsonValue = await AsyncStorage.getItem(PARTY_STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error('Error loading party:', e);
    return null;
  }
};

// 사용자 파티 정보 가져오기
export const getUserParty = async (): Promise<UserParty | null> => {
  try {
    const jsonValue = await AsyncStorage.getItem(USER_PARTY_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : null;
  } catch (e) {
    console.error('Error loading user party:', e);
    return null;
  }
};

// 초대코드로 파티 참가
export const joinPartyByCode = async (inviteCode: string): Promise<Party | null> => {
  const party = await getParty();
  if (!party || party.inviteCode !== inviteCode.toUpperCase()) {
    return null;
  }

  const userId = await getOrCreateUserId();
  
  // 이미 멤버인지 확인
  const isMember = party.members.some(m => m.userId === userId);
  if (!isMember) {
    party.members.push({
      userId,
      role: 'member',
      joinedAt: Date.now(),
    });
    await AsyncStorage.setItem(PARTY_STORAGE_KEY, JSON.stringify(party));
  }

  await AsyncStorage.setItem(USER_PARTY_KEY, JSON.stringify({
    partyId: party.id,
    role: party.members.find(m => m.userId === userId)?.role || 'member',
    joinedAt: Date.now(),
  }));

  return party;
};

// 파티 나가기
export const leaveParty = async (): Promise<void> => {
  await AsyncStorage.removeItem(USER_PARTY_KEY);
};

// 파티 삭제 (호스트만)
export const deleteParty = async (): Promise<void> => {
  await AsyncStorage.removeItem(PARTY_STORAGE_KEY);
  await AsyncStorage.removeItem(USER_PARTY_KEY);
};

