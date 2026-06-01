import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ScreenContainer } from "../../../components/ui";
import { useGuestMode } from "../../auth/hooks/useGuestMode";
import { useAppTranslation } from "../../../i18n/useAppTranslation";
import { queryKeys } from "../../../lib/queryKeys";
import type { HomeStackParamList } from "../../../navigation/types";
import { radii, space, typography, useThemeColors } from "../../../theme";
import { fetchCmsBlogs } from "../api/cmsApi";

export function BlogsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const { t } = useAppTranslation();
  const c = useThemeColors();
  const isGuest = useGuestMode();

  const { data = [], isLoading } = useQuery({
    queryKey: queryKeys.content.blogs(isGuest),
    queryFn: () => fetchCmsBlogs({ guest: isGuest }),
    staleTime: 60_000,
  });

  return (
    <ScreenContainer scroll padding="md">
      <Text style={[styles.lead, { color: c.textMuted }]}>
        {t("cms.blogsSubtitle")}
      </Text>
      {isLoading ? (
        <ActivityIndicator color={c.brandAccent} style={{ marginTop: space.xl }} />
      ) : data.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="newspaper-outline" size={40} color={c.textMuted} />
          <Text style={[styles.emptyText, { color: c.textMuted }]}>
            {t("cms.blogsEmpty")}
          </Text>
        </View>
      ) : (
        data.map((post) => (
          <Pressable
            key={post._id}
            onPress={() => navigation.navigate("BlogPost", { slug: post.slug })}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: c.surfaceElevated, borderColor: c.border },
              pressed && { opacity: 0.92 },
            ]}
          >
            {post.cover_image_url ? (
              <Image
                source={{ uri: post.cover_image_url }}
                style={styles.cover}
                contentFit="cover"
              />
            ) : null}
            <View style={styles.cardBody}>
              <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
                {post.title}
              </Text>
              {post.excerpt ? (
                <Text style={[styles.excerpt, { color: c.textMuted }]} numberOfLines={3}>
                  {post.excerpt}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
          </Pressable>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  lead: { ...typography.body, marginBottom: space.md },
  empty: { alignItems: "center", gap: space.sm, marginTop: space.xl * 2 },
  emptyText: { ...typography.body, textAlign: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    marginBottom: space.md,
  },
  cover: { width: 88, height: 88 },
  cardBody: { flex: 1, padding: space.md, gap: 4 },
  title: { ...typography.titleSm, fontWeight: "800" },
  excerpt: { ...typography.bodySm, lineHeight: 18 },
});
