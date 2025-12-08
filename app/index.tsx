import { supabase } from '@/lib/supabase';
import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

type Status = 'loading' | 'signed-in' | 'signed-out';

export default function Index() {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setStatus(data.session ? 'signed-in' : 'signed-out');
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? 'signed-in' : 'signed-out');
    });

    init();

    return () => subscription.unsubscribe();
  }, []);

  if (status === 'loading') {
    return (
      <View className="flex-1 bg-blue-500 items-center justify-center">
        <Text className="text-white text-3xl font-bold mb-2">BudgetBook</Text>
        <Text className="text-white/80 mb-4">가계부를 준비하는 중...</Text>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (status === 'signed-in') {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/login" />;
}

