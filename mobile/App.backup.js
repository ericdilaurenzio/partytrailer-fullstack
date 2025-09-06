// mobile/App.js
import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ThreadsScreen from "./screens/ThreadsScreen";
import ChatScreen from "./screens/ChatScreen";
import { Canvas } from "./components/Canvas";

export default function App() {
  const [tab, setTab] = useState("threads"); // 'threads' | 'chat' | 'designer'
  const [activeConvId, setActiveConvId] = useState(null);

  const openThread = (id) => { setActiveConvId(id); setTab("chat"); };

  return (
    <SafeAreaProvider>
      <View style={styles.safe}>
        {/* tabs */}
        <View style={styles.tabbar}>
          <Pressable onPress={() => setTab("threads")} style={[styles.tab, tab === "threads" && styles.tabActive]}><Text style={styles.tabTxt}>Threads</Text></Pressable>
          <Pressable onPress={() => setTab("chat")} style={[styles.tab, tab === "chat" && styles.tabActive]}><Text style={styles.tabTxt}>Chat</Text></Pressable>
          <Pressable onPress={() => setTab("designer")} style={[styles.tab, tab === "designer" && styles.tabActive]}><Text style={styles.tabTxt}>Designer</Text></Pressable>
        </View>

        <View style={{ flex: 1 }}>
          {tab === "threads" && <ThreadsScreen onOpenThread={openThread} />}
          {tab === "chat" && <ChatScreen conversationId={activeConvId || undefined} />}
          {tab === "designer" && <Canvas />}
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1220" },
  tabbar: { flexDirection: "row", gap: 8, padding: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#263045", backgroundColor: "#0f1628" },
  tab: { backgroundColor: "#1f2b45", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  tabActive: { backgroundColor: "#2e5a9c" },
  tabTxt: { color: "white", fontWeight: "700" },
});
