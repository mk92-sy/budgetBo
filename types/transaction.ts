export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD format
  type: TransactionType;
  category: string;
  amount: number;
  description: string;
  createdAt: number;
  partyId?: string; // 파티에 속한 거래인 경우
}

export interface TransactionFormData {
  date: string;
  type: TransactionType;
  category: string;
  amount: string;
  description: string;
}

