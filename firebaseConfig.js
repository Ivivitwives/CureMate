// Import the functions you need from the SDKs you need
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
    browserLocalPersistence,
    getAuth,
    initializeAuth,
} from "firebase/auth";
import { Platform } from "react-native";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB3ys1weyauy31gcMmuPBBT7RPPDXFcjqg",
  authDomain: "curemate-507ea.firebaseapp.com",
  projectId: "curemate-507ea",
  storageBucket: "curemate-507ea.appspot.com",
  // Use the standard gs.appspot.com bucket hostname for web SDK requests
  // (some Firebase projects use the .app hostname which can cause network errors in web builds)
  messagingSenderId: "773306538543",
  appId: "1:773306538543:web:3dccae0444516093b884da",
  measurementId: "G-FJH4XJCMWC",
};

// Initialize Firebase (avoid duplicate initialization in hot reload / web)
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/** @type {import("firebase/auth").Auth} */
let auth;
try {
  if (Platform.OS === "web") {
    auth = initializeAuth(app, {
      persistence: browserLocalPersistence,
    });
  } else {
    let getReactNativePersistence;
    try {
      // Require at runtime so web bundlers don't try to resolve this module
      // when building for web where the RN persistence module isn't available.
      // eslint-disable-next-line global-require
      getReactNativePersistence =
        require("firebase/auth/react-native").getReactNativePersistence;
    } catch (e) {
      getReactNativePersistence = null;
    }

    if (getReactNativePersistence) {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } else {
      auth = getAuth(app);
    }
  }
} catch (error) {
  auth = getAuth(app);
}

export { auth };

