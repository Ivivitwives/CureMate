# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

<h1 align="center">
   CureMate
</h1>

<p align="center">
  <strong>Medication Tracking and Reminder Mobile Application</strong><br/>
  Helping users manage medicine schedules and medication adherence.
</p>

<p align="center">
  <img src="./assets/CureMate_logo.png" width="120" alt="CureMate Logo"/>
</p>

<p align="center">
  Built with React Native · Expo · Firebase
</p>

---

## Screenshots

> Place your screenshots inside a `screenshots/` folder in the root of the project,
> then replace the filenames below with your actual screenshot files.

|             Splash             |            Login             |              Register              |
| :----------------------------: | :--------------------------: | :--------------------------------: |
| ![Splash](./assets/splash.png) | ![Login](./assets/login.png) | ![Register](./assets/register.png) |

|       Home Dashboard       |            Add Medicine             | Edit Medicine |
| :------------------------: | :---------------------------------: | :-----------: |
| ![Home](./assets/home.png) |    ![Add Medicine](./assets/add     |
|           .png)            | ![Edit Medicine](./assets/edit.png) |

|             Weekly Reports             |             Monthly Reports              |             History              |
| :------------------------------------: | :--------------------------------------: | :------------------------------: |
| ![Weekly Reports](./assets/weekly.png) | ![Monthly Reports](./assets/monthly.png) | ![History](./assets/history.png) |

|                Notification                |             Profile              |
| :----------------------------------------: | :------------------------------: |
| ![Notification](./assets/notification.png) | ![Profile](./assets/profile.png) |

---

## Table of Contents

1. [Overview](#overview)
2. [Midterm vs Final Feature List](#midterm-vs-final-feature-list)
3. [Architecture Overview](#architecture-overview)
4. [Firebase Configuration](#firebase-configuration)
5. [Security Rules](#security-rules)
6. [Build Instructions](#build-instructions)
7. [Group Members](#group-members)
8. [References](#references)

---

## Overview

CureMate is a mobile-based medication tracking and reminder application designed to help users manage their medicine schedules and monitor medication intake. The application allows users to add medicines, create medication schedules, receive reminder notifications, and monitor medication adherence through weekly and monthly reports.

The system was developed using React Native with Expo for cross-platform mobile development and Firebase Firestore for cloud-based data storage and synchronization.

---

## Midterm vs Final Feature List

### Midterm Features

| Feature                        | Description                                  |
| ------------------------------ | -------------------------------------------- |
| User Registration              | Create account using email and password      |
| User Login                     | Secure login authentication                  |
| Home Dashboard                 | Displays daily medication schedules          |
| Add Medicine                   | Add medicine name, dosage, and schedule      |
| Edit Medicine                  | Modify medicine information                  |
| Delete Medicine                | Remove medicine schedules                    |
| Medication History             | View medicine logs                           |
| Firebase Firestore Integration | Cloud database integration                   |
| Basic Reports                  | Weekly medication tracking                   |
| CRUD Operations                | Create, Read, Update, Delete functionalities |

---

### Final Features

| Feature                    | Description                              |
| -------------------------- | ---------------------------------------- |
| Push Notifications         | Local medication reminder notifications  |
| Monthly Reports            | Monthly medication summary               |
| Real-Time Log Generation   | Automatic medication log creation        |
| Medication Status Tracking | Taken, missed, and pending tracking      |
| Firebase Authentication    | Secure account-based access              |
| Firestore Security Rules   | User-specific database security          |
| Responsive Navigation      | Faster screen transitions                |
| Performance Optimization   | Reduced unnecessary refreshes            |
| APK Deployment             | Android APK deployment through EAS Build |
| Improved UI/UX             | Cleaner user interface and navigation    |

---

## Architecture Overview

### Folder Structure

```txt
CureMate/
│
├── app/
│   ├── (tabs)/
│   ├── addMedicine.tsx
│   ├── editMedicine.tsx
│   ├── reports.tsx
│   ├── history.tsx
│   └── profile.tsx
│
├── components/
│
├── services/
│   ├── firebaseService.ts
│   ├── notificationService.ts
│   └── scheduleService.ts
│
├── constants/
│
├── firebaseConfig.ts
│
├── assets/
│
└── package.json
```

---

### State Management Approach

CureMate uses React Hooks and component-based state management.

#### Technologies Used:

- useState
- useEffect
- useFocusEffect

Firestore is used for cloud-based data synchronization while local state handles UI updates and navigation behavior.

---

### Navigation Structure

```txt
Login/Register
       ↓
Home Dashboard
 ├── Add Medicine
 ├── Reports
 ├── History
 └── Profile
```

---

## Firebase Configuration

Firebase configuration is stored separately inside `firebaseConfig.ts`.

Sensitive Firebase credentials are not directly exposed inside application screens or public repositories.

### Firebase Services Used

| Service                 | Purpose                       |
| ----------------------- | ----------------------------- |
| Firebase Authentication | User login and authentication |
| Firebase Firestore      | Cloud database                |
| Expo Notifications      | Push notifications            |

---

## Security Rules

CureMate uses Firebase Firestore Security Rules to protect user data.

### Key Security Features

- Only authenticated users can access the database
- Users can only access their own medication records
- Unauthorized access is restricted

### Example Security Rule

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read, write: if request.auth != null
                          && request.auth.uid == userId;

      match /{document=**} {
        allow read, write: if request.auth != null
                            && request.auth.uid == userId;
      }
    }
  }
}
```

---

## Build Instructions

### 1. Install Dependencies

```bash
npm install
```

---

### 2. Install AsyncStorage

```bash
npx expo install @react-native-async-storage/async-storage
```

---

### 3. Install EAS CLI

```bash
npm install -g eas-cli
```

---

### 4. Login to Expo

```bash
eas login
```

---

### 5. Configure EAS Build

```bash
eas build:configure
```

---

### 6. Start Development Server

```bash
npx expo start
```

---

### 7. Build Android APK

```bash
eas build --platform android --profile preview
```

---

## Group Members

| Name           | Role                      |
| -------------- | ------------------------- |
| Ivy Porcado    | Developer / Documentation |
| Robylyn Flores | Member                    |

---

## References

- Firebase Documentation  
  https://firebase.google.com/docs

- React Native Documentation  
  https://reactnative.dev/docs/getting-started

- Expo Documentation  
  https://docs.expo.dev

- Expo Notifications  
  https://docs.expo.dev/versions/latest/sdk/notifications/

- EAS Build Documentation  
  https://docs.expo.dev/build/introduction/

- Firestore Security Rules Documentation  
  https://firebase.google.com/docs/firestore/security/get-started

---

<p align="center">
  Built using React Native + Expo + Firebase<br/>
  <em>ADET 2 — App Development and Emerging Technologies</em>
</p>
1. Install dependencies

```bash
npm install
```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
