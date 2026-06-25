import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BrandBootScreen } from "../splash/BrandBootScreen";
import { space, typography } from "../../theme";

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

/**
 * Catches render errors so a JS exception does not quit the dev client silently.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error("[AppErrorBoundary]", error, info.componentStack);
    }
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error.message || "Something went wrong.";

    return (
      <View style={styles.root}>
        <BrandBootScreen message="We hit a snag" />
        <View style={styles.panel}>
          <Text style={styles.title}>App failed to load</Text>
          <Text style={styles.body} selectable>
            {message}
          </Text>
          <Pressable onPress={this.reset} style={styles.btn}>
            <Text style={styles.btnLabel}>Try again</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  panel: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    bottom: space.xl,
    padding: space.lg,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.96)",
    gap: space.sm,
  },
  title: { ...typography.titleSm, fontWeight: "800", color: "#0F2B5B" },
  body: { ...typography.bodySm, color: "#334155", lineHeight: 20 },
  btn: {
    alignSelf: "flex-start",
    marginTop: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#1976d2",
  },
  btnLabel: { ...typography.label, color: "#fff", fontWeight: "700" },
});
