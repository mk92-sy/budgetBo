import AsyncStorage from '@react-native-async-storage/async-storage';
import { Category } from '@/types/category';
import { TransactionType } from '@/types/transaction';
import { getUserParty } from './party';

const CATEGORIES_STORAGE_KEY = '@budgetbook_categories';

// 기본 카테고리 가져오기
export const getDefaultCategories = (type: TransactionType): string[] => {
  if (type === 'income') {
    return ['급여', '용돈', '부수입', '기타 수입'];
  }
  return ['식비', '교통비', '쇼핑', '문화생활', '의료비', '통신비', '기타 지출'];
};

// 카테고리 로드
export const loadCategories = async (): Promise<Category[]> => {
  try {
    const jsonValue = await AsyncStorage.getItem(CATEGORIES_STORAGE_KEY);
    const saved: Category[] = jsonValue != null ? JSON.parse(jsonValue) : [];
    
    // 기본 카테고리가 없으면 생성
    if (saved.length === 0) {
      const defaultCategories: Category[] = [
        ...getDefaultCategories('income').map((name, index) => ({
          id: `cat_income_${index}`,
          type: 'income' as TransactionType,
          name,
          createdAt: Date.now(),
        })),
        ...getDefaultCategories('expense').map((name, index) => ({
          id: `cat_expense_${index}`,
          type: 'expense' as TransactionType,
          name,
          createdAt: Date.now(),
        })),
      ];
      await saveCategories(defaultCategories);
      return defaultCategories;
    }
    
    return saved;
  } catch (e) {
    console.error('Error loading categories:', e);
    return [];
  }
};

// 카테고리 저장
export const saveCategories = async (categories: Category[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  } catch (e) {
    console.error('Error saving categories:', e);
  }
};

// 카테고리 추가
export const addCategory = async (type: TransactionType, name: string): Promise<Category> => {
  const categories = await loadCategories();
  const userParty = await getUserParty();
  
  const newCategory: Category = {
    id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    name,
    partyId: userParty?.partyId,
    createdAt: Date.now(),
  };
  
  categories.push(newCategory);
  await saveCategories(categories);
  return newCategory;
};

// 카테고리 수정
export const updateCategory = async (id: string, name: string): Promise<void> => {
  const categories = await loadCategories();
  const index = categories.findIndex(c => c.id === id);
  if (index !== -1) {
    categories[index].name = name;
    await saveCategories(categories);
  }
};

// 카테고리 삭제
export const deleteCategory = async (id: string): Promise<void> => {
  const categories = await loadCategories();
  const filtered = categories.filter(c => c.id !== id);
  await saveCategories(filtered);
};

// 타입별 카테고리 가져오기
export const getCategoriesByType = async (type: TransactionType): Promise<string[]> => {
  const categories = await loadCategories();
  return categories
    .filter(c => c.type === type)
    .map(c => c.name);
};

