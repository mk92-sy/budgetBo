import { supabase } from '@/lib/supabase';
import { Party, PartyMember, UserParty } from '@/types/party';

// UUID 생성 함수
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Supabase에서 Party를 앱의 Party 타입으로 변환
const mapSupabaseToParty = async (row: any): Promise<Party | null> => {
  try {
    // 파티 멤버 조회
    const { data: membersData, error: membersError } = await supabase
      .from('party_members')
      .select('*')
      .eq('party_id', row.id)
      .order('joined_at', { ascending: true });

    if (membersError) {
      console.error('Error loading party members:', membersError);
      return null;
    }

    const members: PartyMember[] = (membersData || []).map((m: any) => ({
      userId: m.user_id,
      role: m.role,
      joinedAt: new Date(m.joined_at).getTime(),
      // display_name은 없을 수 있으니 fallback
      displayName: m.display_name || undefined,
    }));

    return {
      id: row.id,
      name: row.name,
      inviteCode: row.invite_code,
      createdAt: new Date(row.created_at).getTime(),
      members,
    };
  } catch (e) {
    console.error('Error mapping party:', e);
    return null;
  }
};

// 초대코드 생성
export const generateInviteCode = (): string => {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
};

// 파티 생성
export const createParty = async (name: string): Promise<Party> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('No user session found');
    }

    const inviteCode = generateInviteCode();
    const partyId = generateUUID();
    const displayName =
      (session.user.user_metadata as any)?.name ||
      (session.user.user_metadata as any)?.full_name ||
      '사용자';

    // 파티 생성
    const { data: partyData, error: partyError } = await supabase
      .from('parties')
      .insert({
        id: partyId,
        name,
        invite_code: inviteCode,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (partyError) {
      console.error('Error creating party:', partyError);
      throw partyError;
    }

    // 파티 멤버 추가 (호스트)
    const { error: memberError } = await supabase
      .from('party_members')
      .insert({
        party_id: partyId,
        user_id: session.user.id,
        role: 'host',
        display_name: displayName,
      });

    if (memberError) {
      console.error('Error adding party member:', memberError);
      // 파티 삭제 시도
      await supabase.from('parties').delete().eq('id', partyId);
      throw memberError;
    }

    const party = await mapSupabaseToParty(partyData);
    if (!party) {
      throw new Error('Failed to map party data');
    }

    return party;
  } catch (e) {
    console.error('Error creating party:', e);
    throw e;
  }
};

// 파티 가져오기 (현재 사용자가 속한 파티)
export const getParty = async (): Promise<Party | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return null;
    }

    // 사용자가 속한 파티 찾기
    const { data: memberData, error: memberError } = await supabase
      .from('party_members')
      .select('party_id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    // 파티에 속하지 않은 경우 (406 등) null 반환
    if (memberError || !memberData) {
      return null;
    }

    // 파티 정보 조회
    const { data: partyData, error: partyError } = await supabase
      .from('parties')
      .select('*')
      .eq('id', memberData.party_id)
      .single();

    if (partyError || !partyData) {
      return null;
    }

    return await mapSupabaseToParty(partyData);
  } catch (e) {
    console.error('Error loading party:', e);
    return null;
  }
};

// 사용자 파티 정보 가져오기
export const getUserParty = async (): Promise<UserParty | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return null;
    }

    const { data, error } = await supabase
      .from('party_members')
      .select('party_id, role, joined_at')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      partyId: data.party_id,
      role: data.role,
      joinedAt: new Date(data.joined_at).getTime(),
    };
  } catch (e) {
    console.error('Error loading user party:', e);
    return null;
  }
};

// 초대코드로 파티 참가
export const joinPartyByCode = async (inviteCode: string): Promise<Party | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('No user session found');
    }

  const displayName =
    (session.user.user_metadata as any)?.name ||
    (session.user.user_metadata as any)?.full_name ||
    '사용자';

    // 초대코드로 파티 찾기
    const { data: partyData, error: partyError } = await supabase
      .from('parties')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .maybeSingle();

    if (partyError || !partyData) {
      return null;
    }

    // 이미 멤버인지 확인
    const { data: existingMember } = await supabase
      .from('party_members')
      .select('*')
      .eq('party_id', partyData.id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    // 멤버가 아니면 추가
    if (!existingMember) {
      const { error: memberError } = await supabase
        .from('party_members')
        .insert({
          party_id: partyData.id,
          user_id: session.user.id,
          role: 'member',
          display_name: displayName,
        });

      if (memberError) {
        console.error('Error joining party:', memberError);
        return null;
      }
    }

    return await mapSupabaseToParty(partyData);
  } catch (e) {
    console.error('Error joining party:', e);
    return null;
  }
};

// 파티 나가기
export const leaveParty = async (): Promise<void> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('No user session found');
    }

    const { error } = await supabase
      .from('party_members')
      .delete()
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Error leaving party:', error);
      throw error;
    }
  } catch (e) {
    console.error('Error leaving party:', e);
    throw e;
  }
};

// 파티 삭제 (호스트만)
export const deleteParty = async (): Promise<void> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('No user session found');
    }

    const userParty = await getUserParty();
    if (!userParty || userParty.role !== 'host') {
      throw new Error('Only party host can delete the party');
    }

    // 파티 삭제 (CASCADE로 인해 멤버도 자동 삭제됨)
    const { error } = await supabase
      .from('parties')
      .delete()
      .eq('id', userParty.partyId);

    if (error) {
      console.error('Error deleting party:', error);
      throw error;
    }
  } catch (e) {
    console.error('Error deleting party:', e);
    throw e;
  }
};

// 파티원 강퇴 (호스트만 가능, RLS에서 검증)
export const removePartyMember = async (partyId: string, targetUserId: string): Promise<void> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('No user session found');
    }
    const { error } = await supabase
      .from('party_members')
      .delete()
      .eq('party_id', partyId)
      .eq('user_id', targetUserId);
    if (error) {
      console.error('Error removing party member:', error);
      throw error;
    }
  } catch (e) {
    console.error('Error removing party member:', e);
    throw e;
  }
};

