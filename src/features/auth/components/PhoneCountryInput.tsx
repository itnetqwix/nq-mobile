import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../theme";
import {
  DEFAULT_PHONE_COUNTRY,
  formatE164Phone,
  isValidNationalPhone,
  PHONE_COUNTRIES,
  type PhoneCountry,
} from "../../../lib/phone/countryDialCodes";

type Props = {
  country: PhoneCountry;
  nationalNumber: string;
  onChangeCountry: (country: PhoneCountry) => void;
  onChangeNational: (value: string) => void;
  label?: string;
  required?: boolean;
};

export function PhoneCountryInput({
  country,
  nationalNumber,
  onChangeCountry,
  onChangeNational,
  label,
  required,
}: Props) {
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const styles = useStyles();
  const [pickerOpen, setPickerOpen] = useState(false);

  const e164Preview = useMemo(
    () => formatE164Phone(country.dial, nationalNumber),
    [country.dial, nationalNumber]
  );

  const valid = isValidNationalPhone(country, nationalNumber);

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { color: c.text }]}>
          {label}
          {required ? <Text style={{ color: c.danger }}> *</Text> : null}
        </Text>
      ) : null}
      <View style={[styles.row, { borderColor: c.border, backgroundColor: c.surfaceElevated }]}>
        <Pressable
          style={[styles.countryBtn, { borderColor: c.border }]}
          onPress={() => setPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t("auth.selectCountryCode", { defaultValue: "Select country code" })}
        >
          <Text style={[styles.dial, { color: c.text }]}>{country.dial}</Text>
          <Ionicons name="chevron-down" size={14} color={c.textMuted} />
        </Pressable>
        <TextInput
          style={[styles.input, { color: c.text }]}
          value={nationalNumber}
          onChangeText={onChangeNational}
          keyboardType="phone-pad"
          placeholder={country.example}
          placeholderTextColor={c.textMuted}
          accessibilityLabel={t("auth.phone")}
        />
      </View>
      {e164Preview && !valid ? (
        <Text style={[styles.hint, { color: c.textMuted }]}>
          {t("auth.phoneDigitsHint", {
            defaultValue: "Enter {{min}}–{{max}} digits for {{country}}",
            min: country.minDigits,
            max: country.maxDigits,
            country: country.name,
          })}
        </Text>
      ) : e164Preview && valid ? (
        <Text style={[styles.hint, { color: c.textSecondary }]}>
          {t("auth.phoneE164Preview", { defaultValue: "SMS will be sent to {{phone}}", phone: e164Preview })}
        </Text>
      ) : null}

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.surface }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: c.text }]}>
              {t("auth.selectCountry", { defaultValue: "Select country" })}
            </Text>
            <ScrollView>
              {PHONE_COUNTRIES.map((row) => {
                const selected = row.iso === country.iso;
                return (
                  <Pressable
                    key={row.iso}
                    style={[styles.countryRow, selected && { backgroundColor: c.brandSubtle }]}
                    onPress={() => {
                      onChangeCountry(row);
                      setPickerOpen(false);
                    }}
                  >
                    <Text style={[styles.countryName, { color: c.text }]}>{row.name}</Text>
                    <Text style={[styles.countryDial, { color: c.textSecondary }]}>{row.dial}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export { DEFAULT_PHONE_COUNTRY, formatE164Phone, isValidNationalPhone };

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      wrap: { gap: space.xs },
      label: { ...typography.bodySm, fontWeight: "600" },
      row: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderRadius: radii.md,
        overflow: "hidden",
      },
      countryBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: space.sm,
        paddingVertical: space.md,
        borderRightWidth: 1,
      },
      dial: { fontWeight: "700", fontSize: 15 },
      input: {
        flex: 1,
        paddingHorizontal: space.sm,
        paddingVertical: space.md,
        fontSize: 16,
      },
      hint: { ...typography.caption, marginTop: 2 },
      backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "flex-end",
      },
      sheet: {
        maxHeight: "55%",
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        padding: space.md,
      },
      sheetTitle: { ...typography.titleSm, fontWeight: "700", marginBottom: space.sm },
      countryRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: space.sm,
        paddingHorizontal: space.xs,
        borderRadius: radii.sm,
      },
      countryName: { fontWeight: "600" },
      countryDial: { fontWeight: "600" },
    })
  );
}
