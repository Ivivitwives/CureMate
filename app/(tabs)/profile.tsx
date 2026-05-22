import { Colors } from "@/constants/theme";
import { useThemeContext } from "@/hooks/use-theme-context";
import {
  cancelAllScheduled,
  requestAndScheduleForLogs,
} from "@/services/notificationService";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { onAuthStateChanged, signOut } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { DecorativeBackground } from "../../components/decorative-background";
import { auth } from "../../firebaseConfig";
import { getUserProfile } from "../../services/firebaseService";
import { checkAndResetDay, getTodayLogs } from "../../services/schedule";
import EditProfileScreen from "../profile/edit";

const PROFILE_PIC = null;

type SettingRowProps = {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
};

type InfoItemKey = "reminders" | "help" | "about";

type MenuItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  onPress?: () => void;
};

const INFO_CONTENT: Record<InfoItemKey, { title: string; message: string }> = {
  reminders: {
    title: "Reminders & Notifications",
    message:
      "Manages your medicine reminders and device notifications. Use it to keep track of scheduled doses and alerts.",
  },
  help: {
    title: "Help & Support",
    message:
      "Opens guidance for using the app and getting help if something is not working the way you expect.",
  },
  about: {
    title: "About Us",
    message:
      "CureMate is a medication reminder and tracking application designed to help users manage their medicines, schedules, and daily adherence. The app provides timely reminders, history tracking, and progress monitoring to support healthier medication habits.",
  },
};

