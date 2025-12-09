import { useModal } from "@/contexts/ModalContext";
import { useAuth } from "@/hooks/useAuth";
import { Transaction, TransactionType } from "@/types/transaction";
import { getCategoriesByType } from "@/utils/category";
import { getToday } from "@/utils/date";
import { getParty, getUserParty } from "@/utils/party";
import {
  addTransaction,
  deleteTransaction,
  loadTransactions,
  updateTransaction,
} from "@/utils/storage";
import { Picker } from "@react-native-picker/picker";
import { useFocusEffect } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar, LocaleConfig } from "react-native-calendars";

// 달력 한글화
LocaleConfig.locales.ko = {
  monthNames: [
    "1월",
    "2월",
    "3월",
    "4월",
    "5월",
    "6월",
    "7월",
    "8월",
    "9월",
    "10월",
    "11월",
    "12월",
  ],
  monthNamesShort: [
    "1월",
    "2월",
    "3월",
    "4월",
    "5월",
    "6월",
    "7월",
    "8월",
    "9월",
    "10월",
    "11월",
    "12월",
  ],
  dayNames: [
    "일요일",
    "월요일",
    "화요일",
    "수요일",
    "목요일",
    "금요일",
    "토요일",
  ],
  dayNamesShort: ["일", "월", "화", "수", "목", "금", "토"],
  today: "오늘",
};
LocaleConfig.defaultLocale = "ko";

