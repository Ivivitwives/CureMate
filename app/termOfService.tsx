import { Colors } from "@/constants/theme";
import { useThemeContext } from "@/hooks/use-theme-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    type ViewStyle,
} from "react-native";

type Section = {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  summary: string;
  body: string;
};

const SECTIONS: Section[] = [
  {
    key: "intro",
    title: "Introduction",
    icon: "sparkles-outline",
    summary: "What this agreement covers",
    body: "This Terms of Service page defines the rules that apply when you use CureMate. It explains the scope of the app, the responsibilities of each user, and the standards we expect while using medication reminders and health tracking features.",
  },
  {
    key: "using-app",
    title: "Using the App",
    icon: "phone-portrait-outline",
    summary: "Accepted use and account responsibility",
    body: "You agree to use CureMate only for lawful, personal, and intended purposes. Keep your account details accurate, protect your login credentials, and avoid any activity that could disrupt reminders, schedules, logging, or app stability for yourself or other users.",
  },
  {
    key: "privacy",
    title: "Privacy",
    icon: "shield-checkmark-outline",
    summary: "How data should be handled",
    body: "Any information collected in CureMate should be handled carefully and only for the purpose of delivering reminders, tracking adherence, and improving the experience. If a separate privacy policy exists, reference it here and keep the language aligned with your actual data practices.",
  },
  {
    key: "liability",
    title: "Limitation of Liability",
    icon: "alert-circle-outline",
    summary: "Important legal protections",
    body: "CureMate is a support tool and does not replace professional medical advice, diagnosis, or treatment. The app and its maintainers should not be held liable for missed doses, inaccurate entries, device issues, network failures, or outcomes resulting from reliance on the app alone.",
  },
  {
    key: "law",
    title: "Governing Law",
    icon: "document-text-outline",
    summary: "Where disputes are resolved",
    body: "State the governing law, venue, and dispute resolution process that applies to this agreement. If your organization has specific legal requirements, replace this section with the exact language approved for your product and jurisdiction.",
  },
];

