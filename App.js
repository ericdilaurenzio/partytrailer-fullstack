import React from "react";
import { SafeAreaView, StatusBar } from "react-native";
import CalendarSubscribeScreen from "./app/screens/CalendarSubscribeScreen";

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0C10" }}>
      <StatusBar barStyle="light-content" />
      <CalendarSubscribeScreen />
    </SafeAreaView>
  );
}
