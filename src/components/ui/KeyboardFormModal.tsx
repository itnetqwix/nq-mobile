/**
 * Keyboard-safe modal shell for forms with TextInput fields.
 * Use for any Modal + TextInput combo to prevent the keyboard from covering inputs/actions.
 */
import React from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  type ModalProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space } from "../../theme";

export type KeyboardFormModalProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Fixed footer (submit buttons) — stays above keyboard via KAV sibling layout. */
  footer?: React.ReactNode;
  presentationStyle?: ModalProps["presentationStyle"];
  animationType?: ModalProps["animationType"];
  transparent?: boolean;
  /** Extra bottom padding inside ScrollView content (default: insets.bottom + 96). */
  scrollBottomPadding?: number;
  keyboardVerticalOffset?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

export function KeyboardFormModal({
  visible,
  onClose,
  children,
  footer,
  presentationStyle = "pageSheet",
  animationType = "slide",
  transparent = false,
  scrollBottomPadding,
  keyboardVerticalOffset,
  contentContainerStyle,
  style,
}: KeyboardFormModalProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = scrollBottomPadding ?? insets.bottom + 96;
  const kavOffset = keyboardVerticalOffset ?? insets.top + 8;

  return (
    <Modal
      visible={visible}
      animationType={animationType}
      presentationStyle={presentationStyle}
      transparent={transparent}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.flex, style]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={kavOffset}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: footer ? space.md : bottomPad },
              contentContainerStyle,
            ]}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </TouchableWithoutFeedback>
        {footer ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
});
