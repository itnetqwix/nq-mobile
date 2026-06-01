import { Image } from "expo-image";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useQuery } from "@tanstack/react-query";
import { Button, ScreenContainer } from "../../../components/ui";
import { useGuestMode } from "../../auth/hooks/useGuestMode";
import { queryKeys } from "../../../lib/queryKeys";
import type { HomeStackParamList } from "../../../navigation/types";
import { radii, space, typography, useThemeColors } from "../../../theme";
import { fetchCmsBlogPost } from "../api/cmsApi";

type Props = NativeStackScreenProps<HomeStackParamList, "BlogPost">;

export function BlogPostScreen({ route, navigation }: Props) {
  const { slug } = route.params;
  const c = useThemeColors();
  const isGuest = useGuestMode();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.content.blogPost(slug),
    queryFn: () => fetchCmsBlogPost(slug, { guest: isGuest }),
    staleTime: 60_000,
  });

  React.useLayoutEffect(() => {
    if (data?.title) navigation.setOptions({ title: data.title });
  }, [navigation, data?.title]);

  if (isLoading || !data) {
    return (
      <ScreenContainer scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={c.brandAccent} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll padding="md">
      {data.cover_image_url ? (
        <Image source={{ uri: data.cover_image_url }} style={styles.hero} contentFit="cover" />
      ) : null}
      {data.video_url ? (
        <Pressable
          onPress={() => Linking.openURL(data.video_url!).catch(() => {})}
          style={[styles.videoChip, { backgroundColor: c.brandAccentSubtle }]}
        >
          <Text style={[styles.videoText, { color: c.brandNavy }]}>▶ Watch video</Text>
        </Pressable>
      ) : null}
      <WebView
        source={{
          html: `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/>
          <style>body{font-family:-apple-system,sans-serif;padding:8px 0;color:${c.text};line-height:1.65}
          img{max-width:100%;height:auto;border-radius:12px}</style></head>
          <body>${data.body_html}</body></html>`,
        }}
        style={styles.web}
        scrollEnabled={false}
      />
      {data.cta_label && data.cta_url ? (
        <Button
          label={data.cta_label}
          onPress={() => Linking.openURL(data.cta_url!).catch(() => {})}
          size="lg"
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: {
    width: "100%",
    height: 200,
    borderRadius: radii.xl,
    marginBottom: space.md,
  },
  videoChip: {
    alignSelf: "flex-start",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radii.pill,
    marginBottom: space.md,
  },
  videoText: { ...typography.label, fontWeight: "700" },
  web: { minHeight: 280, width: "100%", marginBottom: space.lg },
});
