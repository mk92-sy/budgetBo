import { Transaction } from '@/types/transaction';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

interface Props {
  transactions: Transaction[];
  year: number;
  month: number;
}

export default function StatsCharts({ transactions, year, month }: Props) {
  const { width } = useWindowDimensions();
  const days = getDaysInMonth(year, month);

  // Initialize arrays for each day
  const dailyNet = Array(days).fill(0);
  const dailyExpense = Array(days).fill(0);

  transactions.forEach((t) => {
    if (!t.date.startsWith(`${year}-${String(month).padStart(2, '0')}`)) return;
    const day = Number(t.date.split('-')[2]);
    const idx = day - 1;
    if (t.type === 'income') dailyNet[idx] += t.amount;
    else dailyNet[idx] -= t.amount;
    if (t.type === 'expense') dailyExpense[idx] += t.amount;
  });

  // make cumulative balance for line chart
  const cumulative = dailyNet.reduce((acc: number[], cur, i) => {
    const prev = acc[i - 1] ?? 0;
    acc.push(prev + cur);
    return acc;
  }, [] as number[]);

  // Category pie chart (expense categories)
  const categoryMap: Record<string, number> = {};
  transactions.forEach((t) => {
    if (!t.date.startsWith(`${year}-${String(month).padStart(2, '0')}`)) return;
    if (t.type === 'expense') {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
    }
  });

  const pieData = Object.keys(categoryMap).map((k, idx) => ({
    name: k,
    amount: categoryMap[k],
    color: ['#f97316', '#ef4444', '#10b981', '#6366f1', '#f43f5e'][idx % 5],
    legendFontColor: '#333',
    legendFontSize: 12,
  }));

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(59,130,246, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(55,65,81, ${opacity})`,
    style: { borderRadius: 8 },
    propsForDots: { r: '3', strokeWidth: '0' },
  } as any;

  const labels = Array.from({ length: days }, (_, i) => String(i + 1));

  return (
    <ScrollView horizontal={false}>
      <View className="mb-4">
        <Text className="text-gray-800 font-semibold mb-2">일별 잔액 추이</Text>
        {cumulative.length === 0 ? (
          <View className="bg-gray-50 rounded-lg p-4 items-center">
            <Text className="text-gray-400">데이터가 없습니다</Text>
          </View>
        ) : (
          <LineChart
            data={{ labels: labels.map((l, i) => (i % Math.ceil(days / 6) === 0 ? l : '')), datasets: [{ data: cumulative.map((n) => Math.round(n)) }] }}
            width={Math.min(width - 32, 720)}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={{ borderRadius: 8 }}
          />
        )}
      </View>

      <View className="mb-4">
        <Text className="text-gray-800 font-semibold mb-2">일별 지출</Text>
        <BarChart
          data={{ labels: labels.map((l, i) => (i % Math.ceil(days / 7) === 0 ? l : '')), datasets: [{ data: dailyExpense.map((n) => Math.round(n)) }] }}
          width={Math.min(width - 32, 720)}
          height={180}
          chartConfig={chartConfig}
          style={{ borderRadius: 8 }}
        />
      </View>

      <View className="mb-4">
        <Text className="text-gray-800 font-semibold mb-2">카테고리별 지출</Text>
        {pieData.length === 0 ? (
          <View className="bg-gray-50 rounded-lg p-4 items-center">
            <Text className="text-gray-400">데이터가 없습니다</Text>
          </View>
        ) : (
          <PieChart
            data={pieData.map((p) => ({ name: p.name, population: p.amount, color: p.color, legendFontColor: p.legendFontColor, legendFontSize: p.legendFontSize }))}
            width={Math.min(width - 32, 720)}
            height={200}
            chartConfig={chartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        )}
      </View>
    </ScrollView>
  );
}
