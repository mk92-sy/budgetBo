import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Category } from '@/types/category';
import { Party, UserParty } from '@/types/party';
import { TransactionType } from '@/types/transaction';
import { emitPartyUpdate } from '@/utils/appEvents';
import { addCategory, deleteCategory, deletePersonalCategories, loadCategories, updateCategory } from '@/utils/category';
import { createParty, deleteParty, getParty, getUserParty, joinPartyByCode, leaveParty, removePartyMember, updateParty } from '@/utils/party';
import { deletePersonalTransactions } from '@/utils/storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';


type ConfirmDialogType = 'joinParty' | 'leaveParty' | 'deleteParty' | 'removeMember' | null;
type TabType = 'category' | 'party' | 'profile';

export default function SettingsScreen() {
  const { isGuest, signOut, userName } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('category');
  const [party, setParty] = useState<Party | null>(null);
  const [userParty, setUserParty] = useState<UserParty | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inviteCodeModalVisible, setInviteCodeModalVisible] = useState(false);
  const [editPartyModalVisible, setEditPartyModalVisible] = useState(false);
  const [joinCodeModalVisible, setJoinCodeModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [partyNameInput, setPartyNameInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogType>(null);
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    type: 'expense' as TransactionType,
    name: '',
  });

  // Profile (닉네임)
  const [nicknameInput, setNicknameInput] = useState('');
  const [displayedNickname, setDisplayedNickname] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);

  const syncPartyMemberNicknames = useCallback(async (options: { persist?: boolean } = {}) => {
    const { persist = false } = options;
    try {
      if (!party?.members || party.members.length === 0) return;
      const memberIds = party.members.map((m) => m.userId);
      // Try to fetch latest metadata from users table (may be restricted by RLS)
      const { data: usersData, error } = await supabase
        .from('users')
        .select('id, user_metadata')
        .in('id', memberIds);
      if (error || !usersData) return;

      const metaById = new Map<string, any>();
      usersData.forEach((u: any) => metaById.set(u.id, u.user_metadata));

      const updatedMembers = party.members.map((m) => {
        const meta = metaById.get(m.userId) || {};
        const latest = meta?.nickname || meta?.name || meta?.full_name;
        if (latest && latest !== m.displayName) {
          return { ...m, displayName: latest };
        }
        return m;
      });

      // If there were changes, update local party state so UI reflects latest names
      const changed = updatedMembers.some((um, idx) => um.displayName !== party.members[idx].displayName);
      if (changed) {
        setParty({ ...(party as any), members: updatedMembers });

        // If requested, try to persist the updated display names back to party_members (best-effort)
        if (persist && party?.id) {
          let anyPersisted = false;
          for (const updated of updatedMembers) {
            const original = party.members.find((m) => m.userId === updated.userId);
            if (!original) continue;
            if (original.displayName === updated.displayName) continue;
            try {
              const { error: memberError } = await supabase
                .from('party_members')
                .update({ display_name: updated.displayName })
                .eq('user_id', updated.userId)
                .eq('party_id', party.id);
              if (memberError) {
                console.warn('Failed to persist party member display_name', memberError);
              } else {
                anyPersisted = true;
              }
            } catch {
              console.warn('Failed to persist party member display_name');
            }
          }

          // If any persistence succeeded, reload from the server to ensure canonical state
          if (anyPersisted) {
            try {
              await loadData();
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (e) {
      // ignore errors (RLS or other permission issues may prevent reads)
      console.warn('Failed to sync party member nicknames', e);
    }
  }, [party]);

  // 최대 카테고리 수 (수입/지출 각각)
  const MAX_CATEGORIES_PER_TYPE = 20;

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const nick = (data?.user?.user_metadata as any)?.nickname || '';
        const em = data?.user?.email || '';
        setDisplayedNickname(nick);
        setEmail(em);
      } catch {
        // ignore
      }
    })();
  }, []);

  // Ensure nickname input shows the user's current nickname when opening the profile tab
  // remove auto-syncing nicknameInput; we'll populate nicknameInput only when opening the edit modal

  // When the active tab switches to 'party', attempt to sync member nicknames for display
  useEffect(() => {
    if (activeTab === 'party') {
      // Ensure we have up-to-date party data before syncing display names
      (async () => {
        try {
          await loadData();
          await syncPartyMemberNicknames();
        } catch {
          // ignore
        }
      })();
    }
  }, [activeTab, syncPartyMemberNicknames]);

  // initial load of data
  useEffect(() => {
    (async () => {
      try {
        await loadData();
      } catch {
        // ignore
      }
    })();
  }, []);

  const loadData = async () => {
    const partyData = await getParty();
    const userPartyData = await getUserParty();
    const categoriesData = await loadCategories();
    setParty(partyData);
    setUserParty(userPartyData);
    setCategories(categoriesData);
  };

  // Open Party tab: always refresh and sync nicknames (even if tab is already active)
  const openPartyTab = async () => {
    setActiveTab('party');
    try {
      await loadData();
      // Attempt to sync display names and persist them to party_members if possible
      await syncPartyMemberNicknames({ persist: true });
    } catch {
      // ignore
    }
  };

  const handleCreateParty = async () => {
    const newParty = await createParty(partyNameInput.trim());
    setParty(newParty);
    setUserParty({
      partyId: newParty.id,
      role: 'host',
      joinedAt: Date.now(),
    });
    setPartyNameInput('');
    setInviteCodeModalVisible(false);
    Alert.alert('성공', '파티가 생성되었습니다!');
  };

  const openEditPartyModal = () => {
    if (!party) return;
    setPartyNameInput(party.name);
    setEditPartyModalVisible(true);
  };

  const handleUpdatePartyName = async () => {
    if (!party) return;
    if (!partyNameInput.trim()) {
      Alert.alert('오류', '파티 이름을 입력해주세요.');
      return;
    }
    try {
      const updated = await updateParty(party.id, partyNameInput.trim());
      setParty(updated);
      setEditPartyModalVisible(false);
      setPartyNameInput('');
      Alert.alert('완료', '파티 이름이 변경되었습니다.');
      // notify app that party changed
      try { emitPartyUpdate(); } catch {}
    } catch (error: any) {
      Alert.alert('오류', error?.message || '파티 이름 변경 중 오류가 발생했습니다.');
    }
  };

  const handleJoinPartyConfirm = async () => {
    if (isJoining) return;

    const inviteCode = inviteCodeInput.trim().toUpperCase();
    setConfirmDialog(null);
    setIsJoining(true);

    try {
      const joinedParty = await joinPartyByCode(inviteCode);
      
      await deletePersonalTransactions();
      await deletePersonalCategories();

      setParty(joinedParty);
      setUserParty({
        partyId: joinedParty?.id || '',
        role: 'member',
        joinedAt: Date.now(),
      });
      setInviteCodeInput('');
      setJoinCodeModalVisible(false);
      
      Alert.alert('✅ 성공', '파티에 참가했습니다!');
      await loadData();
    } catch (error: any) {
      Alert.alert(
        '❌ 파티 가입 실패',
        error?.message || '파티 가입 중 오류가 발생했습니다.\n다시 시도해주세요.'
      );
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinParty = async () => {
    if (isGuest) {
      Alert.alert('로그인 필요', '파티 기능은 로그인 후 사용 가능합니다.');
      return;
    }
    if (!inviteCodeInput.trim()) {
      Alert.alert('오류', '초대코드를 입력해주세요.');
      return;
    }

    setConfirmDialog('joinParty');
  };

  const handleLeaveParty = () => {
    if (isGuest) {
      Alert.alert('로그인 필요', '파티 기능은 로그인 후 사용 가능합니다.');
      return;
    }
    setConfirmDialog('leaveParty');
  };

  const handleLeavePartyConfirm = async () => {
    try {
      await leaveParty();
      setParty(null);
      setUserParty(null);
      setConfirmDialog(null);
      Alert.alert('완료', '파티에서 나갔습니다.');
      await loadData();
    } catch (error: any) {
      Alert.alert('오류', error?.message || '파티 나가기 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteParty = () => {
    if (isGuest) {
      Alert.alert('로그인 필요', '파티 기능은 로그인 후 사용 가능합니다.');
      return;
    }
    if (userParty?.role !== 'host') {
      Alert.alert('오류', '파티장만 파티를 삭제할 수 있습니다.');
      return;
    }
    setConfirmDialog('deleteParty');
  };

  const handleDeletePartyConfirm = async () => {
    try {
      await deleteParty();
      setParty(null);
      setUserParty(null);
      setConfirmDialog(null);
      Alert.alert('완료', '파티가 삭제되었습니다.');
      await loadData();
    } catch (error: any) {
      Alert.alert('오류', error?.message || '파티 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleRemoveMember = (memberId: string) => {
    if (!party || !userParty) return;
    setPendingMemberId(memberId);
    setConfirmDialog('removeMember');
  };

  const handleRemoveMemberConfirm = async () => {
    if (!party || !pendingMemberId) return;
    try {
      await removePartyMember(party.id, pendingMemberId);
      setConfirmDialog(null);
      setPendingMemberId(null);
      Alert.alert('완료', '파티원이 강퇴되었습니다.');
      await loadData();
    } catch (error: any) {
      Alert.alert('오류', error?.message || '파티원 강퇴 중 오류가 발생했습니다.');
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      Alert.alert('오류', '카테고리 이름을 입력해주세요.');
      return;
    }

    // 안전 검사: 새 카테고리 추가 시 타입별 최대 개수 제한 확인
    if (!editingCategory) {
      const currentCount = categories.filter(c => c.type === categoryForm.type).length;
      if (currentCount >= MAX_CATEGORIES_PER_TYPE) {
        Alert.alert('제한 초과', `더 이상 생성할 수 없습니다. 최대 ${MAX_CATEGORIES_PER_TYPE}개까지 생성 가능합니다.`);
        return;
      }
      await addCategory(categoryForm.type, categoryForm.name.trim());
    } else {
      await updateCategory(editingCategory.id, categoryForm.name.trim());
    }

    await loadData();
    setCategoryModalVisible(false);
    setEditingCategory(null);
    setCategoryForm({ type: 'expense', name: '' });
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryForm({
      type: category.type,
      name: category.name,
    });
    setCategoryModalVisible(true);
  };

  const handleDeleteCategory = (category: Category) => {
    Alert.alert('카테고리 삭제', '정말 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await deleteCategory(category.id);
          await loadData();
        },
      },
    ]);
  };

  const openAddCategoryModal = (type: TransactionType) => {
    const currentCount = categories.filter(c => c.type === type).length;
    if (currentCount >= MAX_CATEGORIES_PER_TYPE) {
      Alert.alert('제한 초과', `더 이상 생성할 수 없습니다. 최대 ${MAX_CATEGORIES_PER_TYPE}개까지 생성 가능합니다.`);
      return;
    }
    setEditingCategory(null);
    setCategoryForm({ type, name: '' });
    setCategoryModalVisible(true);
  };

  // Profile: 닉네임 저장
  const handleSaveNickname = async () => {
    if (isGuest) {
      Alert.alert('로그인 필요', '내 정보는 로그인 후에 변경 가능합니다.');
      return;
    }
    if (!nicknameInput.trim()) {
      Alert.alert('오류', '닉네임을 입력해주세요.');
      return;
    }
    try {
      const trimmedNickname = nicknameInput.trim();
      const { error } = await supabase.auth.updateUser({ data: { nickname: trimmedNickname } as any });
      if (error) throw error;
      // refresh nickname from server to ensure consistency (fallback to trimmed value)
      const { data } = await supabase.auth.getUser();
      const nick = (data?.user?.user_metadata as any)?.nickname || trimmedNickname;
      setDisplayedNickname(nick);
      // Cache current user id once so we can reuse it below
      let currentUserId: string | null = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        currentUserId = session?.user?.id ?? null;
      } catch {
        currentUserId = null;
      }
      // Optimistically update local party state so member list reflects the new nickname immediately
      if (currentUserId && nick) {
        setParty((prev) => {
          if (!prev) return prev;
          const updatedMembers = prev.members.map((member) =>
            member.userId === currentUserId ? { ...member, displayName: nick } : member
          );
          const changed = updatedMembers.some((member, idx) => member.displayName !== prev.members[idx].displayName);
          if (!changed) return prev;
          return { ...prev, members: updatedMembers };
        });
      }
      // Update party_members.display_name for ALL parties this user is a member of (best-effort)
      try {
        if (currentUserId) {
          try {
            const { error: memberError } = await supabase
              .from('party_members')
              .update({ display_name: nick })
              .eq('user_id', currentUserId);
            if (memberError) console.warn('Failed to update party member display_name', memberError);
          } catch (err) {
            console.warn('Failed to update party member display_name', err);
          }
        }
      } catch {
        console.warn('Failed to update party member display_name');
      }

      // refresh local party data and notify listeners
      try {
        await loadData();
        await syncPartyMemberNicknames({ persist: true });
      } catch {}
      try { emitPartyUpdate(); } catch {}

      Alert.alert('완료', '닉네임이 변경되었습니다.');
    } catch (e: any) {
      console.error('Failed to update nickname', e);
      Alert.alert('오류', e?.message || '닉네임 변경 중 오류가 발생했습니다.');
    }
  };

  

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View className="pt-4 pb-4 px-4 bg-blue-500">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-white">설정</Text>
          <TouchableOpacity onPress={signOut} className="px-3 py-1">
            <Text className="text-white font-semibold">로그아웃</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 탭 메뉴 - 알약 형태, 왼쪽 정렬, 가로 스크롤 지원 */}
      <View className="px-4 pt-3 pb-2 bg-white">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ alignItems: 'center' }}
        >
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={() => setActiveTab('category')}
              className={`px-6 py-2 rounded-full ${activeTab === 'category' ? 'bg-blue-500' : 'bg-gray-200'}`}
            >
              <Text className={`font-semibold text-sm ${activeTab === 'category' ? 'text-white' : 'text-gray-700'}`}>
                카테고리 관리
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => openPartyTab()}
              className={`px-6 py-2 rounded-full ${activeTab === 'party' ? 'bg-blue-500' : 'bg-gray-200'}`}
            >
              <Text className={`font-semibold text-sm ${activeTab === 'party' ? 'text-white' : 'text-gray-700'}`}>
                파티 관리
              </Text>
            </TouchableOpacity>
            

            <TouchableOpacity
              onPress={() => setActiveTab('profile')}
              className={`px-6 py-2 rounded-full ${activeTab === 'profile' ? 'bg-blue-500' : 'bg-gray-200'}`}
            >
              <Text className={`font-semibold text-sm ${activeTab === 'profile' ? 'text-white' : 'text-gray-700'}`}>
                내 정보 관리
              </Text>
            </TouchableOpacity>

            
          </View>
        </ScrollView>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}>
        {/* 카테고리 관리 탭 */}
        {activeTab === 'category' && (
          <View className="p-4">
            <Text className="text-lg font-semibold mb-3 text-gray-800">카테고리 관리</Text>

            {/* 수입 카테고리 */}
            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-700 font-medium">수입 카테고리 ({incomeCategories.length}/{MAX_CATEGORIES_PER_TYPE})</Text>
                <TouchableOpacity
                  onPress={() => openAddCategoryModal('income')}
                  className={`px-3 py-1 rounded ${incomeCategories.length >= MAX_CATEGORIES_PER_TYPE ? 'bg-gray-300' : 'bg-green-500'}`}
                  disabled={incomeCategories.length >= MAX_CATEGORIES_PER_TYPE}
                >
                  <Text className="text-white text-xs">+ 추가</Text>
                </TouchableOpacity>
              </View>
              {incomeCategories.map((category) => (
                <View
                  key={category.id}
                  className="bg-white rounded-lg p-3 mb-2 border border-gray-200 flex-row items-center justify-between"
                >
                  <Text className="text-gray-800 flex-1">{category.name}</Text>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => handleEditCategory(category)}
                      className="bg-blue-500 px-3 py-2 rounded"
                    >
                      <Ionicons name="pencil-outline" size={16} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteCategory(category)}
                      className="bg-red-500 px-3 py-2 rounded"
                    >
                      <Ionicons name="trash-outline" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            {/* 지출 카테고리 */}
            <View>
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-700 font-medium">지출 카테고리 ({expenseCategories.length}/{MAX_CATEGORIES_PER_TYPE})</Text>
                <TouchableOpacity
                  onPress={() => openAddCategoryModal('expense')}
                  className={`px-3 py-1 rounded ${expenseCategories.length >= MAX_CATEGORIES_PER_TYPE ? 'bg-gray-300' : 'bg-red-500'}`}
                  disabled={expenseCategories.length >= MAX_CATEGORIES_PER_TYPE}
                >
                  <Text className="text-white text-xs">+ 추가</Text>
                </TouchableOpacity>
              </View>
              {expenseCategories.map((category) => (
                <View
                  key={category.id}
                  className="bg-white rounded-lg p-3 mb-2 border border-gray-200 flex-row items-center justify-between"
                >
                  <Text className="text-gray-800 flex-1">{category.name}</Text>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => handleEditCategory(category)}
                      className="bg-blue-500 px-3 py-2 rounded"
                    >
                      <Ionicons name="pencil-outline" size={16} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteCategory(category)}
                      className="bg-red-500 px-3 py-2 rounded"
                    >
                      <Ionicons name="trash-outline" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 파티 관리 탭 */}
        {activeTab === 'party' && (
          <View className="p-4">
            <Text className="text-lg font-semibold mb-3 text-gray-800">파티 관리</Text>
            
            {party ? (
              <View className="bg-gray-50 rounded-lg p-4">
                <View className="flex-row justify-between items-center mb-3">
                  <View className="flex-1">
                    <Text className="text-gray-600 text-sm mb-1">파티 이름</Text>
                    <Text className="text-gray-800 font-semibold text-lg">{party.name}</Text>
                  </View>
                  <View className={`px-3 py-1 rounded ${userParty?.role === 'host' ? 'bg-blue-100' : 'bg-gray-200'}`}>
                    <Text className={`text-xs font-semibold ${userParty?.role === 'host' ? 'text-blue-700' : 'text-gray-700'}`}>
                      {userParty?.role === 'host' ? '파티장' : '파티원'}
                    </Text>
                  </View>
                </View>
                
                {userParty?.role === 'host' && (
                  <View className="mt-3 mb-3">
                    <Text className="text-gray-600 text-sm mb-1">초대코드</Text>
                    <View className="flex-row items-center">
                      <Text className="text-2xl font-bold text-blue-600 mr-2">{party.inviteCode}</Text>
                      <TouchableOpacity
                        onPress={async () => {
                          await Clipboard.setStringAsync(party.inviteCode);
                          Alert.alert('복사 완료', '초대코드가 클립보드에 복사되었습니다.');
                        }}
                        className="bg-blue-500 px-3 py-1 rounded"
                      >
                        <Text className="text-white text-xs">복사</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <View className="mt-3">
                  <Text className="text-gray-600 text-sm mb-2">파티 멤버</Text>
                  {party.members?.map((member) => {
                    const isHost = member.role === 'host';
                    const name =
                      member.displayName ||
                      `${member.userId.slice(0, 8)}...${member.userId.slice(-4)}`;
                    return (
                      <View
                        key={member.userId}
                        className="flex-row items-center justify-between bg-white rounded-lg p-3 mb-2 border border-gray-200"
                      >
                        <View>
                          <Text className="text-gray-800 font-semibold">{name}</Text>
                          <Text className="text-gray-500 text-xs">
                            {isHost ? '파티장' : '파티원'}
                          </Text>
                        </View>
                        {userParty?.role === 'host' && !isHost && (
                          <TouchableOpacity
                            onPress={() => handleRemoveMember(member.userId)}
                            className="bg-red-500 px-3 py-1 rounded"
                          >
                            <Text className="text-white text-xs">강퇴</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>

                <View className="flex-row gap-2 mt-4">
                  {userParty?.role === 'host' ? (
                    <>
                      <TouchableOpacity
                        onPress={handleDeleteParty}
                        className="flex-1 bg-red-500 py-2 rounded"
                      >
                        <Text className="text-white text-center font-semibold">파티 삭제</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={openEditPartyModal}
                        className="flex-1 bg-gray-500 py-2 rounded"
                      >
                        <Text className="text-white text-center font-semibold">파티 이름 변경</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      onPress={handleLeaveParty}
                      className="flex-1 bg-gray-500 py-2 rounded"
                    >
                      <Text className="text-white text-center font-semibold">파티 나가기</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <View className="gap-2">
                <TouchableOpacity
                  onPress={() => {
                    if (isGuest) {
                      Alert.alert('로그인 필요', '파티 기능은 로그인 후 사용 가능합니다.');
                    } else {
                      setPartyNameInput(`${userName}님의 공유가계부`);
                      setInviteCodeModalVisible(true);
                    }
                  }}
                  className="bg-blue-500 py-3 rounded-lg"
                >
                  <Text className="text-white text-center font-semibold">새 파티 만들기</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (isGuest) {
                      Alert.alert('로그인 필요', '파티 기능은 로그인 후 사용 가능합니다.');
                    } else {
                      setJoinCodeModalVisible(true);
                    }
                  }}
                  className="bg-green-500 py-3 rounded-lg"
                >
                  <Text className="text-white text-center font-semibold">초대코드로 참가</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* 프로필 탭 */}
        {activeTab === 'profile' && (
          <View className="p-4">
            <Text className="text-lg font-semibold mb-3 text-gray-800">내 정보 관리</Text>

            <View className="mb-4">
              <Text className="text-gray-600 mb-2">이메일</Text>
              <Text className="text-gray-800">{email || '—'}</Text>
            </View>

            <View className="mb-4">
              <Text className="text-gray-600 mb-2">닉네임</Text>
              <View className="flex-row items-center justify-between">
                <Text className="text-gray-800">{displayedNickname || '—'}</Text>
                <TouchableOpacity onPress={() => { setNicknameModalVisible(true); setNicknameInput(displayedNickname || ''); }} className="bg-gray-200 px-3 py-1 rounded">
                  <Text className="text-sm">수정</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 닉네임 수정 모달 */}
            <Modal
              visible={nicknameModalVisible}
              animationType="slide"
              transparent={true}
              onRequestClose={() => setNicknameModalVisible(false)}
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
              >
                <View className="flex-1 bg-black/50 justify-end">
                  <View className="bg-white rounded-t-3xl p-6" style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
                    <View className="flex-row justify-between items-center mb-4">
                      <Text className="text-xl font-bold">닉네임 수정</Text>
                      <TouchableOpacity onPress={() => setNicknameModalVisible(false)}>
                        <Text className="text-gray-500 text-lg">✕</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      value={nicknameInput}
                      onChangeText={setNicknameInput}
                      placeholder="새 닉네임을 입력하세요"
                      className="border border-gray-300 rounded-lg px-4 py-3 mb-4"
                    />
                    <TouchableOpacity
                      onPress={async () => {
                        await handleSaveNickname();
                        setNicknameModalVisible(false);
                      }}
                      className="bg-blue-500 py-3 rounded-lg"
                    >
                      <Text className="text-white text-center font-semibold">저장</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </Modal>

            {/* 이메일은 가입 시 입력한 값만 보여줍니다 (수정 불가) */}
          </View>
        )}

        
      </ScrollView>

      {/* 파티 생성 모달 */}
      <Modal
        visible={inviteCodeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setInviteCodeModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl p-6" style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold">새 파티 만들기</Text>
                <TouchableOpacity onPress={() => setInviteCodeModalVisible(false)}>
                  <Text className="text-gray-500 text-lg">✕</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={partyNameInput}
                onChangeText={setPartyNameInput}
                placeholder="파티 이름을 입력하세요"
                className="border border-gray-300 rounded-lg px-4 py-3 mb-4"
              />
              <TouchableOpacity onPress={handleCreateParty} className="bg-blue-500 py-4 rounded-lg">
                <Text className="text-white text-center font-bold text-lg">생성</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 파티 이름 변경 모달 */}
      <Modal
        visible={editPartyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditPartyModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl p-6" style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold">파티 이름 변경</Text>
                <TouchableOpacity onPress={() => setEditPartyModalVisible(false)}>
                  <Text className="text-gray-500 text-lg">✕</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={partyNameInput}
                onChangeText={setPartyNameInput}
                placeholder="파티 이름을 입력하세요"
                className="border border-gray-300 rounded-lg px-4 py-3 mb-4"
              />
              <TouchableOpacity onPress={handleUpdatePartyName} className="bg-blue-500 py-4 rounded-lg">
                <Text className="text-white text-center font-bold text-lg">변경</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 초대코드 입력 모달 */}
      <Modal
        visible={joinCodeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setJoinCodeModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl p-6" style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold">초대코드 입력</Text>
                <TouchableOpacity onPress={() => setJoinCodeModalVisible(false)}>
                  <Text className="text-gray-500 text-lg">✕</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={inviteCodeInput}
                onChangeText={setInviteCodeInput}
                placeholder="초대코드를 입력하세요"
                className="border border-gray-300 rounded-lg px-4 py-3 mb-4"
                autoCapitalize="characters"
              />
              <TouchableOpacity 
                onPress={handleJoinParty} 
                className={`py-4 rounded-lg ${isJoining ? 'bg-gray-400' : 'bg-green-500'}`}
                disabled={isJoining}
              >
                <Text className="text-white text-center font-bold text-lg">
                  {isJoining ? '처리 중...' : '참가'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 카테고리 추가/수정 모달 */}
      <Modal
        visible={categoryModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setCategoryModalVisible(false);
          setEditingCategory(null);
          setCategoryForm({ type: 'expense', name: '' });
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-white rounded-t-3xl p-6" style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold">
                  {editingCategory ? '카테고리 수정' : '카테고리 추가'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setCategoryModalVisible(false);
                    setEditingCategory(null);
                    setCategoryForm({ type: 'expense', name: '' });
                  }}
                >
                  <Text className="text-gray-500 text-lg">✕</Text>
                </TouchableOpacity>
              </View>
              <View className="mb-4">
                <Text className="text-gray-700 mb-2 font-medium">유형</Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setCategoryForm({ ...categoryForm, type: 'income' })}
                    className={`flex-1 py-3 rounded-lg ${
                      categoryForm.type === 'income' ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  >
                    <Text
                      className={`text-center font-semibold ${
                        categoryForm.type === 'income' ? 'text-white' : 'text-gray-700'
                      }`}
                    >
                      수입
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCategoryForm({ ...categoryForm, type: 'expense' })}
                    className={`flex-1 py-3 rounded-lg ${
                      categoryForm.type === 'expense' ? 'bg-red-500' : 'bg-gray-200'
                    }`}
                  >
                    <Text
                      className={`text-center font-semibold ${
                        categoryForm.type === 'expense' ? 'text-white' : 'text-gray-700'
                      }`}
                    >
                      지출
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View className="mb-4">
                <Text className="text-gray-700 mb-2 font-medium">카테고리 이름</Text>
                <TextInput
                  value={categoryForm.name}
                  onChangeText={(text) => setCategoryForm({ ...categoryForm, name: text })}
                  placeholder="카테고리 이름을 입력하세요"
                  className="border border-gray-300 rounded-lg px-4 py-3"
                />
              </View>
              <TouchableOpacity onPress={handleSaveCategory} className="bg-blue-500 py-4 rounded-lg">
                <Text className="text-white text-center font-bold text-lg">저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 확인 모달 */}
      <Modal
        visible={confirmDialog !== null}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setConfirmDialog(null)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <View className="bg-white rounded-lg p-6 w-full">
            {confirmDialog === 'joinParty' && (
              <>
                <Text className="text-xl font-bold mb-3">⚠️ 파티 참가</Text>
                <Text className="text-gray-700 mb-6 leading-6">
                  파티에 가입하면 개인 가계부 데이터가 삭제되고 파티장의 가계부 데이터로 동기화됩니다.
                  
                  계속하시겠습니까?
                </Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setConfirmDialog(null)}
                    className="flex-1 bg-gray-300 py-3 rounded-lg"
                  >
                    <Text className="text-center font-semibold text-gray-700">취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleJoinPartyConfirm}
                    disabled={isJoining}
                    className={`flex-1 py-3 rounded-lg ${isJoining ? 'bg-gray-400' : 'bg-blue-500'}`}
                  >
                    <Text className="text-center font-semibold text-white">
                      {isJoining ? '처리중...' : '참가'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            
            {confirmDialog === 'leaveParty' && (
              <>
                <Text className="text-xl font-bold mb-3">파티 나가기</Text>
                <Text className="text-gray-700 mb-6">정말 파티를 나가시겠습니까?</Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setConfirmDialog(null)}
                    className="flex-1 bg-gray-300 py-3 rounded-lg"
                  >
                    <Text className="text-center font-semibold text-gray-700">취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleLeavePartyConfirm}
                    className="flex-1 bg-red-500 py-3 rounded-lg"
                  >
                    <Text className="text-center font-semibold text-white">나가기</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {confirmDialog === 'deleteParty' && (
              <>
                <Text className="text-xl font-bold mb-3">파티 삭제</Text>
                <Text className="text-gray-700 mb-6">정말 파티를 삭제하시겠습니까? 모든 데이터가 삭제됩니다.</Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setConfirmDialog(null)}
                    className="flex-1 bg-gray-300 py-3 rounded-lg"
                  >
                    <Text className="text-center font-semibold text-gray-700">취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleDeletePartyConfirm}
                    className="flex-1 bg-red-500 py-3 rounded-lg"
                  >
                    <Text className="text-center font-semibold text-white">삭제</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {confirmDialog === 'removeMember' && (
              <>
                <Text className="text-xl font-bold mb-3">파티원 강퇴</Text>
                <Text className="text-gray-700 mb-6">정말 이 파티원을 강퇴하시겠습니까?</Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => setConfirmDialog(null)}
                    className="flex-1 bg-gray-300 py-3 rounded-lg"
                  >
                    <Text className="text-center font-semibold text-gray-700">취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleRemoveMemberConfirm}
                    className="flex-1 bg-red-500 py-3 rounded-lg"
                  >
                    <Text className="text-center font-semibold text-white">강퇴</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

