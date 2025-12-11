import { supabase } from '@/lib/supabase';
import { Transaction } from '@/types/transaction';
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

// Supabase에서 Transaction을 앱의 Transaction 타입으로 변환
const mapSupabaseToTransaction = (row: any): Transaction => {
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    category: row.category,
    amount: parseFloat(row.amount),
    description: row.description,
    createdAt: new Date(row.created_at).getTime(),
    partyId: row.party_id || undefined,
  };
};

export const saveTransactions = async (transactions: Transaction[]): Promise<void> => {
  // 이 함수는 더 이상 사용되지 않지만 호환성을 위해 유지
  console.warn('saveTransactions is deprecated. Use individual CRUD operations instead.');
};

const LOCAL_TX_KEY = 'bb_local_transactions';

const loadLocalTransactions = async (): Promise<Transaction[]> => {
  const raw = await AsyncStorage.getItem(LOCAL_TX_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error parsing local transactions', e);
    return [];
  }
};

const saveLocalTransactions = async (transactions: Transaction[]) => {
  await AsyncStorage.setItem(LOCAL_TX_KEY, JSON.stringify(transactions));
};

export const loadTransactions = async (): Promise<Transaction[]> => {
  try {
    const mode = await getAuthMode();
    if (mode === 'guest') {
      return await loadLocalTransactions();
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return [];
    }

    const userParty = await getUserParty();
    
    let query = supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (userParty) {
      query = query.or(
        `and(user_id.eq.${session.user.id},party_id.is.null),party_id.eq.${userParty.partyId}`
      );
    } else {
      query = query.eq('user_id', session.user.id).is('party_id', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading transactions:', error);
      return [];
    }

    return (data || []).map(mapSupabaseToTransaction);
  } catch (e) {
    console.error('Error loading transactions:', e);
    return [];
  }
};

export const addTransaction = async (transaction: Transaction): Promise<Transaction> => {
  const mode = await getAuthMode();
  if (mode === 'guest') {
    const list = await loadLocalTransactions();
    const tx = { ...transaction, id: transaction.id || generateUUID(), createdAt: Date.now() };
    const updated = [tx, ...list];
    await saveLocalTransactions(updated);
    return tx;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('No user session found');
    }

    const userParty = await getUserParty();

    const transactionId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(transaction.id)
      ? transaction.id
      : generateUUID();

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        id: transactionId,
        user_id: session.user.id,
        party_id: userParty?.partyId || null,
        date: transaction.date,
        type: transaction.type,
        category: transaction.category,
        amount: transaction.amount,
        description: transaction.description,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding transaction:', error);
      throw error;
    }

    return mapSupabaseToTransaction(data);
  } catch (e) {
    console.error('Error adding transaction:', e);
    throw e;
  }
};

export const updateTransaction = async (id: string, updatedTransaction: Transaction): Promise<void> => {
  const mode = await getAuthMode();
  if (mode === 'guest') {
    const list = await loadLocalTransactions();
    const updatedList = list.map((tx) => (tx.id === id ? { ...tx, ...updatedTransaction } : tx));
    await saveLocalTransactions(updatedList);
    return;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('No user session found');
    }

    const userParty = await getUserParty();

    const query = supabase.from('transactions').update({
      date: updatedTransaction.date,
      type: updatedTransaction.type,
      category: updatedTransaction.category,
      amount: updatedTransaction.amount,
      description: updatedTransaction.description,
      party_id: userParty?.partyId || null,
    }).eq('id', id);

    // If user is in a party, allow updating transactions that belong to that party
    if (userParty) {
      query.eq('party_id', userParty.partyId);
    } else {
      // Personal transactions require ownership
      query.eq('user_id', session.user.id);
    }

    const { error } = await query;

    if (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  } catch (e) {
    console.error('Error updating transaction:', e);
    throw e;
  }
};

export const deleteTransaction = async (id: string): Promise<void> => {
  const mode = await getAuthMode();
  if (mode === 'guest') {
    const list = await loadLocalTransactions();
    const updated = list.filter((tx) => tx.id !== id);
    await saveLocalTransactions(updated);
    return;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('No user session found');
    }

    const query = supabase.from('transactions').delete().eq('id', id);

    // If user is in a party, allow deleting transactions that belong to that party
    if (userParty) {
      query.eq('party_id', userParty.partyId);
    } else {
      // Personal transactions require ownership
      query.eq('user_id', session.user.id);
    }

    const { error } = await query;

    if (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  } catch (e) {
    console.error('Error deleting transaction:', e);
    throw e;
  }
};

// 개인 거래(파티 미소속 데이터) 전부 삭제
export const deletePersonalTransactions = async (): Promise<void> => {
  const mode = await getAuthMode();
  if (mode === 'guest') {
    await saveLocalTransactions([]);
    return;
  }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', session.user.id)
      .is('party_id', null);
    if (error) {
      console.error('Error deleting personal transactions:', error);
    }
  } catch (e) {
    console.error('Error deleting personal transactions:', e);
  }
};

