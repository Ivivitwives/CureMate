import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveData = async (key, data) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.log("Error saving data:", e);
  }
};

export const getData = async (key) => {
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.log("Error getting data:", e);
    return [];
  }
};