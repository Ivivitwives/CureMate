// Dynamically pick implementation at runtime so Expo Go / native uses the
// appropriate picker. Using a runtime require avoids forcing the web
// implementation in environments where the native picker is preferred.
import { Platform } from "react-native";

let Impl: any;
if (Platform.OS === "web") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Impl = require("./time-picker.web");
} else {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Impl = require("./time-picker.native");
}

export const TimePickerModal = Impl.TimePickerModal;
