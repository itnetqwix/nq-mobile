/**
 * Design System showcase — `__DEV__`-only screen used to verify the look &
 * feel of every primitive in `components/ui` against the active theme tokens.
 * Intentionally NOT wired into navMatrix; deep-link via `navigation.navigate`
 * from a dev menu / Settings shake gesture.
 */

import React, { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import {
  Avatar,
  Banner,
  Button,
  Card,
  Divider,
  EmptyState,
  FormField,
  Header,
  ListRow,
  Pill,
  ScreenContainer,
  SectionHeader,
  Sheet,
  Skeleton,
  Stack,
} from "../../components/ui";
import { colors, radii, shadows, space, typography } from "../../theme";

export function DesignSystemScreen() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [text, setText] = useState("");
  const [toggled, setToggled] = useState(false);

  if (!__DEV__) {
    return (
      <ScreenContainer>
        <Text style={typography.bodyMd}>Showcase only available in dev builds.</Text>
      </ScreenContainer>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title="Design System" subtitle="Tokens & primitives" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <SectionHeader label="Typography" />
        <Card>
          <Text style={typography.displayMd}>Display Md</Text>
          <Text style={typography.titleLg}>Title Lg</Text>
          <Text style={typography.titleMd}>Title Md</Text>
          <Text style={typography.titleSm}>Title Sm</Text>
          <Text style={typography.subtitle}>Subtitle</Text>
          <Text style={typography.bodyLg}>Body Lg</Text>
          <Text style={typography.bodyMd}>Body Md</Text>
          <Text style={typography.bodySm}>Body Sm</Text>
          <Text style={typography.label}>Label</Text>
          <Text style={typography.overline}>OVERLINE</Text>
          <Text style={typography.caption}>caption</Text>
        </Card>

        <SectionHeader label="Colors" />
        <Card>
          <Stack direction="row" gap="sm" wrap>
            {[
              "brand",
              "brandAccent",
              "success",
              "warning",
              "danger",
              "info",
              "neutral100",
              "neutral500",
              "neutral900",
            ].map((key) => (
              <View key={key} style={styles.swatchWrap}>
                <View
                  style={[styles.swatch, { backgroundColor: (colors as any)[key] }]}
                />
                <Text style={typography.caption}>{key}</Text>
              </View>
            ))}
          </Stack>
        </Card>

        <SectionHeader label="Shadows" />
        <Stack direction="row" gap="md" wrap>
          {(["sm", "md", "lg", "xl"] as const).map((tier) => (
            <View
              key={tier}
              style={[styles.shadowBlock, shadows[tier], { borderRadius: radii.md }]}
            >
              <Text style={typography.label}>shadow.{tier}</Text>
            </View>
          ))}
        </Stack>

        <SectionHeader label="Buttons" />
        <Card>
          <Stack gap="sm">
            <Button label="Primary" onPress={() => undefined} />
            <Button label="Secondary" variant="secondary" onPress={() => undefined} />
            <Button label="Ghost" variant="ghost" onPress={() => undefined} />
            <Button label="Danger" variant="danger" onPress={() => undefined} />
            <Button label="Loading" loading onPress={() => undefined} />
            <Button label="With icons" leftIcon="add" rightIcon="arrow-forward" onPress={() => undefined} />
            <Stack direction="row" gap="sm">
              <Button label="sm" size="sm" fullWidth={false} onPress={() => undefined} />
              <Button label="md" size="md" fullWidth={false} onPress={() => undefined} />
              <Button label="lg" size="lg" fullWidth={false} onPress={() => undefined} />
            </Stack>
          </Stack>
        </Card>

        <SectionHeader label="Cards" />
        <Stack gap="sm">
          <Card variant="flat">
            <Text style={typography.subtitle}>Flat card</Text>
            <Text style={typography.bodySm}>No shadow, no border.</Text>
          </Card>
          <Card variant="raised">
            <Text style={typography.subtitle}>Raised card</Text>
            <Text style={typography.bodySm}>Default elevation.</Text>
          </Card>
          <Card variant="outlined">
            <Text style={typography.subtitle}>Outlined card</Text>
            <Text style={typography.bodySm}>Border only — great for forms.</Text>
          </Card>
        </Stack>

        <SectionHeader label="List Rows" />
        <Card padding={0}>
          <ListRow
            icon="person-circle"
            title="Profile"
            subtitle="Update name, photo and bio"
            onPress={() => undefined}
          />
          <Divider inset={16} />
          <ListRow
            icon="notifications"
            title="Notifications"
            rightAdornment={<Switch value={toggled} onValueChange={setToggled} />}
          />
          <Divider inset={16} />
          <ListRow
            icon="trash"
            title="Delete account"
            destructive
            onPress={() => undefined}
          />
        </Card>

        <SectionHeader label="Pills" />
        <Stack direction="row" gap="sm" wrap>
          <Pill label="Neutral" />
          <Pill label="Info" tone="info" icon="information-circle" />
          <Pill label="Success" tone="success" icon="checkmark-circle" />
          <Pill label="Warning" tone="warning" icon="warning" />
          <Pill label="Danger" tone="danger" icon="alert-circle" />
          <Pill label="Brand" tone="brand" icon="star" />
        </Stack>

        <SectionHeader label="Banners" />
        <Stack gap="sm">
          <Banner tone="info" title="Heads up" description="Informational message." />
          <Banner
            tone="success"
            title="All set"
            description="Your changes were saved."
            onDismiss={() => undefined}
          />
          <Banner tone="warning" title="Almost there" description="One more step." />
          <Banner
            tone="danger"
            title="Something went wrong"
            description="Try again in a moment."
            action={{ label: "Retry", onPress: () => undefined }}
          />
        </Stack>

        <SectionHeader label="Avatars" />
        <Stack direction="row" gap="sm" align="center">
          <Avatar size="xs" name="Sam Wilson" />
          <Avatar size="sm" name="Sam Wilson" />
          <Avatar size="md" name="Sam Wilson" />
          <Avatar size="lg" name="Sam Wilson" />
          <Avatar size="xl" name="Sam Wilson" />
        </Stack>

        <SectionHeader label="Form Field" />
        <Card>
          <FormField label="Email" placeholder="you@example.com" value={text} onChangeText={setText} required />
          <View style={{ height: 12 }} />
          <FormField label="With error" placeholder="Try focusing" error="Required field" />
        </Card>

        <SectionHeader label="Skeletons" />
        <Card>
          <Skeleton height={20} />
          <View style={{ height: 8 }} />
          <Skeleton height={14} width="60%" />
          <View style={{ height: 8 }} />
          <Skeleton height={14} width="80%" />
        </Card>

        <SectionHeader label="Empty State" />
        <Card padding={0}>
          <EmptyState
            icon="albums-outline"
            title="No clips yet"
            description="Upload your first clip to get started."
            actionLabel="Upload"
            onAction={() => undefined}
          />
        </Card>

        <SectionHeader label="Sheet" />
        <Card>
          <Button label="Open sheet" onPress={() => setSheetOpen(true)} />
        </Card>

        <View style={{ height: space.xxl }} />
      </ScrollView>

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Bottom sheet"
        description="Used for forms, pickers and detail views."
        showClose
      >
        <Stack gap="sm">
          <Banner tone="info" title="This is inside a sheet" />
          <Button label="Close" variant="secondary" onPress={() => setSheetOpen(false)} />
        </Stack>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: space.md,
    gap: space.xs,
  },
  swatchWrap: { alignItems: "center", marginBottom: space.xs, width: 80 },
  swatch: {
    width: 60,
    height: 40,
    borderRadius: radii.sm,
    marginBottom: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  shadowBlock: {
    width: 110,
    height: 70,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
});
