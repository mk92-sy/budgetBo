import { supabase } from "@/lib/supabase";
import { BudgetBook, BudgetBookType, Party, PartyMember, UserParty } from "@/types/party";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAuthMode } from "./authMode";

// UUID 생성 함수
const generateUUID = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Supabase에서 Party를 앱의 Party 타입으로 변환
const mapSupabaseToParty = async (row: any): Promise<Party | null> => {
  try {
    // 파티 멤버 조회
    const { data: membersData, error: membersError } = await supabase
      .from("party_members")
      .select("*")
      .eq("party_id", row.id)
      .order("joined_at", { ascending: true });

    if (membersError) {
      console.error("Error loading party members:", membersError);
      return null;
    }

    // Get current session user and metadata (used as authoritative for self)
    let currentUserId: string | null = null;
    let currentUserMeta: any = {};
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      currentUserId = session?.user?.id ?? null;
      currentUserMeta = session?.user?.user_metadata ?? {};
      // Try to refresh from auth.getUser for freshest metadata (nickname changes)
      const { data: authUser } = await supabase.auth.getUser();
      const freshMeta = authUser?.user?.user_metadata;
      if (freshMeta) currentUserMeta = freshMeta;
    } catch {
      currentUserId = null;
      currentUserMeta = {};
    }

    // Fetch latest user metadata for members to keep display names in sync with profile nickname (may be limited by RLS)
    let userMetaById = new Map<string, any>();
    try {
      const memberIds = (membersData || []).map((m: any) => m.user_id);
      if (memberIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from("users")
          .select("id, user_metadata")
          .in("id", memberIds);
        if (!usersError && usersData) {
          userMetaById = new Map(usersData.map((u: any) => [u.id, u.user_metadata]));
        }
      }
    } catch (e) {
      console.warn("Failed to load user metadata for party members", e);
    }

    const members: PartyMember[] = (membersData || []).map((m: any) => {
      const meta = userMetaById.get(m.user_id) || {};
      const metaName = meta.nickname || meta.name || meta.full_name;

      // If this is the current user, override with latest auth metadata
      const isCurrentUser = currentUserId && m.user_id === currentUserId;
      const selfName = isCurrentUser
        ? currentUserMeta?.nickname || currentUserMeta?.name || currentUserMeta?.full_name
        : undefined;

      // Prefer latest metadata (self meta first, then users table meta), then stored display_name
      const displayName = selfName || metaName || m.display_name || undefined;
      return {
        userId: m.user_id,
        role: m.role,
        joinedAt: new Date(m.joined_at).getTime(),
        displayName,
      };
    });

    return {
      id: row.id,
      name: row.name,
      inviteCode: row.invite_code,
      createdAt: new Date(row.created_at).getTime(),
      members,
    };
  } catch (e) {
    console.error("Error mapping party:", e);
    return null;
  }
};

// 초대코드 생성
export const generateInviteCode = (): string => {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
};

// 파티 생성
export const createParty = async (name: string, isPersonal = false): Promise<Party> => {
  try {
    // 가계부 최대 개수(개인 포함) 제한 검사: 4개 초과 생성 방지
    try {
      const currentBooks = await getAllBudgetBooks();
      if (currentBooks && currentBooks.length >= 4) {
        throw new Error("가계부는 최대 4개까지 생성할 수 있습니다.");
      }
    } catch (cntErr) {
      // 카운트 조회 실패시에는 진행을 막지 않지만 로그 출력
      console.warn("Could not verify budget book count before creating party", cntErr);
    }
    const mode = await getAuthMode();
    if (mode === "guest") {
      throw new Error("게스트 모드에서는 파티 기능을 사용할 수 없습니다.");
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error("No user session found");
    }

    const partyId = generateUUID();
    const inviteCode = isPersonal ? null : generateInviteCode();
    // Prefer explicit nickname from latest user metadata, then name/full_name, then fallback
    const { data: userData } = await supabase.auth.getUser();
    const userMeta = (userData?.user?.user_metadata as any) || (session.user.user_metadata as any) || {};
    const displayName = userMeta.nickname || userMeta.name || userMeta.full_name || "사용자";

    // 파티 생성
    const insertPayload: any = {
      id: partyId,
      name,
      created_by: session.user.id,
    };
    if (!isPersonal) insertPayload.invite_code = inviteCode;
    else insertPayload.is_personal = true;

    let partyData: any = null;
    let partyError: any = null;

    // Try initial insert (preferred: use is_personal flag when creating personal budgets)
    try {
      const res = await supabase.from("parties").insert(insertPayload).select().single();
      partyData = res.data;
      partyError = res.error;
    } catch (err) {
      partyError = err;
    }

    // Fallback: if creating a personal budget but DB doesn't support is_personal or requires invite_code non-null,
    // try inserting with an invite_code to succeed on older schema. Log a warning so migration can be applied.
    if (partyError && isPersonal) {
      console.warn(
        "Initial personal party insert failed, attempting fallback insert (legacy schema likely).",
        partyError
      );
      try {
        const fallbackPayload: any = { ...insertPayload };
        delete fallbackPayload.is_personal;
        fallbackPayload.invite_code = inviteCode || generateInviteCode();
        const res2 = await supabase.from("parties").insert(fallbackPayload).select().single();
        partyData = res2.data;
        partyError = res2.error;
        if (!partyError) {
          console.warn(
            "Fallback insert succeeded. Consider running DB migration to add is_personal column for full support."
          );
        }
      } catch (err) {
        partyError = err;
      }
    }

    if (partyError) {
      console.error("Error creating party:", partyError);
      throw partyError;
    }

    // 파티 멤버 추가 (호스트) - 공유 가계부인 경우에만 추가
    if (!isPersonal) {
      const { error: memberError } = await supabase.from("party_members").insert({
        party_id: partyId,
        user_id: session.user.id,
        role: "host",
        display_name: displayName,
      });

      if (memberError) {
        console.error("Error adding party member:", memberError);
        // 파티 삭제 시도
        await supabase.from("parties").delete().eq("id", partyId);
        throw memberError;
      }
    }

    const party = await mapSupabaseToParty(partyData);
    if (!party) {
      throw new Error("Failed to map party data");
    }

    return party;
  } catch (e) {
    console.error("Error creating party:", e);
    throw e;
  }
};

