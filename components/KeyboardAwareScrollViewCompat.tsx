import React from 'react';
import { ScrollView, ScrollViewProps, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const KeyboardAwareScrollViewCompat = (props: ScrollViewProps) => {
  const insets = useSafeAreaInsets();
  
  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior="padding" keyboardVerticalOffset={insets.top}>
        <ScrollView {...props} />
      </KeyboardAvoidingView>
    );
  }

  return <ScrollView {...props} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
