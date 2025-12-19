import { useEffect, useRef } from 'react';
import { Animated, ViewStyle, View } from 'react-native';

type Props = {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle | any;
};

export default function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: Props) {
  const shimmerTranslateX = useRef(new Animated.Value(-300)).current;
  const shimmerOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(shimmerTranslateX, {
            toValue: 300,
            duration: 1400,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerTranslateX, {
            toValue: -300,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(shimmerOpacity, {
            toValue: 0.7,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerOpacity, {
            toValue: 0.3,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [shimmerTranslateX, shimmerOpacity]);

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#f1f3f5',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#ffffff',
          opacity: shimmerOpacity,
          transform: [
            {
              translateX: shimmerTranslateX,
            },
          ],
        }}
      />
    </View>
  );
}