// 파티 가져오기 (현재 사용자가 속한 파티)
export const getParty = async (): Promise<Party | null> => {
  try {
    const mode = await getAuthMode();
    if (mode === "guest") {
      return null;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      return null;
    }

    // 사용자가 속한 파티(회원으로 참여한 파티) 찾기 - 기존 동작 유지
    const { data: memberData, error: memberError } = await supabase
      .from("party_members")
      .select("party_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    // If no membership record, return null (no shared party). Personal budgets are represented separately.
    if (memberError || !memberData) {
      return null;
    }

    // 파티 정보 조회
    const { data: partyData, error: partyError } = await supabase
      .from("parties")
      .select("*")
      .eq("id", memberData.party_id)
      .single();

    if (partyError || !partyData) {
      return null;
    }

    return await mapSupabaseToParty(partyData);
  } catch (e) {
    console.error("Error loading party:", e);
    return null;
  }
};

// 사용자 파티 정보 가져오기
export const getUserParty = async (): Promise<UserParty | null> => {
  try {
    const mode = await getAuthMode();
    if (mode === "guest") {
      return null;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      return null;
    }

    const { data, error } = await supabase
      .from("party_members")
      .select("party_id, role, joined_at")
      .eq("user_id", session.user.id)
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
    console.error("Error loading user party:", e);
    return null;
  }
};

// 초대코드로 파티 참가
export const joinPartyByCode = async (inviteCode: string): Promise<Party | null> => {
  try {
    console.log("=== joinPartyByCode START ===");
    const mode = await getAuthMode();
    console.log("Auth mode:", mode);

    if (mode === "guest") {
      throw new Error("게스트 모드에서는 파티 기능을 사용할 수 없습니다.");
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    console.log("Session:", session?.user?.id, "Error:", sessionError);

    if (!session?.user) {
      throw new Error("세션이 없습니다. 다시 로그인해주세요.");
    }

    // 가계부 최대 개수(개인 포함) 제한 검사: 4개 초과 가입 방지
    try {
      const currentBooks = await getAllBudgetBooks();
      if (currentBooks && currentBooks.length >= 4) {
        throw new Error("가계부는 최대 4개까지 생성/가입할 수 있습니다.");
      }
    } catch (cntErr) {
      console.warn("Could not verify budget book count before joining party", cntErr);
    }

    // Prefer nickname first (users often set nickname), then name/full_name
    const { data: userData } = await supabase.auth.getUser();
    const userMeta = (userData?.user?.user_metadata as any) || (session.user.user_metadata as any) || {};
    const displayName = userMeta.nickname || userMeta.name || userMeta.full_name || "사용자";

    const normalizedCode = inviteCode.trim().toUpperCase();
    console.log("Normalized invite code:", normalizedCode);
    console.log("Current user ID:", session.user.id);
    console.log("Display name:", displayName);

    // 초대코드로 파티 찾기
    console.log("Querying parties table...");
    const {
      data: partyData,
      error: partyError,
      status: partyStatus,
    } = await supabase.from("parties").select("*").eq("invite_code", normalizedCode).maybeSingle();

    console.log("Party query result:", { partyData, partyError, status: partyStatus });

    if (partyError) {
      console.error("Error finding party by invite code:", partyError);
      throw new Error(`파티 조회 실패 (${partyStatus}): ${partyError.message}`);
    }

    if (!partyData) {
      console.error("Party not found with invite code:", normalizedCode);
      throw new Error("유효하지 않은 초대코드입니다.");
    }

    console.log("Party found:", partyData.id);

    // 이미 멤버인지 확인
    console.log("Checking if user is already member...");
    const { data: existingMember, error: checkError } = await supabase
      .from("party_members")
      .select("*")
      .eq("party_id", partyData.id)
      .eq("user_id", session.user.id)
      .maybeSingle();

    console.log("Membership check:", { existingMember, checkError });

    // 이미 멤버면 에러 발생
    if (existingMember) {
      console.log("User is already a member of this party");
      throw new Error("이미 이 파티의 멤버입니다.");
    }

    // 멤버 추가
    console.log("Adding user as member to party...");
    const insertPayload = {
      party_id: partyData.id,
      user_id: session.user.id,
      role: "member" as const,
      display_name: displayName,
    };
    console.log("Insert payload:", insertPayload);

    const {
      data: insertedMember,
      error: memberError,
      status: insertStatus,
    } = await supabase.from("party_members").insert([insertPayload]).select();

    console.log("Member insert result:", { insertedMember, memberError, status: insertStatus });

    if (memberError) {
      console.error("Error joining party (insert failed):", memberError);
      throw new Error(`파티 가입 실패 (${insertStatus}): ${memberError.message}`);
    }

    if (!insertedMember || insertedMember.length === 0) {
      console.error("No member inserted despite no error");
      throw new Error("파티 멤버 추가에 실패했습니다.");
    }

    console.log("Successfully joined party:", insertedMember);

    const party = await mapSupabaseToParty(partyData);
    if (!party) {
      throw new Error("파티 정보를 불러오는 중 오류가 발생했습니다.");
    }

    console.log("=== joinPartyByCode SUCCESS ===");
    return party;
  } catch (e: any) {
    console.error("=== joinPartyByCode ERROR ===", e);
    throw e;
  }
};

// 파티 나가기
export const leaveParty = async (): Promise<void> => {
  try {
    const mode = await getAuthMode();
    if (mode === "guest") {
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error("No user session found");
    }

    const { error } = await supabase.from("party_members").delete().eq("user_id", session.user.id);

    if (error) {
      console.error("Error leaving party:", error);
      throw error;
    }
  } catch (e) {
    console.error("Error leaving party:", e);
    throw e;
  }
};

// 파티 삭제 (호스트만)
export const deleteParty = async (partyId?: string): Promise<void> => {
  try {
    const mode = await getAuthMode();
    if (mode === "guest") {
      throw new Error("게스트 모드에서는 파티 기능을 사용할 수 없습니다.");
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error("세션이 없습니다. 다시 로그인해주세요.");
    }

    // partyId가 제공되지 않은 경우 기본적으로 사용자의 호스트 멤버십을 가져와 삭제
    let targetPartyId = partyId;
    if (!targetPartyId) {
      const userParty = await getUserParty();
      if (!userParty || userParty.role !== "host") {
        throw new Error("파티장만 파티를 삭제할 수 있습니다.");
      }
      targetPartyId = userParty.partyId;
    } else {
      // partyId가 제공된 경우 권한 확인: 호스트이거나(공유) 해당 파티의 생성자(개인)여야 함
      const { data: targetParty, error: fetchError } = await supabase
        .from("parties")
        .select("created_by, is_personal")
        .eq("id", targetPartyId)
        .maybeSingle();
      if (fetchError) {
        throw new Error("파티 정보를 확인할 수 없습니다.");
      }
      const { data: userParty } = await supabase.auth.getUser();
      const currentUserId = userParty?.user?.id || null;
      if (!currentUserId) throw new Error("세션 정보가 없습니다.");

      // Check whether there are any members for this party (fallback detection for legacy personal rows)
      const { data: membersData, error: membersError } = await supabase
        .from("party_members")
        .select("user_id")
        .eq("party_id", targetPartyId)
        .limit(1);
      const hasMembers = !!(membersData && membersData.length > 0);

      // If it's personal (explicit) allow deletion if created_by matches
      if (targetParty?.is_personal) {
        if (targetParty.created_by !== currentUserId) {
          throw new Error("가계부 소유자만 삭제할 수 있습니다.");
        }
      } else if (!hasMembers && targetParty?.created_by === currentUserId) {
        // Legacy/fallback personal-like row (no members and created_by is current user) — allow delete
      } else {
        // shared party: require host membership
        const userPartyRec = await getUserParty();
        if (!userPartyRec || userPartyRec.role !== "host" || userPartyRec.partyId !== targetPartyId) {
          throw new Error("파티장만 파티를 삭제할 수 있습니다.");
        }
      }
    }

    if (!targetPartyId) {
      throw new Error("파티 ID를 찾을 수 없습니다.");
    }

    // 파티 삭제 (CASCADE로 인해 멤버도 자동 삭제됨)
    const { error } = await supabase.from("parties").delete().eq("id", targetPartyId);

    if (error) {
      console.error("Error deleting party:", error);
      throw new Error(error.message || "파티 삭제 중 오류가 발생했습니다.");
    }
  } catch (e: any) {
    console.error("Error deleting party:", e);
    // 이미 Error 객체인 경우 그대로 throw, 아니면 새 Error 생성
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(e?.message || "파티 삭제 중 오류가 발생했습니다.");
  }
};

// 파티원 강퇴 (호스트만 가능, RLS에서 검증)
export const removePartyMember = async (partyId: string, targetUserId: string): Promise<void> => {
  try {
    const mode = await getAuthMode();
    if (mode === "guest") {
      throw new Error("게스트 모드에서는 파티 기능을 사용할 수 없습니다.");
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error("No user session found");
    }
    const { error } = await supabase.from("party_members").delete().eq("party_id", partyId).eq("user_id", targetUserId);
    if (error) {
      console.error("Error removing party member:", error);
      throw error;
    }
  } catch (e) {
    console.error("Error removing party member:", e);
    throw e;
  }
};

// 파티 이름 변경 (호스트 전용 권한으로 RLS가 설정되어 있음)
export const updateParty = async (partyId: string, newName: string): Promise<Party> => {
  try {
    // 'personal' 기본 가계부 이름 변경: 로컬에 저장하여 앱에서 표시
    if (partyId === "personal") {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const uid = session?.user?.id ?? null;
        await AsyncStorage.setItem(personalBudgetNameKey(uid), newName);
      } catch (e) {
        console.error("Failed to persist personal budget name:", e);
        throw new Error("개인 가계부 이름을 저장할 수 없습니다.");
      }
      return { id: "personal", name: newName, createdAt: Date.now() } as Party;
    }

    const mode = await getAuthMode();
    if (mode === "guest") {
      throw new Error("게스트 모드에서는 파티 기능을 사용할 수 없습니다.");
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error("No user session found");
    }

    // Fetch party row to determine if it's personal and the owner
    const { data: partyRow, error: fetchError } = await supabase
      .from("parties")
      .select("created_by, is_personal")
      .eq("id", partyId)
      .maybeSingle();
    if (fetchError) {
      console.error("Error fetching party info for update:", fetchError);
      throw new Error("파티 정보를 확인할 수 없습니다.");
    }

    const currentUserId = session.user.id;

    // Check for membership rows (to detect legacy personal rows without is_personal)
    const { data: membersData } = await supabase
      .from("party_members")
      .select("user_id")
      .eq("party_id", partyId)
      .limit(1);
    const hasMembers = !!(membersData && membersData.length > 0);

    const isPersonalResolved = partyRow?.is_personal === true || (!partyRow?.is_personal && !hasMembers);

    // Authorization: allow update if host (shared) or owner (personal)
    if (isPersonalResolved) {
      if (partyRow?.created_by !== currentUserId) {
        throw new Error("가계부 소유자만 이름을 변경할 수 있습니다.");
      }
    } else {
      const userParty = await getUserParty();
      if (!userParty || userParty.role !== "host" || userParty.partyId !== partyId) {
        throw new Error("파티장만 파티 이름을 변경할 수 있습니다.");
      }
    }

    const { data, error } = await supabase
      .from("parties")
      .update({ name: newName })
      .eq("id", partyId)
      .select()
      .single();

    if (error) {
      console.error("Error updating party name:", error);
      throw error;
    }

    const party = await mapSupabaseToParty(data);
    if (!party) throw new Error("Failed to map updated party");
    return party;
  } catch (e) {
    console.error("Error in updateParty:", e);
    throw e;
  }
};

// 활성화된 가계부 저장 키
const ACTIVE_BUDGET_BOOK_KEY = "bb_active_budget_book";

// 개인 가계부 이름 저장 키 (사용자별)
const personalBudgetNameKey = (userId: string | null) => `bb_personal_name_${userId ?? "unknown"}`;

// 활성화된 가계부 ID 가져오기
export const getActiveBudgetBookId = async (): Promise<string | null> => {
  try {
    const stored = await AsyncStorage.getItem(ACTIVE_BUDGET_BOOK_KEY);
    return stored || null;
  } catch (e) {
    console.error("Error getting active budget book:", e);
    return null;
  }
};

// 활성화된 가계부 ID 저장
export const setActiveBudgetBookId = async (budgetBookId: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(ACTIVE_BUDGET_BOOK_KEY, budgetBookId);
  } catch (e) {
    console.error("Error setting active budget book:", e);
    throw e;
  }
};

