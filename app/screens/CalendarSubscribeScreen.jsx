import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, Linking, Platform } from "react-native";

/**
 * CalendarSubscribeScreen
 * - Shows two buttons: Apple Calendar (iOS) and Google Calendar (Android/iOS)
 * - Uses your running API (same machine) by default: http://localhost:5001
 *   Tip: when testing on a real device, replace with your Cloudflare URL
 *   (e.g., https://ea-being-toys-harmony.trycloudflare.com) or read from ENV.
 */
export default function CalendarSubscribeScreen() {
  // DEV default: localhost (emulator). For real device, paste your Cloudflare URL here:
  const API_BASE = useMemo(() => {
    // Change this to your public URL when testing on a physical phone:
    return "https://ea-being-toys-harmony.trycloudflare.com";
    // return "https://ea-being-toys-harmony.trycloudflare.com";
  }, []);

  const openUrl = async (url) => {
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) throw new Error("Cannot open URL");
      await Linking.openURL(url);
    } catch (e) {
      console.warn("OpenURL failed:", e?.message || e);
      // Fallback: try forcing https for Android Google flow
      if (url.startsWith("http://")) {
        Linking.openURL(url.replace("http://", "https://"));
      }
    }
  };

  const onApple = () => {
    const url = `${API_BASE}/api/calendar/subscribe?platform=ios`;
    openUrl(url);
  };

  const onGoogle = () => {
    const url = `${API_BASE}/api/calendar/subscribe?platform=android`;
    openUrl(url);
  };

  const onChoice = () => {
    const url = `${API_BASE}/api/calendar/subscribe.html`;
    openUrl(url);
  };

  return (
    <View style={{ flex: 1, padding: 24, backgroundColor: "#0B0C10" }}>
      <Text style={{ color: "white", fontSize: 24, fontWeight: "700", marginBottom: 12 }}>
        Subscribe to Party Trailer Calendar
      </Text>
      <Text style={{ color: "#9aa0a6", fontSize: 14, marginBottom: 24 }}>
        Choose where you want to subscribe. On Android, Google Calendar works best.
      </Text>

      {Platform.OS === "ios" && (
        <TouchableOpacity
          onPress={onApple}
          style={{ padding: 16, borderRadius: 12, backgroundColor: "#1f6feb", marginBottom: 12 }}
        >
          <Text style={{ color: "white", fontSize: 16, textAlign: "center" }}>
            Subscribe in Apple Calendar
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={onGoogle}
        style={{ padding: 16, borderRadius: 12, backgroundColor: "#22c55e", marginBottom: 12 }}
      >
        <Text style={{ color: "white", fontSize: 16, textAlign: "center" }}>
          Subscribe in Google Calendar
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onChoice}
        style={{ padding: 16, borderRadius: 12, backgroundColor: "#334155" }}
      >
        <Text style={{ color: "white", fontSize: 16, textAlign: "center" }}>
          Open Choice Page (Apple / Google)
        </Text>
      </TouchableOpacity>

      <Text style={{ color: "#9aa0a6", fontSize: 12, marginTop: 20 }}>
        Tip: When testing on a physical phone, set API_BASE to your Cloudflare URL.
      </Text>
    </View>
  );
}

