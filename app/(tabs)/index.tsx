import { CustomDropdown } from "@/components/CustomDropdown";
import { useModal } from "@/contexts/ModalContext";
import { useAuth } from "@/hooks/useAuth";
import { BudgetBook } from "@/types/party";
import { Transaction, TransactionFormData } from "@/types/transaction";
import { onPartyUpdate } from "@/utils/appEvents";
import { getCategoriesByType } from "@/utils/category";
import { getToday } from "@/utils/date";
import { getActiveBudgetBook } from "@/utils/party";
import { addTransaction, deleteTransaction, loadTransactions, updateTransaction } from "@/utils/storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar, LocaleConfig } from "react-native-calendars";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// 달력 한글화
LocaleConfig.locales.ko = {
  monthNames: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
  monthNamesShort: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"],
  dayNames: ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"],
  dayNamesShort: ["일", "월", "화", "수", "목", "금", "토"],
  today: "오늘",
};
LocaleConfig.defaultLocale = "ko";

export default function HomeScreen() {
  const { isModalOpen, closeModal } = useModal();
  const insets = useSafeAreaInsets();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getToday());
  const selectedDateRef = useRef<string>(getToday());

  const updateSelectedDate = (dateStr: string) => {
    selectedDateRef.current = dateStr;
    setSelectedDate(dateStr);
  };
  const [selectedYear, setSelectedYear] = useState(new Date(selectedDate).getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date(selectedDate).getMonth() + 1);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const [categories, setCategories] = useState<{ income: string[]; expense: string[] }>({
    income: [],
    expense: [],
  });

  const loadCategories = async () => {
    try {
      const income = await getCategoriesByType("income");
      const expense = await getCategoriesByType("expense");
      setCategories({ income, expense });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadCategories();
  }, []);

  const [formData, setFormData] = useState<TransactionFormData>({
    type: "expense",
    category: "",
    amount: "",
    description: "",
    date: selectedDate,
  });

  const [toast, setToast] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(40)).current;
  const toastTimerRef = useRef<number | null>(null);
  const windowWidth = Dimensions.get("window").width;

  const showToast = (message: string) => {
    // clear any existing timer/animation
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    setToast(message);

    // reset values
    toastOpacity.setValue(0);
    toastTranslateY.setValue(40);

    // slide up + fade in
    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(toastTranslateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();

    // auto hide after delay
    toastTimerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(toastTranslateY, { toValue: 40, duration: 250, useNativeDriver: true }),
      ]).start(() => {
        setToast(null);
        if (toastTimerRef.current) {
          clearTimeout(toastTimerRef.current);
          toastTimerRef.current = null;
        }
      });
    }, 2200) as unknown as number;
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  const [party, setParty] = useState<any>(null);
  const [activeBudget, setActiveBudget] = useState<BudgetBook | null>(null);

  const loadPartyInfo = async () => {
    try {
      const { getParty, getUserParty } = await import("@/utils/party");
      const partyData = await getParty();
      const userPartyData = await getUserParty();
      setParty(partyData ? { ...partyData, userRole: userPartyData?.role } : null);
    } catch {
      // ignore
    }
  };
  useEffect(() => {
    const refresh = async () => {
      try {
        await loadPartyInfo();
      } catch {
        /* ignore */
      }
      try {
        const ab = await getActiveBudgetBook();
        setActiveBudget(ab);
      } catch {
        setActiveBudget(null);
      }
    };

    // initial
    refresh();

    // subscribe to global party updates
    const unsubscribe = onPartyUpdate(async () => {
      // When party updates (activation/join/create/delete), reload party info and transactions/categories for immediate sync
      try {
        await loadPartyInfo();
      } catch {
        // ignore
      }
      try {
        await loadData();
      } catch {
        // ignore
      }
      try {
        await loadCategories();
      } catch {
        // ignore
      }

      // refresh active budget object as well
      try {
        const ab = await getActiveBudgetBook();
        setActiveBudget(ab);
      } catch {
        setActiveBudget(null);
      }
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

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
    // 년도 변경 시 기본 선택일을 1일로 설정
    const newDate = `${year}-${String(selectedMonth).padStart(2, "0")}-01`;
    updateSelectedDate(newDate);
  };

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
    // 월 변경 시 기본 선택일을 1일로 설정
    const newDate = `${selectedYear}-${String(month).padStart(2, "0")}-01`;
    updateSelectedDate(newDate);
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

  const getTransactionsForDate = (date: string) => {
    return transactions.filter((t) => t.date === date);
  };

  const getTotalForDate = (date: string) => {
    const dayTransactions = getTransactionsForDate(date);
    const income = dayTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
    const expense = dayTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense };
  };

  const getMonthlyTotals = (date: string) => {
    const [year, month] = date.split("-");
    const monthTransactions = transactions.filter((t) => {
      const [y, m] = t.date.split("-");
      return y === year && m === month;
    });
    const income = monthTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
    const expense = monthTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense };
  };

  const loadData = async () => {
    try {
      const data = await loadTransactions();
      setTransactions(data);
    } catch (e) {
      console.error("Failed to load transactions:", e);
      setTransactions([]);
    }
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

    const wasEditing = !!editingTransaction;
    try {
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
          id: "", // UUID는 addTransaction에서 생성됨
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
      // close modal and show success toast
      closeModal();
      showToast(wasEditing ? "거래가 수정되었습니다." : "거래가 등록되었습니다.");
    } catch (e: any) {
      console.error("Failed to save transaction:", e);
      Alert.alert("오류", e?.message || "거래를 저장하는 중 오류가 발생했습니다.");
    }
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
          showToast("거래가 삭제되었습니다.");
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
      date: selectedDateRef.current,
    });
  };

  // openAddModal removed — use central tab add button which calls openModal();
  // modal open is watched in a useEffect which calls resetForm() and syncs form date.

  const dayTransactions = getTransactionsForDate(selectedDate);
  const monthTotals = getMonthlyTotals(selectedDate);
  // Ensure auth hook is initialized (subscription) without creating unused vars
  useAuth();

  useEffect(() => {
    // Ensure when the add modal opens, the form date reflects the latest selected date
    if (isModalOpen && !editingTransaction) {
      // reset form and sync the date so any caller of openModal (e.g. central tab button)
      // will get the same behaviour as the in-page add button used previously.
      resetForm();
      setFormData((prev) => ({ ...prev, date: selectedDateRef.current }));
    }
  }, [isModalOpen, editingTransaction]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff", paddingTop: 0 }}>
      <View className="pt-4 pb-4 px-4 bg-blue-500">
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-1">
            {/* Title row above selects */}
            <View>
              {activeBudget ? (
                activeBudget.type === "shared" ? (
                  <View className="flex-row items-center">
                    <Text className="text-white text-xl font-bold mr-2">
                      {party?.id ? party.name : activeBudget.name}
                    </Text>
                    <View
                      className={`px-2 py-1 rounded ${
                        party?.userRole === "host" || activeBudget.role === "host" ? "bg-blue-600" : "bg-gray-600"
                      }`}
                    >
                      <Text className="text-white text-xs font-semibold">
                        {party?.userRole === "host" || activeBudget.role === "host" ? "파티장" : "파티원"}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text className="text-white text-xl font-bold">{activeBudget.name}</Text>
                )
              ) : (
                <Text className="text-white text-xl font-bold">내 가계부</Text>
              )}
            </View>

            {/* Select boxes row (below title) */}
            <View className="flex-row items-center mt-2 justify-between">
              <View className="flex-row items-center">
                <CustomDropdown
                  items={getYearOptions().map(String)}
                  selectedValue={String(selectedYear)}
                  onValueChange={(val) => handleYearChange(Number(val))}
                  label="년"
                  compact
                  containerStyle={{ marginRight: 8, minWidth: 84 }}
                  textStyle={{ fontSize: 14 }}
                  textColor="white"
                  borderColor="white/30"
                />

                <CustomDropdown
                  items={monthOptions.map(String)}
                  selectedValue={String(selectedMonth)}
                  onValueChange={(val) => handleMonthChange(Number(val))}
                  label="월"
                  compact
                  containerStyle={{ minWidth: 76 }}
                  textStyle={{ fontSize: 14 }}
                  textColor="white"
                  borderColor="white/30"
                />
              </View>

              {/* View mode switch (right-aligned) */}
              <View className="ml-3">
                <View className="rounded-full bg-white/10 p-1" style={{ flexDirection: "row" }}>
                  <TouchableOpacity
                    onPress={() => setViewMode("calendar")}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      backgroundColor: viewMode === "calendar" ? "#ffffff" : "transparent",
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="calendar-outline" size={18} color={viewMode === "calendar" ? "#000" : "#fff"} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setViewMode("list")}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      backgroundColor: viewMode === "list" ? "#ffffff" : "transparent",
                      marginLeft: 4,
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="list-outline" size={18} color={viewMode === "list" ? "#000" : "#fff"} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>
        <View className="bg-white/10 rounded-lg p-3">
          <View className="flex-row justify-between">
            <View className="items-center flex-1">
              <Text className="text-white/80 text-xs mb-1">월 수입</Text>
              <Text className="text-white text-lg font-bold">{monthTotals.income.toLocaleString()}원</Text>
            </View>
            <View className="w-px bg-white/30 mx-2" />
            <View className="items-center flex-1">
              <Text className="text-white/80 text-xs mb-1">월 지출</Text>
              <Text className="text-white text-lg font-bold">{monthTotals.expense.toLocaleString()}원</Text>
            </View>
            <View className="w-px bg-white/30 mx-2" />
            <View className="items-center flex-1">
              <Text className="text-white/80 text-xs mb-1">월 잔액</Text>
              <Text className="text-white text-lg font-bold">{monthTotals.balance.toLocaleString()}원</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}>
        <View className="p-4">
          {viewMode === "calendar" ? (
            <>
              {/* Month pills: current -2 .. current +2 */}
              <View className="flex-row justify-center items-center mb-3">
                {(() => {
                  const pills: { year: number; month: number; label: string; offset: number }[] = [];
                  for (let offset = -2; offset <= 2; offset++) {
                    const d = new Date(selectedYear, selectedMonth - 1 + offset, 1);
                    pills.push({
                      year: d.getFullYear(),
                      month: d.getMonth() + 1,
                      label: `${d.getMonth() + 1}월`,
                      offset,
                    });
                  }

                  return pills.map((p) => {
                    const isCurrent = p.year === selectedYear && p.month === selectedMonth;
                    return (
                      <TouchableOpacity
                        key={`${p.year}-${p.month}`}
                        onPress={() => {
                          setSelectedYear(p.year);
                          setSelectedMonth(p.month);
                          updateSelectedDate(`${p.year}-${String(p.month).padStart(2, "0")}-01`);
                        }}
                        className="mx-1"
                        activeOpacity={0.9}
                        style={{
                          borderRadius: 999,
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          backgroundColor: isCurrent ? "#3b82f6" : "#ffffff",
                          borderWidth: isCurrent ? 0 : 1,
                          borderColor: isCurrent ? "transparent" : "#e5e7eb",
                        }}
                      >
                        <Text
                          style={{ color: isCurrent ? "#ffffff" : "#374151", fontWeight: isCurrent ? "700" : "600" }}
                        >
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  });
                })()}
              </View>

              {/* Weekday header with light gray background */}
              <View style={{ backgroundColor: "#f3f4f6", borderRadius: 8, paddingVertical: 6, marginBottom: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 6 }}>
                  {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
                    <Text key={d} style={{ flex: 1, textAlign: "center", color: "#6b7280", fontWeight: "600" }}>
                      {d}
                    </Text>
                  ))}
                </View>
              </View>

              <Calendar
                key={`${selectedYear}-${selectedMonth}`}
                current={selectedDate}
                hideArrows={true}
                hideDayNames={true}
                renderHeader={() => null}
                onDayPress={(day) => updateSelectedDate(day.dateString)}
                onMonthChange={(date) => {
                  const d = new Date(date.dateString);
                  setSelectedYear(d.getFullYear());
                  setSelectedMonth(d.getMonth() + 1);
                  // 달이 바뀌면 기본 선택일을 1일로 설정
                  updateSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
                }}
                markedDates={getMarkedDates()}
                monthFormat={"yyyy년 M월"}
                dayComponent={({ date, marking, state }) => {
                  if (!date) return null;
                  const day = date.dateString;
                  const dayOfWeek = new Date(day + "T00:00:00").getDay();
                  const isSelected = marking?.selected;
                  const isToday = day === getToday();
                  const TODAY_COLOR = "#047857";
                  const baseColor = dayOfWeek === 0 ? "#ef4444" : dayOfWeek === 6 ? "#2563eb" : "#1f2937";
                  const dateTextColor = isSelected
                    ? "#ffffff"
                    : isToday
                    ? TODAY_COLOR
                    : state === "disabled"
                    ? "#d1d5db"
                    : baseColor;
                  const totalsForDay = getTotalForDate(day);

                  const formatMan = (amount: number) => {
                    const v = amount / 10000;
                    return `${v.toFixed(3).replace(/\.?0+$/, "")}만`;
                  };

                  return (
                    <TouchableOpacity
                      onPress={() => updateSelectedDate(day)}
                      disabled={state === "disabled"}
                      style={{}}
                    >
                      <View
                        style={{
                          borderRadius: 4,
                          width: 36,
                          height: 56,
                          alignItems: "center",
                          paddingTop: 6,
                          overflow: "visible",
                        }}
                      >
                        {/* selected indicator behind the date number only */}
                        {isSelected && (
                          <View
                            style={{
                              position: "absolute",
                              top: 6,
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              backgroundColor: "#3b82f6",
                              alignSelf: "center",
                              zIndex: 0,
                            }}
                          />
                        )}

                        {/* today indicator when not selected: same shape as selected but light sky-blue */}
                        {isToday && !isSelected && (
                          <View
                            style={{
                              position: "absolute",
                              top: 6,
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              backgroundColor: "#e0f2fe",
                              alignSelf: "center",
                              zIndex: 0,
                            }}
                          />
                        )}

                        <Text
                          style={{
                            textAlign: "center",
                            color: dateTextColor,
                            fontWeight: isSelected ? "700" : "500",
                            fontSize: 14,
                            zIndex: 1,
                          }}
                        >
                          {date.day}
                        </Text>
                        {/* per-day summary: show income/expense below the date (replaces dot) */}
                        {(totalsForDay.income > 0 || totalsForDay.expense > 0) && (
                          <View
                            style={{
                              position: "absolute",
                              top: 38,
                              width: "100%",
                              left: 0,
                              alignItems: "center",
                            }}
                          >
                            {totalsForDay.income > 0 && (
                              <Text
                                style={{
                                  color: "#10b981",
                                  fontSize: 10,
                                  lineHeight: 12,
                                }}
                              >
                                {formatMan(totalsForDay.income)}
                              </Text>
                            )}
                            {totalsForDay.expense > 0 && (
                              <Text
                                style={{
                                  color: "#ef4444",
                                  fontSize: 10,
                                  lineHeight: 12,
                                }}
                              >
                                {formatMan(totalsForDay.expense)}
                              </Text>
                            )}
                          </View>
                        )}
                        {/* removed today's small bottom bar; today now uses different text color */}
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
                  // shadow removed per design
                }}
              />
            </>
          ) : (
            <View>
              {(() => {
                // collect unique dates in the selected month that have transactions
                const prefix = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
                const datesWithTx = Array.from(
                  new Set(transactions.filter((t) => t.date.startsWith(prefix)).map((t) => t.date))
                ).sort((a, b) => (a < b ? 1 : -1)); // newest first

                if (datesWithTx.length === 0) {
                  return (
                    <View className="bg-gray-50 rounded-lg p-8 items-center">
                      <Text className="text-gray-400">거래 내역이 없습니다</Text>
                    </View>
                  );
                }

                return datesWithTx.map((day) => {
                  const txs = getTransactionsForDate(day);
                  const totals = getTotalForDate(day);
                  return (
                    <View key={day} className="mb-3">
                      <View className="flex-row justify-between items-center mb-2">
                        <Text className="font-semibold">{`${Number(day.split("-")[1])}월 ${Number(
                          day.split("-")[2]
                        )}일`}</Text>
                        <Text className="text-sm">
                          수입 {totals.income.toLocaleString()} · 지출 {totals.expense.toLocaleString()}
                        </Text>
                      </View>

                      <View className="bg-white rounded-lg p-2 shadow-sm">
                        {txs.map((t) => (
                          <View
                            key={t.id}
                            className="flex-row justify-between items-center p-2 border-b last:border-b-0"
                          >
                            <View>
                              <Text className="font-medium">{t.category}</Text>
                              {t.description ? <Text className="text-xs text-gray-500">{t.description}</Text> : null}
                            </View>
                            <Text
                              className={`font-semibold ${t.type === "income" ? "text-green-600" : "text-red-500"}`}
                            >
                              {(t.type === "income" ? "+" : "-") + t.amount.toLocaleString()}원
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                });
              })()}
            </View>
          )}
        </View>

        {/* per-day totals removed as requested */}

        <View className="px-4 mb-4">
          {viewMode === "calendar" && (
            <>
              <Text style={{ marginVertical: 20 }} className="text-lg font-semibold text-gray-800">{`${Number(
                selectedMonth
              )}월 ${Number(selectedDate.split("-")[2])}일 거래내역`}</Text>
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
                            transaction.type === "income" ? "bg-green-100" : "bg-red-100"
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              transaction.type === "income" ? "text-green-700" : "text-red-700"
                            }`}
                          >
                            {transaction.type === "income" ? "수입" : "지출"}
                          </Text>
                        </View>
                        <Text className="ml-2 text-gray-600 text-sm">{transaction.category}</Text>
                      </View>
                      <Text className="text-gray-800 font-medium">{transaction.description}</Text>
                      <Text
                        className={`text-lg font-bold mt-1 ${
                          transaction.type === "income" ? "text-green-600" : "text-red-600"
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
                        <Ionicons name="pencil-outline" size={16} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(transaction.id)}
                        className="bg-red-500 px-3 py-2 rounded"
                      >
                        <Ionicons name="trash-outline" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Toast */}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 100,
            alignSelf: "center",
            backgroundColor: "rgba(0,0,0,0.85)",
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 99,
            alignItems: "center",
            justifyContent: "center",
            opacity: toastOpacity,
            transform: [{ translateY: toastTranslateY }],
            // make width match content but not exceed screen
            maxWidth: windowWidth - 40,
            minWidth: 80,
          }}
        >
          <Text style={{ color: "white", textAlign: "center" }}>{toast}</Text>
        </Animated.View>
      ) : null}

      {/* Floating add button removed to avoid duplication with tab bar add button. Use the central tab add button. */}

      <Modal
        visible={isModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          closeModal();
          resetForm();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View
              className="bg-white rounded-t-3xl p-6"
              style={{
                maxHeight: "90%",
                paddingBottom: Math.max(insets.bottom, 24),
                marginBottom: Math.max(insets.bottom, 12),
              }}
            >
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold">{editingTransaction ? "거래 수정" : "거래 추가"}</Text>
                <TouchableOpacity
                  onPress={() => {
                    closeModal();
                    resetForm();
                  }}
                >
                  <Text className="text-gray-500 text-lg">✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled">
                <View className="mb-4">
                  <Text className="text-gray-700 mb-2 font-medium">유형</Text>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => setFormData({ ...formData, type: "income", category: "" })}
                      className={`flex-1 py-3 rounded-lg ${
                        formData.type === "income" ? "bg-green-500" : "bg-gray-200"
                      }`}
                    >
                      <Text
                        className={`text-center font-semibold ${
                          formData.type === "income" ? "text-white" : "text-gray-700"
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
                      className={`flex-1 py-3 rounded-lg ${formData.type === "expense" ? "bg-red-500" : "bg-gray-200"}`}
                    >
                      <Text
                        className={`text-center font-semibold ${
                          formData.type === "expense" ? "text-white" : "text-gray-700"
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
                    <Text className="text-gray-400 text-sm mb-2">설정에서 카테고리를 추가해주세요.</Text>
                  ) : (
                    <View className="flex-row flex-wrap gap-2">
                      {categories[formData.type].map((category) => (
                        <TouchableOpacity
                          key={category}
                          onPress={() => setFormData({ ...formData, category })}
                          className={`px-4 py-2 rounded-lg ${
                            formData.category === category ? "bg-blue-500" : "bg-gray-200"
                          }`}
                        >
                          <Text
                            className={`font-medium ${formData.category === category ? "text-white" : "text-gray-700"}`}
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
                    onChangeText={(text) => setFormData({ ...formData, amount: text })}
                    placeholder="금액을 입력하세요"
                    keyboardType="numeric"
                    className="border border-gray-300 rounded-lg px-4 py-3 text-lg"
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-gray-700 mb-2 font-medium">내용</Text>
                  <TextInput
                    value={formData.description}
                    onChangeText={(text) => setFormData({ ...formData, description: text })}
                    placeholder="내용을 입력하세요"
                    className="border border-gray-300 rounded-lg px-4 py-3"
                    multiline
                  />
                </View>

                <View className="mb-4">
                  <Text className="text-gray-700 mb-2 font-medium">날짜</Text>
                  <TextInput
                    value={formData.date}
                    onChangeText={(text) => setFormData({ ...formData, date: text })}
                    placeholder="YYYY-MM-DD"
                    className="border border-gray-300 rounded-lg px-4 py-3"
                  />
                </View>

                <TouchableOpacity onPress={handleSave} className="bg-blue-500 py-4 rounded-lg mb-4">
                  <Text className="text-white text-center font-bold text-lg">저장</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
