import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    Text,
    TextStyle,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';

interface CustomDropdownProps {
  items: string[];
  selectedValue: string | number;
  onValueChange: (value: string | number) => void;
  label?: string;
  containerStyle?: ViewStyle;
  textStyle?: TextStyle;
  borderColor?: string;
  backgroundColor?: string;
  textColor?: string;
  dropdownMaxHeight?: number;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  items,
  selectedValue,
  onValueChange,
  label,
  containerStyle,
  textStyle,
  borderColor = 'white/30',
  backgroundColor = 'transparent',
  textColor = 'white',
  dropdownMaxHeight = 250,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const displayValue = label
    ? `${selectedValue}${label}`
    : selectedValue;

  return (
    <View style={containerStyle}>
      {/* Trigger Button */}
      <TouchableOpacity
        onPress={() => setIsOpen(true)}
        style={{
          borderWidth: 1,
          borderColor: borderColor === 'white/30' ? '#ffffff4d' : borderColor,
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor,
          paddingHorizontal: 8,
          paddingVertical: 6,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: 44,
        }}
      >
        <Text
          style={[
            {
              color: textColor,
              fontSize: 16,
              fontWeight: '500',
              fontFamily: 'Pretendard',
            },
            textStyle,
          ]}
        >
          {displayValue}
        </Text>
        <Ionicons name="chevron-down" size={20} color={textColor} />
      </TouchableOpacity>

      {/* Modal Dropdown */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setIsOpen(false)}
          activeOpacity={1}
        >
          <TouchableOpacity
            style={{
              backgroundColor: 'white',
              borderRadius: 12,
              maxHeight: dropdownMaxHeight,
              minWidth: 200,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 5,
            }}
            onPress={(e) => e.stopPropagation()}
            activeOpacity={1}
          >
            <ScrollView scrollEnabled={items.length > 8}>
              {items.map((item, index) => (
                <TouchableOpacity
                  key={`${item}-${index}`}
                  onPress={() => {
                    onValueChange(item);
                    setIsOpen(false);
                  }}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderBottomWidth: index !== items.length - 1 ? 1 : 0,
                    borderBottomColor: '#e5e7eb',
                    backgroundColor:
                      String(selectedValue) === String(item) ? '#3b82f61a' : 'white',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      color: String(selectedValue) === String(item) ? '#3b82f6' : '#1f2937',
                      fontWeight:
                        String(selectedValue) === String(item) ? '600' : '500',
                      fontFamily: 'Pretendard',
                    }}
                  >
                    {label ? `${item}${label}` : item}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};