const SettingRow: React.FC<SettingRowProps> = ({ icon, label, onPress }) => {
  const { theme: currentTheme } = useThemeContext();
  const theme = Colors[currentTheme];

  return (
    <Pressable
      style={[
        styles.row,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
      onPress={onPress}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}>
          {icon}
        </View>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
    </Pressable>
  );
};

export default function Profile() {
  const router = useRouter();
  const { theme: currentTheme } = useThemeContext();
  const theme = Colors[currentTheme];
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [medCounts, setMedCounts] = useState({ meds: 0, doses: 0, days: 0 });
  const [showEditModal, setShowEditModal] = useState(false);
  const [infoItem, setInfoItem] = useState<InfoItemKey | null>(null);

  const blurActiveElement = () => {
    const documentRef = globalThis as typeof globalThis & {
      document?: {
        activeElement?: { blur?: () => void };
      };
    };

    documentRef.document?.activeElement?.blur?.();
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setName(user.displayName ?? null);
        setEmail(user.email ?? null);
        setUserId(user.uid);
      } else {
        setName(null);
        setEmail(null);
        setUserId(null);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    let active = true;

    const loadProfileImage = async () => {
      if (!userId) {
        setProfileImageUri(null);
        return;
      }

      try {
        const profile = (await getUserProfile(userId)) as {
          profileImage?: string | null;
        } | null;

        if (!active) return;

        setProfileImageUri(profile?.profileImage ?? null);
      } catch (error) {
        console.warn("Error loading profile image:", error);
        if (active) {
          setProfileImageUri(null);
        }
      }
    };

    void loadProfileImage();

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    (async () => {
      try {
        await checkAndResetDay();
        const logs = await getTodayLogs();
        if (!logs || logs.length === 0) {
          setMedCounts({ meds: 0, doses: 0, days: 0 });
          return;
        }
        const meds = new Set(logs.map((l) => l.medicineId)).size;
        const doses = logs.length;
        setMedCounts({ meds, doses, days: 7 });
      } catch (e) {
        console.warn("Error loading logs:", e);
        setMedCounts({ meds: 0, doses: 0, days: 0 });
      }
    })();
  }, [userId]);

  const onBellPress = async () => {
    if (!userId) {
      Alert.alert("Error", "Please log in first.");
      return;
    }
    try {
      await cancelAllScheduled();
      const logs = await getTodayLogs();
      if (!logs || logs.length === 0) {
        Alert.alert("No logs", "No medicine reminders for today.");
        return;
      }
      const scheduled = await requestAndScheduleForLogs(logs);
      Alert.alert(
        "Notifications",
        `Scheduled ${scheduled} reminders for today.`,
      );
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not schedule notifications.");
    }
  };

  const onLogoutPress = async () => {
    try {
      blurActiveElement();
      await signOut(auth);
      router.replace("/(auth)/login");
    } catch (error) {
      console.error("Error signing out:", error);
      Alert.alert("Error", "Could not log out right now.");
    }
  };

  const openInfoPopup = (key: InfoItemKey) => {
    blurActiveElement();
    setInfoItem(key);
  };

  const menuItems: MenuItem[] = [
    {
      key: "reminders",
      label: "Reminders & Notifications",
      icon: <Ionicons name="alarm-outline" size={20} color={theme.primary} />,
      onPress: () => openInfoPopup("reminders"),
    },
    {
      key: "help",
      label: "Help & Support",
      icon: (
        <Ionicons name="help-circle-outline" size={20} color={theme.primary} />
      ),
      onPress: () => openInfoPopup("help"),
    },
    {
      key: "about",
      label: "About Us",
      icon: (
        <Ionicons
          name="information-circle-outline"
          size={20}
          color={theme.primary}
        />
      ),
      onPress: () => openInfoPopup("about"),
    },
    {
      key: "terms",
      label: "Terms of Service",
      icon: (
        <Ionicons
          name="document-text-outline"
          size={20}
          color={theme.primary}
        />
      ),
      onPress: () => {
        blurActiveElement();
        router.push("/termOfService");
      },
    },
    {
      key: "logout",
      label: "Logout",
      icon: <Ionicons name="exit-outline" size={20} color={theme.danger} />,
      onPress: onLogoutPress,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <DecorativeBackground theme={theme} currentTheme={currentTheme} />
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerEyebrow, { color: theme.textMuted }]}>
            Account
          </Text>
          <Text style={[styles.title, { color: theme.text }]}>Profile</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Manage your personal details, reminders, and support options.
          </Text>
        </View>

        <Pressable
          onPress={onBellPress}
          style={({ pressed }) => [
            styles.bell,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: pressed ? 0.86 : 1,
            },
          ]}
        >
          <Ionicons
            name="notifications-outline"
            size={22}
            color={theme.primary}
          />
        </Pressable>
      </View>

      <View
        style={[
          styles.profileCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            shadowColor: currentTheme === "dark" ? "#000" : "#15233C",
          },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
          {profileImageUri ? (
            <Image
              source={{ uri: profileImageUri }}
              style={styles.avatarImage}
            />
          ) : (
            <Ionicons name="person" size={48} color={theme.primary} />
          )}
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: theme.text }]}>
            {name ?? "Your name"}
          </Text>
          <Text style={[styles.email, { color: theme.textSecondary }]}>
            {email ?? "—"}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.editBtn,
              {
                backgroundColor: theme.primarySoft,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
            onPress={() => {
              blurActiveElement();
              setShowEditModal(true);
            }}
          >
            <MaterialIcons name="edit" size={16} color={theme.primary} />
            <Text style={[styles.editText, { color: theme.primary }]}>
              {" "}
              Edit Profile
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: currentTheme === "dark" ? "#000" : "#15233C",
            },
          ]}
        >
          <Text style={[styles.metricNumber, { color: theme.primary }]}>
            {medCounts.meds}
          </Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
            Medicines Active
          </Text>
        </View>
        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: currentTheme === "dark" ? "#000" : "#15233C",
            },
          ]}
        >
          <Text style={[styles.metricNumber, { color: theme.primary }]}>
            {medCounts.doses}
          </Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
            Doses Today
          </Text>
        </View>
        <View
          style={[
            styles.metricCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: currentTheme === "dark" ? "#000" : "#15233C",
            },
          ]}
        >
          <Text style={[styles.metricNumber, { color: theme.primary }]}>
            {medCounts.days}
          </Text>
          <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
            Days On Track
          </Text>
        </View>
      </View>

      <FlatList
        data={menuItems}
        ListHeaderComponent={
          <View style={styles.menuHeader}>
            <Text style={[styles.menuHeaderTitle, { color: theme.text }]}>
              Settings
            </Text>
            <Text
              style={[
                styles.menuHeaderSubtitle,
                { color: theme.textSecondary },
              ]}
            >
              Privacy, support, and app information
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <SettingRow
            icon={item.icon}
            label={item.label}
            onPress={item.onPress}
          />
        )}
        keyExtractor={(i) => i.key}
        contentContainerStyle={{ paddingBottom: 60, paddingTop: 8 }}
      />

      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <EditProfileScreen
          onClose={() => setShowEditModal(false)}
          onProfileImageUpdated={setProfileImageUri}
        />
      </Modal>

      <Modal
        visible={!!infoItem}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoItem(null)}
      >
        <Pressable
          style={[styles.infoOverlay, { backgroundColor: "rgba(0,0,0,0.35)" }]}
          onPress={() => setInfoItem(null)}
        >
          <Pressable
            style={[
              styles.infoCard,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={() => {}}
          >
            <Text style={[styles.infoTitle, { color: theme.text }]}>
              {infoItem ? INFO_CONTENT[infoItem].title : "Info"}
            </Text>
            <Text style={[styles.infoMessage, { color: theme.textSecondary }]}>
              {infoItem ? INFO_CONTENT[infoItem].message : ""}
            </Text>
            <Pressable
              style={[
                styles.infoCloseButton,
                { backgroundColor: theme.primary },
              ]}
              onPress={() => setInfoItem(null)}
            >
              <Text style={styles.infoCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F6FB",
    padding: 16,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 4,
    gap: 12,
  },
  headerCopy: { flex: 1 },
  headerEyebrow: {
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  title: { fontSize: 24, fontWeight: "800", marginTop: 2 },
  headerSubtitle: { marginTop: 6, fontSize: 13, lineHeight: 19 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 24,
    marginTop: 14,
    gap: 14,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  info: { flex: 1 },
  name: { fontSize: 20, fontWeight: "800", letterSpacing: -0.2 },
  email: { color: "#666", marginTop: 4, fontSize: 13, lineHeight: 18 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    backgroundColor: "#F2F0FF",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    alignSelf: "flex-start",
    gap: 4,
  },
  editText: { color: "#6C5CE7", fontWeight: "700" },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderWidth: 1,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 18,
    alignItems: "center",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  metricNumber: { fontSize: 22, fontWeight: "800", color: "#6C5CE7" },
  metricLabel: {
    color: "#777",
    marginTop: 6,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
  },
  menuHeader: {
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuHeaderTitle: { fontSize: 16, fontWeight: "800" },
  menuHeaderSubtitle: { marginTop: 4, fontSize: 12, lineHeight: 17 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 18,
    marginTop: 12,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  rowLeft: { flexDirection: "row", alignItems: "center" },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F2F0FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  infoOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  infoCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  infoMessage: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
  },
  infoCloseButton: {
    marginTop: 18,
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  infoCloseText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
