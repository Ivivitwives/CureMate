import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyB3ys1weyauy31gcMmuPBBT7RPPDXFcjqg",
  authDomain: "curemate-507ea.firebaseapp.com",
  projectId: "curemate-507ea",
  storageBucket: "curemate-507ea.appspot.com",
  messagingSenderId: "773306538543",
  appId: "1:773306538543:web:3dccae0444516093b884da",
  measurementId: "G-FJH4XJCMWC",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth: import("firebase/auth").Auth;
try {
  if (Platform.OS === "web") {
    const { browserLocalPersistence } = require("firebase/auth");
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence,
    });
  } else {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
} catch (error) {
  const { getAuth } = require("firebase/auth");
  auth = getAuth(app);
}

export { auth };

