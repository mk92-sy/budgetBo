import { supabase } from '@/lib/supabase';
import { Category } from '@/types/category';
import { TransactionType } from '@/types/transaction';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthMode } from './authMode';
import { getUserParty } from './party';

// UUID 생성 함수
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Supabase에서 Category를 앱의 Category 타입으로 변환
const mapSupabaseToCategory = (row: any): Category => {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    partyId: row.party_id || undefined,
    createdAt: new Date(row.created_at).getTime(),
  };
};

const LOCAL_CATEGORY_KEY = 'bb_local_categories';

const loadLocalCategories = async (): Promise<Category[]> => {
  const raw = await AsyncStorage.getItem(LOCAL_CATEGORY_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error parsing local categories', e);
    return [];
  }
};

const saveLocalCategories = async (categories: Category[]) => {
  await AsyncStorage.setItem(LOCAL_CATEGORY_KEY, JSON.stringify(categories));
};

// 카테고리 로드
export const loadCategories = async (): Promise<Category[]> => {
  try {
    const mode = await getAuthMode();
    if (mode === 'guest') {
      return await loadLocalCategories();
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.warn('No user session found');
      return [];
    }

    const userParty = await getUserParty();
    
    let query = supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: true });

    if (userParty) {
      query = query.or(
        `and(user_id.eq.${session.user.id},party_id.is.null),party_id.eq.${userParty.partyId}`
      );
    } else {
      query = query.eq('user_id', session.user.id).is('party_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading categories:', error);
      return [];
    }

    return (data || []).map(mapSupabaseToCategory);
  } catch (e) {
    console.error('Error loading categories:', e);
    return [];
  }
};

// 카테고리 저장 (호환성을 위해 유지)
export const saveCategories = async (categories: Category[]): Promise<void> => {
  console.warn('saveCategories is deprecated. Use individual CRUD operations instead.');
};

// 카테고리 추가
export const addCategory = async (type: TransactionType, name: string): Promise<Category> => {
  const mode = await getAuthMode();
  if (mode === 'guest') {
    const existing = await loadLocalCategories();
    const newCategory: Category = {
      id: generateUUID(),
      type,
      name,
      createdAt: Date.now(),
    };
    await saveLocalCategories([...existing, newCategory]);
    return newCategory;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('No user session found');
    }

    const userParty = await getUserParty();
    const categoryId = generateUUID();

    const { data, error } = await supabase
      .from('categories')
      .insert({
        id: categoryId,
        user_id: session.user.id,
        party_id: userParty?.partyId || null,
        type,
        name,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding category:', error);
      throw error;
    }

    return mapSupabaseToCategory(data);
  } catch (e) {
    console.error('Error adding category:', e);
    throw e;
  }
};

// 카테고리 수정
export const updateCategory = async (id: string, name: string): Promise<void> => {
  const mode = await getAuthMode();
  if (mode === 'guest') {
    const list = await loadLocalCategories();
    const updated = list.map((c) => (c.id === id ? { ...c, name } : c));
    await saveLocalCategories(updated);
    return;
  }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('No user session found');
    }

    const { error } = await supabase
      .from('categories')
      .update({ name })
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  } catch (e) {
    console.error('Error updating category:', e);
    throw e;
  }
};

// 카테고리 삭제
export const deleteCategory = async (id: string): Promise<void> => {
  const mode = await getAuthMode();
  if (mode === 'guest') {
    const list = await loadLocalCategories();
    await saveLocalCategories(list.filter((c) => c.id !== id));
    return;
  }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('No user session found');
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  } catch (e) {
    console.error('Error deleting category:', e);
    throw e;
  }
};

// 타입별 카테고리 가져오기
export const getCategoriesByType = async (type: TransactionType): Promise<string[]> => {
  const categories = await loadCategories();
  const names = categories
    .filter(c => c.type === type)
    .map(c => c.name);

  // 중복 제거 후 정렬
  return Array.from(new Set(names)).sort();
};

// 개인 카테고리(파티 미소속 데이터) 전부 삭제
export const deletePersonalCategories = async (): Promise<void> => {
  const mode = await getAuthMode();
  if (mode === 'guest') {
    await saveLocalCategories([]);
    return;
  }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('user_id', session.user.id)
      .is('party_id', null);
    if (error) {
      console.error('Error deleting personal categories:', error);
    }
  } catch (e) {
    console.error('Error deleting personal categories:', e);
  }
};

// 신규 회원용 기본 카테고리 생성
export const createDefaultCategoriesForUser = async (userId?: string): Promise<void> => {
  try {
    const mode = await getAuthMode();
    if (mode === 'guest') return;

    let uid = userId;
    if (!uid) {
      const { data: { session } } = await supabase.auth.getSession();
      uid = session?.user?.id;
    }
    if (!uid) return;
    const defaults = [
      { type: 'income', name: '월급' },
      { type: 'income', name: '기타' },
      { type: 'expense', name: '식비' },
      { type: 'expense', name: '생필품' },
      { type: 'expense', name: '공과금' },
      { type: 'expense', name: '월세' },
      { type: 'expense', name: '기타' },
    ];

    // Load existing personal categories for user
    const { data: existingData, error: fetchErr } = await supabase
      .from('categories')
      .select('type,name')
      .eq('user_id', uid)
      .is('party_id', null);

    if (fetchErr) {
      console.error('Error fetching existing categories:', fetchErr);
      return;
    }

    const existingSet = new Set<string>((existingData || []).map((r: any) => `${r.type}::${r.name}`));

    const toInsert = defaults
      .filter((d) => !existingSet.has(`${d.type}::${d.name}`))
      .map((d) => ({ id: generateUUID(), user_id: uid, party_id: null, type: d.type, name: d.name }));

    if (toInsert.length === 0) return;

    const { error } = await supabase.from('categories').insert(toInsert);
    if (error) {
      console.error('Error creating default categories:', error);
    }
  } catch (e) {
    console.error('Error in createDefaultCategoriesForUser:', e);
  }
};

