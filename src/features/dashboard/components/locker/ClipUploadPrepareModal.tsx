import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReportImageCropModal } from "../../../calling/components/ReportImageCropModal";
import { radii, space, typography, useThemeColors, useThemedStyles } from "../../../../theme";
import { useAppTranslation } from "../../../../i18n/useAppTranslation";

export type PreparedClipUpload = {
  video: ImagePicker.ImagePickerAsset;
  thumbUri: string;
};

type Props = {
  visible: boolean;
  video: ImagePicker.ImagePickerAsset | null;
  thumbUri: string | null;
  thumbBusy: boolean;
  onClose: () => void;
  onReplaceVideo: () => void;
  onThumbChange: (uri: string) => void;
  onConfirm: (payload: PreparedClipUpload) => void;
};

export function ClipUploadPrepareModal({
  visible,
  video,
  thumbUri,
  thumbBusy,
  onClose,
  onReplaceVideo,
  onThumbChange,
  onConfirm,
}: Props) {
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const styles = useStyles();
  const [cropVisible, setCropVisible] = useState(false);

  const pickCustomThumb = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("locker.permissionTitle"), t("locker.permissionLibrary"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.9,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      onThumbChange(result.assets[0].uri);
    }
  };

  const confirm = () => {
    if (!video || !thumbUri) return;
    onConfirm({ video, thumbUri });
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, space.md) }]}>
          <Text style={styles.title}>{t("locker.prepareClipTitle")}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={c.text} />
          </Pressable>
        </View>
        <Text style={styles.lead}>{t("locker.prepareClipLead")}</Text>

        <Pressable style={styles.replaceBtn} onPress={onReplaceVideo}>
          <Ionicons name="film-outline" size={18} color={c.brandNavy} />
          <Text style={styles.replaceText}>{t("locker.replaceVideo")}</Text>
        </Pressable>
        {Platform.OS === "ios" ? (
          <Text style={styles.hint}>{t("locker.trimHintIos")}</Text>
        ) : (
          <Text style={styles.hint}>{t("locker.trimHintAndroid")}</Text>
        )}

        {thumbBusy ? (
          <View style={styles.row}>
            <ActivityIndicator color={c.brandNavy} />
            <Text style={styles.hint}>{t("locker.preparingPreview")}</Text>
          </View>
        ) : null}

        {thumbUri ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: thumbUri }} style={styles.preview} resizeMode="cover" />
            <View style={styles.thumbActions}>
              <Pressable style={styles.thumbBtn} onPress={() => setCropVisible(true)}>
                <Ionicons name="crop-outline" size={18} color={c.brandNavy} />
                <Text style={styles.thumbBtnText}>{t("locker.cropThumbnail")}</Text>
              </Pressable>
              <Pressable style={styles.thumbBtn} onPress={pickCustomThumb}>
                <Ionicons name="image-outline" size={18} color={c.brandNavy} />
                <Text style={styles.thumbBtnText}>{t("locker.pickThumbnail")}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
          <Pressable
            style={[styles.continueBtn, (!video || !thumbUri || thumbBusy) && { opacity: 0.45 }]}
            onPress={confirm}
            disabled={!video || !thumbUri || thumbBusy}
          >
            <Text style={styles.continueText}>{t("locker.continueUpload")}</Text>
          </Pressable>
        </View>
      </Modal>

      <ReportImageCropModal
        visible={cropVisible && !!thumbUri}
        imageUri={thumbUri ?? ""}
        onClose={() => setCropVisible(false)}
        onCropped={(uri) => {
          onThumbChange(uri);
          setCropVisible(false);
        }}
      />
    </>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: space.md,
        paddingBottom: space.sm,
      },
      title: { ...typography.titleMd, color: palette.text, flex: 1 },
      lead: {
        ...typography.bodySm,
        color: palette.textMuted,
        paddingHorizontal: space.md,
        marginBottom: space.md,
      },
      replaceBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginHorizontal: space.md,
        marginBottom: space.sm,
      },
      replaceText: { color: palette.brandNavy, fontWeight: "600" },
      hint: {
        ...typography.caption,
        color: palette.textMuted,
        paddingHorizontal: space.md,
        marginBottom: space.sm,
      },
      row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: space.md,
        marginBottom: space.md,
      },
      previewWrap: { marginHorizontal: space.md, marginBottom: space.md },
      preview: {
        width: "100%",
        aspectRatio: 16 / 9,
        borderRadius: radii.md,
        backgroundColor: palette.surfaceMuted,
      },
      thumbActions: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
      thumbBtn: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 10,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.border,
      },
      thumbBtnText: { color: palette.brandNavy, fontWeight: "600", fontSize: 13 },
      footer: { paddingHorizontal: space.md, paddingTop: space.sm },
      continueBtn: {
        backgroundColor: palette.brandNavy,
        borderRadius: radii.md,
        paddingVertical: 14,
        alignItems: "center",
      },
      continueText: { color: palette.brandTextOn, fontWeight: "700", fontSize: 16 },
    })
  );
}
