import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, ScrollView } from "react-native";
import {
  completeFaceLiveness,
  createFaceLivenessSession,
  updateVerificationProfile,
} from "../verificationApi";

type Props = { onDone: () => void };

export function ProfileFaceScreen({ onDone }: Props) {
  const [category, setCategory] = useState("");
  const [bio, setBio] = useState("");
  const [profilePicture, setProfilePicture] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [msg, setMsg] = useState("");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Profile & face</Text>
      <Text style={styles.sub}>Step 2: complete profile and liveness check</Text>
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <TextInput style={styles.input} placeholder="Category" value={category} onChangeText={setCategory} />
      <TextInput style={styles.input} placeholder="Bio" value={bio} onChangeText={setBio} multiline />
      <TextInput
        style={styles.input}
        placeholder="Profile picture URL"
        value={profilePicture}
        onChangeText={setProfilePicture}
      />
      <Button
        title="Save profile"
        onPress={() =>
          updateVerificationProfile({ category, bio, profile_picture: profilePicture, extraInfo: { bio } }).then(
            () => setMsg("Profile saved")
          )
        }
      />

      <Text style={styles.hint}>
        Face: use front camera. Remove mask, sunglasses, hat. Good lighting.
      </Text>
      <Button
        title="Start liveness"
        onPress={() =>
          createFaceLivenessSession().then((s) => {
            setSessionId(s.sessionId);
            setMsg(s.mock ? "Mock session — tap Submit when ready" : "Session started");
          })
        }
      />
      <Button
        title="Submit for review"
        onPress={async () => {
          try {
            await completeFaceLiveness(sessionId);
            onDone();
          } catch (e: any) {
            setMsg(e?.message || "Submission failed");
          }
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 48 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  sub: { color: "#666", marginBottom: 16 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, marginBottom: 12 },
  hint: { marginVertical: 12, color: "#444" },
  msg: { color: "#000080", marginBottom: 12 },
});