export default function TermsOfService() {
  const router = useRouter();
  const navigation = useNavigation();
  const { theme: currentTheme } = useThemeContext();
  const theme = Colors[currentTheme];

  const decorativeBlobStyle = (
    top: number,
    left: number,
    size: number,
  ): ViewStyle => ({
    backgroundColor: theme.primary,
    opacity: currentTheme === "dark" ? 0.14 : 0.08,
    height: size,
    width: size,
    top,
    left,
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.decorBlob, decorativeBlobStyle(-48, -20, 140)]} />
      <View style={[styles.decorBlob, decorativeBlobStyle(120, -70, 180)]} />
      <View
        style={[
          styles.decorBlob,
          {
            backgroundColor: theme.primary,
            opacity: currentTheme === "dark" ? 0.12 : 0.06,
            height: 220,
            width: 220,
            top: 40,
            right: -90,
          },
        ]}
      />

      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable
          onPress={() => {
            try {
              if (
                navigation &&
                (navigation as any).canGoBack &&
                (navigation as any).canGoBack()
              ) {
                (navigation as any).goBack();
              } else {
                router.replace("/(tabs)");
              }
            } catch (err) {
              router.replace("/(tabs)");
            }
          }}
          style={({ pressed }) => [
            styles.back,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: pressed ? 0.84 : 1,
            },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerEyebrow, { color: theme.textMuted }]}>
            Legal
          </Text>
          <Text style={[styles.title, { color: theme.text }]}>
            Terms of Service
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: currentTheme === "dark" ? "#000" : "#1A2340",
            },
          ]}
        >
          <View
            style={[styles.heroIcon, { backgroundColor: theme.primarySoft }]}
          >
            <Ionicons name="document-text" size={30} color={theme.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: theme.text }]}>
            Terms that feel clear, calm, and trustworthy.
          </Text>
          <Text style={[styles.heroText, { color: theme.textSecondary }]}>
            Use this page to present your legal terms in a clean, structured way
            that is easy to read on every screen size.
          </Text>

          <View style={styles.metaRow}>
            <View
              style={[
                styles.metaChip,
                {
                  backgroundColor: theme.primarySoft,
                  borderColor: theme.primaryBorder,
                },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={14}
                color={theme.primary}
              />
              <Text style={[styles.metaChipText, { color: theme.primary }]}>
                Updated May 22, 2026
              </Text>
            </View>
            <View
              style={[
                styles.metaChip,
                {
                  backgroundColor: theme.surfaceAlt,
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={14}
                color={theme.textMuted}
              />
              <Text
                style={[styles.metaChipText, { color: theme.textSecondary }]}
              >
                CureMate policy
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.gridRow}>
          <View
            style={[
              styles.pillCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Ionicons name="time-outline" size={18} color={theme.primary} />
            <Text style={[styles.pillLabel, { color: theme.textMuted }]}>
              Read time
            </Text>
            <Text style={[styles.pillValue, { color: theme.text }]}>2 min</Text>
          </View>
          <View
            style={[
              styles.pillCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Ionicons name="layers-outline" size={18} color={theme.primary} />
            <Text style={[styles.pillLabel, { color: theme.textMuted }]}>
              Sections
            </Text>
            <Text style={[styles.pillValue, { color: theme.text }]}>
              {SECTIONS.length}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.noteCard,
            { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          ]}
        >
          <Ionicons
            name="information-circle-outline"
            size={20}
            color={theme.primary}
          />
          <Text style={[styles.noteCardText, { color: theme.textSecondary }]}>
            This screen is still placeholder content, but the presentation now
            matches a polished legal page. Replace the copy with your approved
            legal text when ready.
          </Text>
        </View>

        {SECTIONS.map((section, index) => (
          <View
            key={section.key}
            style={[
              styles.sectionCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                shadowColor: currentTheme === "dark" ? "#000" : "#15233C",
              },
            ]}
          >
            <View style={styles.sectionTopRow}>
              <View
                style={[
                  styles.sectionIcon,
                  { backgroundColor: theme.primarySoft },
                ]}
              >
                <Ionicons name={section.icon} size={18} color={theme.primary} />
              </View>
              <View style={styles.sectionHeadingWrap}>
                <Text style={[styles.sectionIndex, { color: theme.textMuted }]}>
                  0{index + 1}
                </Text>
                <Text style={[styles.heading, { color: theme.text }]}>
                  {section.title}
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionSummary, { color: theme.primary }]}>
              {section.summary}
            </Text>
            <Text style={[styles.paragraph, { color: theme.textSecondary }]}>
              {section.body}
            </Text>
          </View>
        ))}

        <View
          style={[
            styles.footerCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={styles.footerRow}>
            <View
              style={[
                styles.footerBadge,
                { backgroundColor: theme.warningSoft },
              ]}
            >
              <Ionicons name="mail-outline" size={16} color={theme.warning} />
            </View>
            <View style={styles.footerTextWrap}>
              <Text style={[styles.footerTitle, { color: theme.text }]}>
                Questions or changes?
              </Text>
              <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                Replace this footer with your support contact or legal contact
                details so users know where to reach you.
              </Text>
            </View>
          </View>

          <View
            style={[styles.footerDivider, { backgroundColor: theme.border }]}
          />

          <Pressable
            onPress={() => {
              try {
                if (
                  navigation &&
                  (navigation as any).canGoBack &&
                  (navigation as any).canGoBack()
                ) {
                  (navigation as any).goBack();
                } else {
                  router.replace("/(tabs)");
                }
              } catch (err) {
                router.replace("/(tabs)");
              }
            }}
            style={({ pressed }) => [
              styles.returnButton,
              {
                backgroundColor: theme.primary,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Ionicons name="arrow-back-outline" size={16} color="#FFFFFF" />
            <Text style={styles.returnButtonText}>Go back</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  decorBlob: {
    position: "absolute",
    borderRadius: 999,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
  },
  headerEyebrow: {
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 36,
    gap: 14,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    marginTop: 14,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  heroText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  gridRow: {
    flexDirection: "row",
    gap: 12,
  },
  pillCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 4,
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  pillValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  noteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
  },
  noteCardText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  sectionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeadingWrap: {
    flex: 1,
  },
  sectionIndex: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  heading: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  sectionSummary: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "700",
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 21,
  },
  footerCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginTop: 2,
  },
  footerRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  footerBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  footerTextWrap: {
    flex: 1,
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  footerText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
  },
  footerDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 16,
  },
  returnButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  returnButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
