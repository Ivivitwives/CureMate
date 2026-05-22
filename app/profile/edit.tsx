import { Colors } from "@/constants/theme";
import { useThemeContext } from "@/hooks/use-theme-context";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { updateProfile } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { auth } from "../../firebaseConfig";
import {
  getUserProfile,
  uploadProfileImage,
} from "../../services/firebaseService";

export default function EditProfileScreen({
  onClose,
  onProfileImageUpdated,
}: {
  onClose: () => void;
  onProfileImageUpdated?: (uri: string) => void;
}) {
  const { theme: currentTheme } = useThemeContext();
  const theme = Colors[currentTheme];

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;

      setUsername(user.displayName ?? "");
      setEmail(user.email ?? "");

      try {
        const profile = (await getUserProfile(user.uid)) as {
          profileImage?: string | null;
        } | null;
        if (!active) return;

        const savedImage =
          typeof profile?.profileImage === "string" && profile.profileImage
            ? profile.profileImage
            : (user.photoURL ?? null);

        setProfileImageUri(savedImage);
      } catch (error) {
        console.warn("Error loading profile image:", error);
        if (active) {
          setProfileImageUri(user.photoURL ?? null);
        }
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  const handlePickImage = async () => {
    try {
      if (Platform.OS !== "web") {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(
            "Permission required",
            "Please allow photo library access to change your profile picture.",
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      if (result.assets[0]) {
        setProfileImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Could not pick image.");
    }
  };

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

    console.log("EditProfile: saving", { username, profileImageUri });
    setLoading(true);
    try {
      let photoURL: string | undefined = user.photoURL ?? undefined;

      if (profileImageUri && !profileImageUri.startsWith("http")) {
        if (Platform.OS === "web") {
          Alert.alert(
            "Web preview only",
            "Profile photo upload is available on native builds. Your name was saved, but the new photo cannot be uploaded from the web dev server.",
          );
        } else {
          photoURL = await uploadProfileImage(profileImageUri as string);
        }
      }

      if (photoURL) {
        onProfileImageUpdated?.(photoURL);
      }

      const profileUpdates: { displayName: string; photoURL?: string } = {
        displayName: username.trim(),
      };

      if (photoURL) {
        profileUpdates.photoURL = photoURL;
      } else if (user.photoURL) {
        profileUpdates.photoURL = user.photoURL;
      }

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
          <Text style={[styles.title, { color: theme.text }]}>
            Edit Profile
          </Text>
          <Pressable onPress={onClose}>
            <MaterialIcons name="close" size={24} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Picture Section */}
          <View style={styles.pictureSection}>
            <View
              style={[
                styles.pictureContainer,
                { backgroundColor: theme.primarySoft },
              ]}
            >
              {profileImageUri ? (
                <Image
                  source={{ uri: profileImageUri }}
                  style={styles.profileImage}
                />
              ) : (
                <MaterialIcons name="person" size={64} color={theme.primary} />
              )}
            </View>
            <Pressable
              style={[styles.cameraButton, { backgroundColor: theme.primary }]}
              onPress={handlePickImage}
            >
              <MaterialIcons name="camera-alt" size={16} color="#fff" />
            </Pressable>
          </View>
          <Text style={[styles.pictureTip, { color: theme.textMuted }]}>
            Tap to change profile picture
          </Text>

          {/* Username Field */}
          <View style={styles.fieldSection}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>
              Username
            </Text>
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
                placeholder="Username"
                placeholderTextColor={theme.textMuted}
                value={username}
                onChangeText={setUsername}
                editable={!loading}
              />
            </View>
          </View>

          {/* Email Field */}
          <View style={styles.fieldSection}>
            <Text style={[styles.fieldLabel, { color: theme.text }]}>
              Email
            </Text>
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
                name="email"
                size={20}
                color={theme.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.textMuted }]}
                value={email}
                editable={false}
              />
            </View>
            <Text style={[styles.emailNote, { color: theme.textMuted }]}>
              Email cannot be changed
            </Text>
          </View>
        </ScrollView>

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
  content: {
    paddingHorizontal: 20,
    paddingVertical: 0,
    flexGrow: 0,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  pictureSection: {
    alignItems: "center",
    marginBottom: 24,
    position: "relative",
  },
  pictureContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#DAD6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  cameraButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#6C5CE7",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  pictureTip: {
    textAlign: "center",
    fontSize: 13,
    color: "#999",
    marginBottom: 20,
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
  emailNote: {
    fontSize: 12,
    color: "#999",
    marginTop: 6,
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