// 모든 가계부 목록 가져오기 (개인 + 공유)
export const getAllBudgetBooks = async (): Promise<BudgetBook[]> => {
  try {
    const mode = await getAuthMode();
    if (mode === "guest") {
      // 게스트 모드: 개인 가계부만 반환
      return [
        {
          id: "personal",
          name: "내 가계부",
          type: "personal" as BudgetBookType,
          createdAt: Date.now(),
        },
      ];
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      return [
        {
          id: "personal",
          name: "내 가계부",
          type: "personal" as BudgetBookType,
          createdAt: Date.now(),
        },
      ];
    }

    const budgetBooks: BudgetBook[] = [];

    // 기존의 기본 개인 가계부(레거시) 유지 — 사용자가 이름을 변경했을 경우 사용자별 로컬 저장값을 우선 사용
    let personalName = "내 가계부";
    try {
      const uid = session.user?.id ?? null;
      const storedName = await AsyncStorage.getItem(personalBudgetNameKey(uid));
      if (storedName) personalName = storedName;
    } catch (e) {
      // ignore
    }

    budgetBooks.push({
      id: "personal",
      name: personalName,
      type: "personal",
      createdAt: Date.now(),
    });

    // 1) 사용자가 생성한 개인 가계부 (is_personal = true)
    const { data: personalParties, error: personalError } = await supabase
      .from("parties")
      .select("*")
      .eq("created_by", session.user.id)
      .eq("is_personal", true);

    if (!personalError && personalParties && personalParties.length > 0) {
      for (const p of personalParties) {
        const mapped = await mapSupabaseToParty(p);
        if (!mapped) continue;
        budgetBooks.push({
          id: mapped.id,
          name: mapped.name,
          type: "personal",
          isPersonal: true,
          createdBy: p.created_by,
          createdAt: mapped.createdAt,
        });
      }
    }

    // 2) 사용자가 멤버로 참여한 공유 가계부
    const { data: memberData, error: memberError } = await supabase
      .from("party_members")
      .select("party_id, role, joined_at")
      .eq("user_id", session.user.id);

    if (!memberError && memberData && memberData.length > 0) {
      const partyIds = memberData.map((m: any) => m.party_id);
      const { data: partiesData, error: partiesError } = await supabase.from("parties").select("*").in("id", partyIds);
      if (!partiesError && partiesData) {
        for (const partyRow of partiesData) {
          const memberInfo = memberData.find((m: any) => m.party_id === partyRow.id);
          if (!memberInfo) continue;
          const party = await mapSupabaseToParty(partyRow);
          if (!party) continue;
          budgetBooks.push({
            id: party.id,
            name: party.name,
            type: "shared",
            inviteCode: party.inviteCode || undefined,
            role: memberInfo.role,
            members: party.members,
            createdAt: party.createdAt,
          });
        }
      }
    }

    return budgetBooks;
  } catch (e) {
    console.error("Error loading all budget books:", e);
    // 에러 발생 시 최소한 개인 가계부는 반환
    return [
      {
        id: "personal",
        name: "내 가계부",
        type: "personal" as BudgetBookType,
        createdAt: Date.now(),
      },
    ];
  }
};

// 가계부 활성화
export const activateBudgetBook = async (budgetBookId: string): Promise<void> => {
  await setActiveBudgetBookId(budgetBookId);
  // 파티 업데이트 이벤트 발생하여 메인 화면도 업데이트
  try {
    const { emitPartyUpdate } = await import("./appEvents");
    emitPartyUpdate();
  } catch {}
};

// 현재 활성화된 가계부 객체(BudgetBook) 반환
export const getActiveBudgetBook = async (): Promise<BudgetBook | null> => {
  try {
    const activeId = await getActiveBudgetBookId();
    const books = await getAllBudgetBooks();
    if (!activeId) return null;
    return books.find((b) => b.id === activeId) || null;
  } catch (e) {
    console.error("Error getting active budget book:", e);
    return null;
  }
};
