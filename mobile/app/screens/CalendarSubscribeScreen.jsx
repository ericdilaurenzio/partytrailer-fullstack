import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Linking, Platform, Alert, ActivityIndicator, Share } from "react-native";
import * as Clipboard from "expo-clipboard";
import ShareEmailButton from "../components/ShareEmailButton";

/**
 * CalendarSubscribeScreen (Expo)
 * - Loads link data from your API (/api/calendar/link)
 * - Minimal buttons: Apple (iOS), Email me, Copy URL, Share
 */
export default function CalendarSubscribeScreen() {
  // Your API base (only this stays fixed)
  const API_BASE = useMemo(() => "https://ea-being-toys-harmony.trycloudflare.com", []);
  const [loading, setLoading] = useState(true);
  const [httpUrl, setHttpUrl] = useState(null);     // https://.../api/calendar.ics
  const [webcalUrl, setWebcalUrl] = useState(null); // webcal://.../api/calendar.ics
  const [iosRedirect, setIosRedirect] = useState(null); // convenience redirect
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/calendar/link`);
        const j = await r.json();
        if (!r.ok || !j?.httpUrl) throw new Error(j?.error || "Link discovery failed");
        setHttpUrl(j.httpUrl);
        setWebcalUrl(j.webcalUrl || null);
        setIosRedirect(`${API_BASE}/api/calendar/subscribe?platform=ios`);
        setLoading(false);
      } catch (e) {
        setError(e?.message || "Could not load links");
        setLoading(false);
      }
    };
    load();
  }, [API_BASE]);

  const openUrl = async (url) => {
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) throw new Error("Cannot open URL");
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert("Couldn’t open link", (e?.message || "Unknown error"));
    }
  };

  const onApple = () => {
    if (iosRedirect) return openUrl(iosRedirect);
    if (webcalUrl) return openUrl(webcalUrl);
    Alert.alert("Not ready", "Calendar link not loaded yet.");
  };

  const onCopyLink = async () => {
    if (!httpUrl) return Alert.alert("Not ready", "Calendar link not loaded yet.");
    await Clipboard.setStringAsync(httpUrl);
    Alert.alert(
      "Copied",
      "Subscription URL copied. On a computer, add it in Google Calendar → Settings → Add calendar → From URL."
    );
  };

  const onEmailMe = () => {
    if (!httpUrl) return Alert.alert("Not ready", "Calendar link not loaded yet.");
    const subject = encodeURIComponent("Party Trailer — Calendar subscription link");
    const body = encodeURIComponent(
`Hi,

To add the live Party Trailer calendar in Google Calendar (desktop):

1) Open this page: https://calendar.google.com/calendar/u/0/r/settings/addbyurl
2) Paste this URL into "URL of calendar":
${httpUrl}
3) Click "Add calendar".

(After adding on desktop once, it will sync to your phone automatically.)`
    );
    const mailto = `mailto:?subject=${subject}&body=${body}`;
    openUrl(mailto);
  };

  const onShare = async () => {
    if (!httpUrl) return Alert.alert("Not ready", "Calendar link not loaded yet.");
    try {
      await Share.share({
        title: "Party Trailer — calendar subscription",
        message:
`Add to Google Calendar (desktop):
https://calendar.google.com/calendar/u/0/r/settings/addbyurl

Subscription URL:
${httpUrl}`
      });
    } catch (e) {
      Alert.alert("Share failed", e?.message || "Unknown error");
    }
  };

  return (
    <View style={{ flex: 1, padding: 24, backgroundColor: "#0B0C10" }}>
      <Text style={{ color: "white", fontSize: 24, fontWeight: "700", marginBottom: 12 }}>
        Subscribe to Party Trailer Calendar
      </Text>
      <Text style={{ color: "#9aa0a6", fontSize: 14, marginBottom: 24 }}>
        Fastest path: email yourself the link and add on desktop. Apple Calendar works directly on iOS.
      </Text>

      {loading ? (
        <View style={{ paddingTop: 12 }}>
          <ActivityIndicator />
          <Text style={{ color: "#9aa0a6", marginTop: 8 }}>Loading calendar link…</Text>
        </View>
      ) : error ? (
        <Text style={{ color: "#ef4444" }}>Error: {error}</Text>
      ) : (
        <>
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
            onPress={onEmailMe}
            style={{ padding: 16, borderRadius: 12, backgroundColor: "#f59e0b", marginBottom: 12 }}
          >
            <Text style={{ color: "white", fontSize: 16, textAlign: "center" }}>
              Email me the subscription link (desktop method)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onCopyLink}
            style={{ padding: 16, borderRadius: 12, backgroundColor: "#334155", marginBottom: 12 }}
          >
            <Text style={{ color: "white", fontSize: 16, textAlign: "center" }}>
              Copy subscription URL
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onShare}
            style={{ padding: 16, borderRadius: 12, backgroundColor: "#64748b" }}
          >
            <Text style={{ color: "white", fontSize: 16, textAlign: "center" }}>
              Share subscription link
            </Text>
          </TouchableOpacity>
        </>
      )}
            <ShareEmailButton to="me@example.com" /></View>
  );
}


