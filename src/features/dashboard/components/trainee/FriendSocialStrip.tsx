import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getS3ImageUrl } from "../../../../lib/imageUtils";
import {
  getTrainerFriendsWhoBooked,
  getTrainerFriendsWhoFavorited,
  type TrainerFriendPeer,
} from "../../../bookexpert/lib/trainerUtils";
import { useThemedStyles } from "../../../../theme";

type Props = {
  trainer: Record<string, unknown>;
};

function PeerAvatar({
  peer,
  badge,
  styles,
}: {
  peer: TrainerFriendPeer;
  badge: "heart" | "calendar";
  styles: ReturnType<typeof makeStyles>;
}) {
  const [failed, setFailed] = React.useState(false);
  const url = getS3ImageUrl(peer.profile_picture);
  return (
    <View style={styles.avatarWrap}>
      {url && !failed ? (
        <Image
          source={{ uri: url }}
          style={styles.avatar}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <View style={styles.initialCircle}>
            <Ionicons name="person" size={12} color="#fff" />
          </View>
        </View>
      )}
      <View
        style={[
          styles.badge,
          badge === "heart" ? styles.badgeHeart : styles.badgeCalendar,
        ]}
      >
        <Ionicons
          name={badge === "heart" ? "heart" : "calendar"}
          size={8}
          color="#fff"
        />
      </View>
    </View>
  );
}

function AvatarCluster({
  peers,
  badge,
  styles,
}: {
  peers: TrainerFriendPeer[];
  badge: "heart" | "calendar";
  styles: ReturnType<typeof makeStyles>;
}) {
  if (!peers.length) return null;
  return (
    <View style={styles.cluster}>
      {peers.map((peer, index) => (
        <View
          key={peer._id}
          style={[styles.clusterItem, index > 0 && styles.clusterOverlap]}
        >
          <PeerAvatar peer={peer} badge={badge} styles={styles} />
        </View>
      ))}
    </View>
  );
}

/** Overlapping friend avatars — favorites (heart) and sessions (calendar), no labels. */
export function FriendSocialStrip({ trainer }: Props) {
  const styles = useStyles();
  const favorited = getTrainerFriendsWhoFavorited(trainer);
  const booked = getTrainerFriendsWhoBooked(trainer);
  if (!favorited.length && !booked.length) return null;

  return (
    <View style={styles.row}>
      <AvatarCluster peers={booked} badge="calendar" styles={styles} />
      {booked.length > 0 && favorited.length > 0 ? (
        <View style={styles.divider} />
      ) : null}
      <AvatarCluster peers={favorited} badge="heart" styles={styles} />
    </View>
  );
}

function makeStyles() {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 6,
    },
    cluster: { flexDirection: "row", alignItems: "center" },
    clusterItem: {},
    clusterOverlap: { marginLeft: -10 },
    divider: {
      width: 1,
      height: 20,
      backgroundColor: "rgba(0,0,0,0.08)",
    },
    avatarWrap: { position: "relative" },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: "#fff",
      backgroundColor: "#E0E0E0",
    },
    avatarFallback: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#5C6BC0",
    },
    initialCircle: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    badge: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 14,
      height: 14,
      borderRadius: 7,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: "#fff",
    },
    badgeHeart: { backgroundColor: "#E53935" },
    badgeCalendar: { backgroundColor: "#1565C0" },
  });
}

function useStyles() {
  return useThemedStyles(() => makeStyles());
}
