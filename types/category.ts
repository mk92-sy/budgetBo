import { TransactionType } from './transaction';

export interface Category {
  id: string;
  type: TransactionType;
  name: string;
  partyId?: string; // 파티 카테고리인 경우
  createdAt: number;
}

