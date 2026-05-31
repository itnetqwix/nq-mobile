/**
 * Shown when native WebRTC cannot run (Expo Go, missing native build).
 * Instant / scheduled lessons are app-native only — no embedded web meeting.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { Button } from "../../../components/ui";
import type { RootStackParamList } from "../../../navigation/types";
import { getNativeCallUnavailableMessage } from "../nativeCallAvailability";

type Props = NativeStackScreenProps<RootStackParamList, "Meeting">;

export function NativeCallRequiredScreen({ navigation }: Props) {
  const { title, body, hint } = getNativeCallUnavailableMessage();
  const iosCmd = "npx expo run:ios";
  const androidCmd = "npx expo run:android";

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="videocam-off-outline" size={48} color="#fff" />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Install the NetQwix dev app (required)</Text>
          <Text style={styles.cardBody}>
            Live video only works in the NetQwix native app (your app icon), not Expo Go and not
            iPhone Camera / QR scan alone. If you already installed via{" "}
            <Text style={styles.bold}>expo run:ios --device</Text> or{" "}
            <Text style={styles.bold}>expo run:android</Text>, reload Metro (
            <Text style={styles.bold}>r</Text>) and open the NetQwix icon again.
          </Text>
          <Text style={styles.cmdLabel}>First-time setup on your Mac:</Text>
          <Text style={styles.cmd}>{Platform.OS === "ios" ? iosCmd + " --device" : androidCmd}</Text>
          <Text style={styles.cmdHint}>
            Then run <Text style={styles.bold}>npm start</Text>, connect from the in-app dev
            launcher (USB + <Text style={styles.bold}>npm run android:reverse</Text> helps on
            Android).
          </Text>
        </View>

        {hint ? <Text style={styles.hint}>{hint}</Text> : null}

        <Button
          label="Go back"
          leftIcon="arrow-back"
          onPress={() => navigation.goBack()}
          style={styles.btn}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000080" },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
    justifyContent: "center",
  },
  iconWrap: {
    alignSelf: "center",
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginBottom: 24,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  cardBody: { color: "rgba(255,255,255,0.88)", fontSize: 14, lineHeight: 21, marginBottom: 12 },
  cmdLabel: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginBottom: 6 },
  cmd: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#fff",
    fontSize: 13,
    backgroundColor: "rgba(0,0,0,0.25)",
    padding: 10,
    borderRadius: 8,
    overflow: "hidden",
  },
  cmdHint: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
  bold: { fontWeight: "800", color: "#fff" },
  hint: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
  },
  btn: { marginTop: 8 },
});