export default function HomeScreen() {
  const { isModalOpen, openModal, closeModal } = useModal();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getToday());
  const [selectedYear, setSelectedYear] = useState(
    new Date(selectedDate).getFullYear()
  );
  const [selectedMonth, setSelectedMonth] = useState(
    new Date(selectedDate).getMonth() + 1
  );
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [categories, setCategories] = useState<{
    income: string[];
    expense: string[];
  }>({
    income: [],
    expense: [],
  });
  const [party, setParty] = useState<any>(null);
  const [formData, setFormData] = useState({
    type: "expense" as TransactionType,
    category: "",
    amount: "",
    description: "",
    date: getToday(),
  });

  useEffect(() => {
    loadData();
    loadCategories();
    loadPartyInfo();
  }, []);

  // 1. selectedDate가 변경될 때 달력도 업데이트되도록 useEffect 추가
  useEffect(() => {
    const d = new Date(selectedDate);
    setSelectedYear(d.getFullYear());
    setSelectedMonth(d.getMonth() + 1);
  }, [selectedDate]);

  useFocusEffect(
    React.useCallback(() => {
      loadCategories();
      loadData();
      loadPartyInfo();
    }, [])
  );

  const loadData = async () => {
    const data = await loadTransactions();
    setTransactions(data);
  };

  const loadCategories = async () => {
    const incomeCats = await getCategoriesByType("income");
    const expenseCats = await getCategoriesByType("expense");
    setCategories({
      income: incomeCats,
      expense: expenseCats,
    });
  };

  const loadPartyInfo = async () => {
    const partyData = await getParty();
    const userPartyData = await getUserParty();
    setParty(
      partyData ? { ...partyData, userRole: userPartyData?.role } : null
    );
  };

  const getTransactionsForDate = (date: string) => {
    return transactions.filter((t) => t.date === date);
  };

  const getTotalForDate = (date: string) => {
    const dayTransactions = getTransactionsForDate(date);
    const income = dayTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = dayTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense };
  };

  const getMonthlyTotals = (date: string) => {
    const [year, month] = date.split("-");
    const monthTransactions = transactions.filter((t) => {
      const [y, m] = t.date.split("-");
      return y === year && m === month;
    });
    const income = monthTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = monthTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense };
  };

  const getCumulativeBalance = (date: string) => {
    const cumulative = transactions
      .filter((t) => t.date <= date)
      .reduce(
        (sum, t) => (t.type === "income" ? sum + t.amount : sum - t.amount),
        0
      );
    return cumulative;
  };

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 5; i++) {
      years.push(i);
    }
    return years;
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    // 현재 선택된 날짜의 일(day)을 유지하면서 년도만 변경
    const day = selectedDate.split("-")[2];
    const newDate = `${year}-${String(selectedMonth).padStart(2, "0")}-${day}`;
    setSelectedDate(newDate);
  };

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
    // 현재 선택된 날짜의 일(day)을 유지하면서 월만 변경
    const day = selectedDate.split("-")[2];
    const newDate = `${selectedYear}-${String(month).padStart(2, "0")}-${day}`;
    setSelectedDate(newDate);
  };

  const getMarkedDates = () => {
    const marked: any = {};
    transactions.forEach((transaction) => {
      if (!marked[transaction.date]) {
        marked[transaction.date] = {
          marked: true,
          dotColor: transaction.type === "income" ? "#10b981" : "#ef4444",
        };
      }
    });
    if (selectedDate) {
      marked[selectedDate] = {
        ...marked[selectedDate],
        selected: true,
        selectedColor: "#3b82f6",
      };
    }
    return marked;
  };

  const handleSave = async () => {
    if (!formData.amount) {
      Alert.alert("오류", "금액을 입력해주세요.");
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("오류", "올바른 금액을 입력해주세요.");
      return;
    }

    const category = formData.category || "미분류";
    const description = formData.description || "";

    if (editingTransaction) {
      const updated: Transaction = {
        ...editingTransaction,
        date: formData.date,
        type: formData.type,
        category,
        amount,
        description,
      };
      await updateTransaction(editingTransaction.id, updated);
    } else {
      const newTransaction: Transaction = {
        id: '', // UUID는 addTransaction에서 생성됨
        date: formData.date,
        type: formData.type,
        category,
        amount,
        description,
        createdAt: Date.now(),
      };
      await addTransaction(newTransaction);
    }

    await loadData();
    resetForm();
  };

  const handleDelete = (id: string) => {
    Alert.alert("삭제", "정말 삭제하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => {
          await deleteTransaction(id);
          await loadData();
        },
      },
    ]);
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      type: transaction.type,
      category: transaction.category,
      amount: transaction.amount.toString(),
      description: transaction.description,
      date: transaction.date,
    });
  };

  const resetForm = () => {
    setEditingTransaction(null);
    setFormData({
      type: "expense",
      category: "",
      amount: "",
      description: "",
      date: selectedDate,
    });
  };

  const openAddModal = () => {
    resetForm();
    setFormData((prev) => ({ ...prev, date: selectedDate }));
    openModal(); // setModalVisible(true) 대신
  };

  const dayTransactions = getTransactionsForDate(selectedDate);
  const totals = getTotalForDate(selectedDate);
  const monthTotals = getMonthlyTotals(selectedDate);
  const cumulativeBalance = getCumulativeBalance(selectedDate);
  const { session, signOut } = useAuth();
  return (
    <View className="flex-1 bg-white">
      <View className="pt-4 pb-4 px-4 bg-blue-500">
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-1">
            <View className="flex-row items-center">
              <View className="border border-white/30 rounded-lg overflow-hidden mr-2">
                <Picker
                  selectedValue={selectedYear}
                  onValueChange={handleYearChange}
                  style={{
                    color: "white",
                    width: 100,
                    height: 40,
                    backgroundColor: "transparent",
                  }}
                  dropdownIconColor="white"
                >
                  {getYearOptions().map((year) => (
                    <Picker.Item key={year} label={`${year}년`} value={year} />
                  ))}
                </Picker>
              </View>

              <View className="border border-white/30 rounded-lg overflow-hidden">
                <Picker
                  selectedValue={selectedMonth}
                  onValueChange={handleMonthChange}
                  style={{
                    color: "white",
                    width: 90,
                    height: 40,
                    backgroundColor: "transparent",
                  }}
                  dropdownIconColor="white"
                >
                  {monthOptions.map((month) => (
                    <Picker.Item
                      key={month}
                      label={`${month}월`}
                      value={month}
                    />
                  ))}
                </Picker>
              </View>

              <Text className="text-white text-xl font-bold ml-2">가계부</Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-white/80 text-sm mt-1">
                {session?.user?.user_metadata?.name}님 안녕하세요!
              </Text>
              <Text
                className="text-white/80 text-sm mt-1"
                role="button"
                onPress={signOut}
              >
                로그아웃
              </Text>
            </View>
            {party?.id && (
              <Text className="text-white/80 text-sm mt-1">{party.name}</Text>
            )}
          </View>
          {party?.id && (
            <View
              className={`px-2 py-1 rounded ${
                party.userRole === "host" ? "bg-blue-600" : "bg-gray-600"
              }`}
            >
              <Text className="text-white text-xs font-semibold">
                {party.userRole === "host" ? "파티장" : "파티원"}
              </Text>
            </View>
          )}
        </View>
        <View className="bg-white/10 rounded-lg p-3">
          <View className="flex-row justify-between">
            <View className="items-center flex-1">
              <Text className="text-white/80 text-xs mb-1">월 수입</Text>
              <Text className="text-white text-lg font-bold">
                {monthTotals.income.toLocaleString()}원
              </Text>
            </View>
            <View className="w-px bg-white/30 mx-2" />
            <View className="items-center flex-1">
              <Text className="text-white/80 text-xs mb-1">월 지출</Text>
              <Text className="text-white text-lg font-bold">
                {monthTotals.expense.toLocaleString()}원
              </Text>
            </View>
            <View className="w-px bg-white/30 mx-2" />
            <View className="items-center flex-1">
              <Text className="text-white/80 text-xs mb-1">월 잔액</Text>
              <Text className="text-white text-lg font-bold">
                {monthTotals.balance.toLocaleString()}원
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1">
        <View className="p-4">
          <Calendar
            key={`${selectedYear}-${selectedMonth}`}
            current={selectedDate}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            onMonthChange={(date) => {
              const d = new Date(date.dateString);
              setSelectedYear(d.getFullYear());
              setSelectedMonth(d.getMonth() + 1);
              // selectedDate도 업데이트 (현재 선택된 날의 day 유지)
              const currentDay = selectedDate.split("-")[2];
              setSelectedDate(
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
                  2,
                  "0"
                )}-${currentDay}`
              );
            }}
            markedDates={getMarkedDates()}
            monthFormat={"yyyy년 M월"}
            dayComponent={({ date, marking, state }) => {
              if (!date) return null;
              const day = date.dateString;
              const dayOfWeek = new Date(day + "T00:00:00").getDay();
              const isSelected = marking?.selected;
              const isToday = day === getToday();
              const baseColor =
                dayOfWeek === 0
                  ? "#ef4444"
                  : dayOfWeek === 6
                  ? "#2563eb"
                  : "#1f2937";
              const textColor = isSelected
                ? "#ffffff"
                : state === "disabled"
                ? "#d1d5db"
                : baseColor;

              return (
                <TouchableOpacity
                  onPress={() => setSelectedDate(day)}
                  disabled={state === "disabled"}
                  style={{}}
                >
                  <View
                    style={{
                      backgroundColor: isSelected ? "#3b82f6" : "transparent",
                      borderRadius: 8,
                      width: 30,
                      height: 30,
                    }}
                  >
                    <Text
                      style={{
                        position: "relative",
                        textAlign: "center",
                        color: textColor,
                        fontWeight: isSelected ? "700" : "500",
                        lineHeight: 30,
                      }}
                    >
                      {date.day}
                    </Text>
                    {marking?.marked && (
                      <View
                        style={{
                          position: 'absolute',
                          bottom: -10,
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: isSelected
                            ? "#ffffff"
                            : marking.dotColor || "#3b82f6",
                          alignSelf: "center",
                        }}
                      />
                    )}
                    {isToday && !isSelected && (
                      <View
                        style={{
                          position: "absolute",
                          bottom: -2,
                          width: 6,
                          height: 2,
                          backgroundColor: "#3b82f6",
                          alignSelf: "center",
                          marginTop: 4,
                        }}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            theme={{
              backgroundColor: "#ffffff",
              calendarBackground: "#ffffff",
              textSectionTitleColor: "#6b7280",
              selectedDayBackgroundColor: "#3b82f6",
              selectedDayTextColor: "#ffffff",
              todayTextColor: "#3b82f6",
              dayTextColor: "#1f2937",
              textDisabledColor: "#d1d5db",
              dotColor: "#3b82f6",
              selectedDotColor: "#ffffff",
              arrowColor: "#3b82f6",
              monthTextColor: "#1f2937",
              indicatorColor: "#3b82f6",
              textDayFontWeight: "400",
              textMonthFontWeight: "600",
              textDayHeaderFontWeight: "600",
            }}
            style={{
              borderRadius: 10,
              elevation: 4,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
            }}
          />
        </View>

        <View className="px-4 mb-4">
          <View className="bg-gray-50 rounded-lg p-4 flex-row justify-between">
            <View className="items-center flex-1">
              <Text className="text-gray-500 text-sm mb-1">수입</Text>
              <Text className="text-green-600 text-xl font-bold">
                {totals.income.toLocaleString()}원
              </Text>
            </View>
            <View className="w-px bg-gray-300" />
            <View className="items-center flex-1">
              <Text className="text-gray-500 text-sm mb-1">지출</Text>
              <Text className="text-red-600 text-xl font-bold">
                {totals.expense.toLocaleString()}원
              </Text>
            </View>
            <View className="w-px bg-gray-300" />
            <View className="items-center flex-1">
              <Text className="text-gray-500 text-sm mb-1">잔액</Text>
              <Text
                className={`text-xl font-bold ${
                  cumulativeBalance >= 0 ? "text-blue-600" : "text-red-600"
                }`}
              >
                {cumulativeBalance.toLocaleString()}원
              </Text>
            </View>
          </View>
        </View>

        <View className="px-4 mb-4">
          <Text className="text-lg font-semibold mb-3 text-gray-800">
            거래 내역
          </Text>
          {dayTransactions.length === 0 ? (
            <View className="bg-gray-50 rounded-lg p-8 items-center">
              <Text className="text-gray-400">등록된 거래가 없습니다</Text>
            </View>
          ) : (
            dayTransactions.map((transaction) => (
              <View
                key={transaction.id}
                className="bg-white rounded-lg p-4 mb-2 border border-gray-200 flex-row items-center justify-between"
              >
                <View className="flex-1">
                  <View className="flex-row items-center mb-1">
                    <View
                      className={`px-2 py-1 rounded ${
                        transaction.type === "income"
                          ? "bg-green-100"
                          : "bg-red-100"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          transaction.type === "income"
                            ? "text-green-700"
                            : "text-red-700"
                        }`}
                      >
                        {transaction.type === "income" ? "수입" : "지출"}
                      </Text>
                    </View>
                    <Text className="ml-2 text-gray-600 text-sm">
                      {transaction.category}
                    </Text>
                  </View>
                  <Text className="text-gray-800 font-medium">
                    {transaction.description}
                  </Text>
                  <Text
                    className={`text-lg font-bold mt-1 ${
                      transaction.type === "income"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {transaction.type === "income" ? "+" : "-"}
                    {transaction.amount.toLocaleString()}원
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => handleEdit(transaction)}
                    className="bg-blue-500 px-3 py-2 rounded"
                  >
                    <Text className="text-white text-xs">수정</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(transaction.id)}
                    className="bg-red-500 px-3 py-2 rounded"
                  >
                    <Text className="text-white text-xs">삭제</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* <TouchableOpacity
        onPress={openAddModal}
        className="absolute bg-blue-500 w-16 h-16 rounded-full items-center justify-center shadow-lg"
        style={{
          bottom: 20,
          left: "50%",
          marginLeft: -32,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        }}
      >
        <Text className="text-white text-3xl font-bold">+</Text>
      </TouchableOpacity> */}

      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          closeModal();
          resetForm();
        }}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6 max-h-[90%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold">
                {editingTransaction ? "거래 수정" : "거래 추가"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  closeModal();
                  resetForm();
                }}
              >
                <Text className="text-gray-500 text-lg">✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView>
              <View className="mb-4">
                <Text className="text-gray-700 mb-2 font-medium">유형</Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() =>
                      setFormData({ ...formData, type: "income", category: "" })
                    }
                    className={`flex-1 py-3 rounded-lg ${
                      formData.type === "income"
                        ? "bg-green-500"
                        : "bg-gray-200"
                    }`}
                  >
                    <Text
                      className={`text-center font-semibold ${
                        formData.type === "income"
                          ? "text-white"
                          : "text-gray-700"
                      }`}
                    >
                      수입
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      setFormData({
                        ...formData,
                        type: "expense",
                        category: "",
                      })
                    }
                    className={`flex-1 py-3 rounded-lg ${
                      formData.type === "expense" ? "bg-red-500" : "bg-gray-200"
                    }`}
                  >
                    <Text
                      className={`text-center font-semibold ${
                        formData.type === "expense"
                          ? "text-white"
                          : "text-gray-700"
                      }`}
                    >
                      지출
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View className="mb-4">
                <Text className="text-gray-700 mb-2 font-medium">카테고리</Text>
                {categories[formData.type].length === 0 ? (
                  <Text className="text-gray-400 text-sm mb-2">
                    설정에서 카테고리를 추가해주세요.
                  </Text>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {categories[formData.type].map((category) => (
                      <TouchableOpacity
                        key={category}
                        onPress={() => setFormData({ ...formData, category })}
                        className={`px-4 py-2 rounded-lg ${
                          formData.category === category
                            ? "bg-blue-500"
                            : "bg-gray-200"
                        }`}
                      >
                        <Text
                          className={`font-medium ${
                            formData.category === category
                              ? "text-white"
                              : "text-gray-700"
                          }`}
                        >
                          {category}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View className="mb-4">
                <Text className="text-gray-700 mb-2 font-medium">금액</Text>
                <TextInput
                  value={formData.amount}
                  onChangeText={(text) =>
                    setFormData({ ...formData, amount: text })
                  }
                  placeholder="금액을 입력하세요"
                  keyboardType="numeric"
                  className="border border-gray-300 rounded-lg px-4 py-3 text-lg"
                />
              </View>

              <View className="mb-4">
                <Text className="text-gray-700 mb-2 font-medium">내용</Text>
                <TextInput
                  value={formData.description}
                  onChangeText={(text) =>
                    setFormData({ ...formData, description: text })
                  }
                  placeholder="내용을 입력하세요"
                  className="border border-gray-300 rounded-lg px-4 py-3"
                  multiline
                />
              </View>

              <View className="mb-4">
                <Text className="text-gray-700 mb-2 font-medium">날짜</Text>
                <TextInput
                  value={formData.date}
                  onChangeText={(text) =>
                    setFormData({ ...formData, date: text })
                  }
                  placeholder="YYYY-MM-DD"
                  className="border border-gray-300 rounded-lg px-4 py-3"
                />
              </View>

              <TouchableOpacity
                onPress={handleSave}
                className="bg-blue-500 py-4 rounded-lg mb-4"
              >
                <Text className="text-white text-center font-bold text-lg">
                  저장
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
