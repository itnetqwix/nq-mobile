import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  getSocialLinksFromUser,
  hasPublicSocialLinks,
  openSocialLink,
  type SocialMediaLinks,
} from "../../lib/social/socialLinks";
import { radii, useThemeColors, useThemedStyles } from "../../theme";

type Props = {
  user?: Record<string, unknown> | null;
  links?: SocialMediaLinks;
  size?: "sm" | "md";
  align?: "left" | "center" | "right";
};

type LinkItem = {
  id: "facebook" | "instagram" | "website";
  url: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  label: string;
};

export function PublicSocialLinksRow({
  user,
  links: linksProp,
  size = "md",
  align = "left",
}: Props) {
  const c = useThemeColors();
  const styles = useStyles();
  const links = linksProp ?? getSocialLinksFromUser(user);

  const items = useMemo<LinkItem[]>(() => {
    const out: LinkItem[] = [];
    if (links.fb?.trim()) {
      out.push({
        id: "facebook",
        url: links.fb.trim(),
        icon: "logo-facebook",
        color: "#1877F2",
        bg: "#E8F1FE",
        label: "Facebook",
      });
    }
    if (links.instagram?.trim()) {
      out.push({
        id: "instagram",
        url: links.instagram.trim(),
        icon: "logo-instagram",
        color: "#E4405F",
        bg: "#FDE8EF",
        label: "Instagram",
      });
    }
    if (links.slack?.trim()) {
      out.push({
        id: "website",
        url: links.slack.trim(),
        icon: "globe-outline",
        color: c.brandNavy,
        bg: c.brandSubtle,
        label: "Website",
      });
    }
    return out;
  }, [links, c.brandNavy, c.brandSubtle]);

  if (!hasPublicSocialLinks(links) || items.length === 0) return null;

  const dim = size === "sm" ? 34 : 40;
  const iconSize = size === "sm" ? 17 : 20;

  return (
    <View
      style={[
        styles.row,
        align === "center" && styles.rowCenter,
        align === "right" && styles.rowRight,
        size === "sm" && styles.rowSm,
      ]}
    >
      {items.map((item) => (
        <Pressable
          key={item.id}
          style={({ pressed }) => [
            styles.btn,
            {
              width: dim,
              height: dim,
              borderRadius: dim / 2,
              backgroundColor: item.bg,
            },
            pressed && styles.btnPressed,
          ]}
          onPress={() => void openSocialLink(item.url, item.label)}
          accessibilityRole="link"
          accessibilityLabel={item.label}
        >
          <Ionicons name={item.icon} size={iconSize} color={item.color} />
        </Pressable>
      ))}
    </View>
  );
}

function useStyles() {
  return useThemedStyles((palette) =>
    StyleSheet.create({
      row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 8,
      },
      rowSm: { marginTop: 6, gap: 6 },
      rowCenter: { justifyContent: "center" },
      rowRight: { justifyContent: "flex-end", alignSelf: "flex-end" },
      btn: {
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: palette.border,
      },
      btnPressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
    })
  );
}
