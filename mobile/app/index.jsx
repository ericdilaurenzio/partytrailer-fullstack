import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import CalendarSubscribeScreen from "./screens/CalendarSubscribeScreen";
import MakeHoldScreen from "./screens/MakeHoldScreen";

/**
 * Minimal Home with inline navigation.
 */
export default function Home() {
  const [screen, setScreen] = useState("home"); // "home" | "calendar" | "makeHold"

  if (screen === "calendar") {
    return (
      <View style={{ flex: 1, backgroundColor: "#0B0C10" }}>
        <View style={{ padding: 12, backgroundColor: "#111827", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>Calendar</Text>
          <TouchableOpacity onPress={() => setScreen("home")} style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#374151", borderRadius: 10 }}>
            <Text style={{ color: "white" }}>Back to Home</Text>
          </TouchableOpacity>
        </View>
        <CalendarSubscribeScreen />
      </View>
    );
  }

  if (screen === "makeHold") {
    return (
      <View style={{ flex: 1, backgroundColor: "#0B0C10" }}>
        <View style={{ padding: 12, backgroundColor: "#111827", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>Make Tentative Hold</Text>
          <TouchableOpacity onPress={() => setScreen("home")} style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#374151", borderRadius: 10 }}>
            <Text style={{ color: "white" }}>Back to Home</Text>
          </TouchableOpacity>
        </View>
        <MakeHoldScreen onDone={() => setScreen("home")} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#0B0C10" }} contentContainerStyle={{ padding: 24 }}>
      <Text style={{ color: "white", fontSize: 24, fontWeight: "700", marginBottom: 8 }}>Party Trailer</Text>
      <Text style={{ color: "#9aa0a6", marginBottom: 20 }}>Quick actions</Text>

      <TouchableOpacity
        onPress={() => setScreen("calendar")}
        style={{ padding: 16, borderRadius: 12, backgroundColor: "#1f6feb", marginBottom: 12 }}
      >
        <Text style={{ color: "white", fontSize: 16, textAlign: "center" }}>
          Calendar & Sync
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setScreen("makeHold")}
        style={{ padding: 16, borderRadius: 12, backgroundColor: "#8b5cf6", marginBottom: 12 }}
      >
        <Text style={{ color: "white", fontSize: 16, textAlign: "center" }}>
          Make Tentative Hold
        </Text>
      </TouchableOpacity>

      {/* More actions can go here later */}
    </ScrollView>
  );
}
