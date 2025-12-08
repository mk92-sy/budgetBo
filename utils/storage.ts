import AsyncStorage from '@react-native-async-storage/async-storage';
import { Transaction } from '@/types/transaction';
import { getUserParty } from './party';

const STORAGE_KEY = '@budgetbook_transactions';

export const saveTransactions = async (transactions: Transaction[]): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(transactions);
    await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
  } catch (e) {
    console.error('Error saving transactions:', e);
  }
};

export const loadTransactions = async (): Promise<Transaction[]> => {
  try {
    const userParty = await getUserParty();
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    const allTransactions: Transaction[] = jsonValue != null ? JSON.parse(jsonValue) : [];
    
    // 파티에 속한 경우 해당 파티의 거래만, 아니면 파티가 없는 거래만
    if (userParty) {
      return allTransactions.filter(t => !t.partyId || t.partyId === userParty.partyId);
    } else {
      return allTransactions.filter(t => !t.partyId);
    }
  } catch (e) {
    console.error('Error loading transactions:', e);
    return [];
  }
};

export const addTransaction = async (transaction: Transaction): Promise<void> => {
  const userParty = await getUserParty();
  const transactions = await loadTransactions();
  
  // 파티에 속한 경우 partyId 추가
  const newTransaction: Transaction = {
    ...transaction,
    partyId: userParty?.partyId,
  };
  
  // 전체 거래 목록에 추가 (파티 필터링 없이)
  const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
  const allTransactions: Transaction[] = jsonValue != null ? JSON.parse(jsonValue) : [];
  allTransactions.push(newTransaction);
  await saveTransactions(allTransactions);
};

export const updateTransaction = async (id: string, updatedTransaction: Transaction): Promise<void> => {
  const userParty = await getUserParty();
  const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
  const allTransactions: Transaction[] = jsonValue != null ? JSON.parse(jsonValue) : [];
  const index = allTransactions.findIndex(t => t.id === id);
  
  if (index !== -1) {
    allTransactions[index] = {
      ...updatedTransaction,
      partyId: userParty?.partyId || allTransactions[index].partyId,
    };
    await saveTransactions(allTransactions);
  }
};

export const deleteTransaction = async (id: string): Promise<void> => {
  const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
  const allTransactions: Transaction[] = jsonValue != null ? JSON.parse(jsonValue) : [];
  const filtered = allTransactions.filter(t => t.id !== id);
  await saveTransactions(filtered);
};

