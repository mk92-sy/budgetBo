import { CustomDropdown } from '@/components/CustomDropdown';
import StatsCharts from '@/components/StatsCharts';
import { useAuth } from '@/hooks/useAuth';
import { Transaction } from '@/types/transaction';
import { loadTransactions } from '@/utils/storage';
import { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);

  const loadData = async () => {
    const data = await loadTransactions();
    setTransactions(data);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View className="pt-4 pb-4 px-4 bg-blue-500">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-white">통계</Text>
            <View className="flex-row items-center mt-2">
              <CustomDropdown
                items={Array.from({ length: 11 }, (_, i) => String(selectedYear - 5 + i))}
                selectedValue={String(selectedYear)}
                onValueChange={(v) => setSelectedYear(Number(v))}
                label="년"
                compact
                containerStyle={{ marginRight: 8, minWidth: 88 }}
                textStyle={{ fontSize: 14 }}
                textColor="white"
                borderColor="white/30"
              />

              <CustomDropdown
                items={Array.from({ length: 12 }, (_, i) => String(i + 1))}
                selectedValue={String(selectedMonth)}
                onValueChange={(v) => setSelectedMonth(Number(v))}
                label="월"
                compact
                containerStyle={{ minWidth: 76 }}
                textStyle={{ fontSize: 14 }}
                textColor="white"
                borderColor="white/30"
              />
            </View>
          </View>
          {isGuest ? (
            <TouchableOpacity className="px-3 py-1">
              <Text className="text-white font-semibold">로그인</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 80 }}>

        <Text className="text-lg font-semibold mb-3">요약</Text>
        <View className="bg-white rounded-lg p-4 mb-3 border border-gray-200">
          {(() => {
            const prefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
            const monthTx = transactions.filter((t) => t.date.startsWith(prefix));
            const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
            const expense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
            const balance = income - expense;

            return (
              <View className="flex-row justify-between">
                <View className="items-center flex-1">
                  <Text className="text-gray-500 text-xs">월 수입</Text>
                  <Text className="text-lg font-bold text-green-600">{income.toLocaleString()}원</Text>
                </View>
                <View className="w-px bg-gray-200 mx-2" />
                <View className="items-center flex-1">
                  <Text className="text-gray-500 text-xs">월 지출</Text>
                  <Text className="text-lg font-bold text-red-500">{expense.toLocaleString()}원</Text>
                </View>
                <View className="w-px bg-gray-200 mx-2" />
                <View className="items-center flex-1">
                  <Text className="text-gray-500 text-xs">월 잔액</Text>
                  <Text className="text-lg font-bold">{balance.toLocaleString()}원</Text>
                </View>
              </View>
            );
          })()}
        </View>

        <StatsCharts transactions={transactions} year={selectedYear} month={selectedMonth} />

      </ScrollView>
    </SafeAreaView>
  );
}
