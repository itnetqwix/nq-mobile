import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ImageWithSkeleton } from "../../../../components/ui";
import { getS3ImageUrl } from "../../../../lib/imageUtils";
import { useThemeColors } from "../../../../theme";

type Props = {
  uri?: string;
  name?: string;
  size?: number;
  onlineStatus?: "online" | "offline";
};

export function HomeUserAvatar({ uri, name, size = 48, onlineStatus }: Props) {
  const c = useThemeColors();
  const [failed, setFailed] = useState(false);
  const url = getS3ImageUrl(uri);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const inner =
    !url || failed ? (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.brandNavy,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: size * 0.38, color: c.brandTextOn, fontWeight: "700" }}>
          {(name ?? "?")[0]?.toUpperCase()}
        </Text>
      </View>
    ) : (
      <ImageWithSkeleton
        uri={url}
        width={size}
        height={size}
        borderRadius={size / 2}
        resizeMode="cover"
        onLoadError={() => setFailed(true)}
        accessibilityLabel={name ? `Photo of ${name}` : "Profile photo"}
      />
    );

  if (!onlineStatus) return inner;

  return (
    <View style={{ width: size, height: size }}>
      {inner}
      <View
        style={[
          styles.dot,
          {
            width: Math.max(10, size * 0.22),
            height: Math.max(10, size * 0.22),
            borderRadius: Math.max(5, size * 0.11),
            borderColor: c.surfaceElevated,
            backgroundColor: onlineStatus === "online" ? "#43A047" : "#E57373",
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    borderWidth: 2,
  },
});
