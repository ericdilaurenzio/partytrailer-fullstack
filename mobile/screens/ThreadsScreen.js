// mobile/screens/ThreadsScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList, RefreshControl } from "react-native";
import { BACKEND_URL, OWNERS, DEFAULT_OWNER_INDEX } from "../lib/config";

export default function ThreadsScreen({ onOpenThread }) {
  const viewerId = OWNERS[DEFAULT_OWNER_INDEX].id;
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/conversations/for/${viewerId}`);
      const data = await res.json();
      setThreads(Array.isArray(data) ? data : []);
    } catch (e) {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const renderItem = ({ item }) => {
    const last = item.lastMessage;
    return (
      <Pressable style={styles.row} onPress={() => onOpenThread(item._id)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item.subject || "Conversation"}</Text>
          <Text style={styles.snip} numberOfLines={1}>
            {last ? last.body : "No messages yet"}
          </Text>
        </View>
        {item.unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{item.unread}</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTxt}>Threads</Text>
      </View>

      <FlatList
        data={threads}
        keyExtractor={(it) => String(it._id)}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        ListEmptyComponent={
          !loading && (
            <View style={{ padding: 20 }}>
              <Text style={{ color: "#9fb2d3" }}>No conversations yet.</Text>
            </View>
          )
        }
        contentContainerStyle={{ padding: 12, gap: 8 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1220" },
  header: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#263045",
    backgroundColor: "#0f1628",
  },
  headerTxt: { color: "white", fontSize: 18, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#0f1628",
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#263045",
  },
  title: { color: "white", fontSize: 16, fontWeight: "700" },
  snip: { color: "#9fb2d3", fontSize: 12, marginTop: 2 },
  badge: {
    minWidth: 24,
    paddingHorizontal: 6,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#2e5a9c",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTxt: { color: "white", fontSize: 12, fontWeight: "700" },
});
