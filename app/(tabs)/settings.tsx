import { Category } from '@/types/category';
import { Party, UserParty } from '@/types/party';
import { TransactionType } from '@/types/transaction';
import { addCategory, deleteCategory, loadCategories, updateCategory } from '@/utils/category';
import { createParty, deleteParty, getParty, getUserParty, joinPartyByCode, leaveParty } from '@/utils/party';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
  const [party, setParty] = useState<Party | null>(null);
  const [userParty, setUserParty] = useState<UserParty | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [inviteCodeModalVisible, setInviteCodeModalVisible] = useState(false);
  const [joinCodeModalVisible, setJoinCodeModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [partyNameInput, setPartyNameInput] = useState('');
  const [categoryForm, setCategoryForm] = useState({
    type: 'expense' as TransactionType,
    name: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const partyData = await getParty();
    const userPartyData = await getUserParty();
    const categoriesData = await loadCategories();
    setParty(partyData);
    setUserParty(userPartyData);
    setCategories(categoriesData);
  };

  const handleCreateParty = async () => {
    if (!partyNameInput.trim()) {
      Alert.alert('오류', '파티 이름을 입력해주세요.');
      return;
    }

    const newParty = await createParty(partyNameInput.trim());
    setParty(newParty);
    setUserParty({
      partyId: newParty.id,
      role: 'host',
      joinedAt: Date.now(),
    });
    setPartyNameInput('');
    Alert.alert('성공', '파티가 생성되었습니다!');
  };

  const handleJoinParty = async () => {
    if (!inviteCodeInput.trim()) {
      Alert.alert('오류', '초대코드를 입력해주세요.');
      return;
    }

    const joinedParty = await joinPartyByCode(inviteCodeInput.trim().toUpperCase());
    if (joinedParty) {
      setParty(joinedParty);
      setUserParty({
        partyId: joinedParty.id,
        role: 'member',
        joinedAt: Date.now(),
      });
      setInviteCodeInput('');
      setJoinCodeModalVisible(false);
      Alert.alert('성공', '파티에 참가했습니다!');
      await loadData();
    } else {
      Alert.alert('오류', '유효하지 않은 초대코드입니다.');
    }
  };

  const handleLeaveParty = () => {
    Alert.alert('파티 나가기', '정말 파티를 나가시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '나가기',
        style: 'destructive',
        onPress: async () => {
          await leaveParty();
          setParty(null);
          setUserParty(null);
          Alert.alert('완료', '파티에서 나갔습니다.');
        },
      },
    ]);
  };

  const handleDeleteParty = () => {
    if (userParty?.role !== 'host') {
      Alert.alert('오류', '파티장만 파티를 삭제할 수 있습니다.');
      return;
    }

    Alert.alert('파티 삭제', '정말 파티를 삭제하시겠습니까? 모든 데이터가 삭제됩니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          await deleteParty();
          setParty(null);
          setUserParty(null);
          Alert.alert('완료', '파티가 삭제되었습니다.');
        },
      },
    ]);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      Alert.alert('오류', '카테고리 이름을 입력해주세요.');
      return;
    }

    if (editingCategory) {
      await updateCategory(editingCategory.id, categoryForm.name.trim());
    } else {
      await addCategory(categoryForm.type, categoryForm.name.trim());
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
    setEditingCategory(null);
    setCategoryForm({ type, name: '' });
    setCategoryModalVisible(true);
  };

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  return (
    <View className="flex-1 bg-white">
      <View className="pt-4 pb-4 px-4 bg-blue-500">
        <Text className="text-2xl font-bold text-white">설정</Text>
      </View>

      <ScrollView className="flex-1">
        {/* 파티 섹션 */}
        <View className="p-4 border-b border-gray-200">
          <Text className="text-lg font-semibold mb-3 text-gray-800">파티 관리</Text>
          
          {party ? (
            <View className="bg-gray-50 rounded-lg p-4">
              <View className="flex-row justify-between items-center mb-2">
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

              <View className="flex-row gap-2 mt-3">
                {userParty?.role === 'host' && (
                  <TouchableOpacity
                    onPress={handleDeleteParty}
                    className="flex-1 bg-red-500 py-2 rounded"
                  >
                    <Text className="text-white text-center font-semibold">파티 삭제</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleLeaveParty}
                  className="flex-1 bg-gray-500 py-2 rounded"
                >
                  <Text className="text-white text-center font-semibold">파티 나가기</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View className="gap-2">
              <TouchableOpacity
                onPress={() => setInviteCodeModalVisible(true)}
                className="bg-blue-500 py-3 rounded-lg"
              >
                <Text className="text-white text-center font-semibold">새 파티 만들기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setJoinCodeModalVisible(true)}
                className="bg-green-500 py-3 rounded-lg"
              >
                <Text className="text-white text-center font-semibold">초대코드로 참가</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* 카테고리 섹션 */}
        <View className="p-4">
          <Text className="text-lg font-semibold mb-3 text-gray-800">카테고리 관리</Text>

          {/* 수입 카테고리 */}
          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-gray-700 font-medium">수입 카테고리</Text>
              <TouchableOpacity
                onPress={() => openAddCategoryModal('income')}
                className="bg-green-500 px-3 py-1 rounded"
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
                    className="bg-blue-500 px-3 py-1 rounded"
                  >
                    <Text className="text-white text-xs">수정</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteCategory(category)}
                    className="bg-red-500 px-3 py-1 rounded"
                  >
                    <Text className="text-white text-xs">삭제</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {/* 지출 카테고리 */}
          <View>
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-gray-700 font-medium">지출 카테고리</Text>
              <TouchableOpacity
                onPress={() => openAddCategoryModal('expense')}
                className="bg-red-500 px-3 py-1 rounded"
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
                    className="bg-blue-500 px-3 py-1 rounded"
                  >
                    <Text className="text-white text-xs">수정</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteCategory(category)}
                    className="bg-red-500 px-3 py-1 rounded"
                  >
                    <Text className="text-white text-xs">삭제</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* 파티 생성 모달 */}
      <Modal
        visible={inviteCodeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setInviteCodeModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
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
      </Modal>

      {/* 초대코드 입력 모달 */}
      <Modal
        visible={joinCodeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setJoinCodeModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
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
            <TouchableOpacity onPress={handleJoinParty} className="bg-green-500 py-4 rounded-lg">
              <Text className="text-white text-center font-bold text-lg">참가</Text>
            </TouchableOpacity>
          </View>
        </View>
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
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
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
      </Modal>
    </View>
  );
}

