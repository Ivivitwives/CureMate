import { Colors } from "@/constants/theme";
import { useThemeContext } from "@/hooks/use-theme-context";
import { MaterialIcons } from "@expo/vector-icons";
import { updateProfile } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { auth } from "../../firebaseConfig";

export default function EditProfileScreen({
  onClose,
}: {
  onClose: () => void;
}) {
  const { theme: currentTheme } = useThemeContext();
  const theme = Colors[currentTheme];

  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;

      setUsername(user.displayName ?? "");
    };

    void loadProfile();
  }, []);

  const handleSaveChanges = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Error", "No user logged in");
      return;
    }

    if (!username.trim()) {
      Alert.alert("Error", "Username cannot be empty");
      return;
    }

    console.log("EditProfile: saving", { username });
    setLoading(true);
    try {
      const profileUpdates: { displayName: string } = {
        displayName: username.trim(),
      };

      await updateProfile(user, profileUpdates);

      Alert.alert("Success", "Profile updated successfully");
      onClose();
    } catch (error: any) {
      console.error("Error updating profile:", error);
      const msg = error?.message || String(error);
      Alert.alert("Error", `Could not update profile: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      <View
        style={[
          styles.modalCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Edit Name</Text>
          <Pressable onPress={onClose}>
            <MaterialIcons name="close" size={24} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.fieldSection}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Name</Text>
            <View
              style={[
                styles.inputField,
                {
                  backgroundColor: theme.inputBackground,
                  borderColor: theme.border,
                },
              ]}
            >
              <MaterialIcons
                name="person"
                size={20}
                color={theme.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Your name"
                placeholderTextColor={theme.textMuted}
                value={username}
                onChangeText={setUsername}
                editable={!loading}
              />
            </View>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.cancelButton, { borderColor: theme.primary }]}
            onPress={onClose}
            disabled={loading}
          >
            <Text style={[styles.cancelText, { color: theme.primary }]}>
              Cancel
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.saveButton,
              { backgroundColor: theme.primary },
              loading && styles.saveButtonDisabled,
            ]}
            onPress={handleSaveChanges}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>Save Changes</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    paddingBottom: 0,
    maxHeight: "85%",
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  fieldSection: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  inputField: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E6E8EE",
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: "#FAFBFC",
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#222838",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#6C5CE7",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6C5CE7",
  },
  saveButton: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#6C5CE7",
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
