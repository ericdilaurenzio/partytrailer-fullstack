// mobile/screens/NewThreadScreen.js
import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert, ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BACKEND_URL, OWNERS } from "../lib/config";

function normUser(u) {
  // Defensive normalization so comparisons/search never fail
  return {
    _id: String(u?._id ?? ""),
    name: String(u?.name ?? ""),
    email: String(u?.email ?? ""),
    phone: String(u?.phone ?? ""),
    role: String(u?.role ?? ""),
  };
}

export default function NewThreadScreen({ onCreated }) {
  const insets = useSafeAreaInsets();

  // Owners preselected (you can toggle off or add others)
  const ownersSet = useMemo(() => new Set(OWNERS.map(o => String(o.id))), []);
  const [users, setUsers] = useState([]);
  const [subject, setSubject] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(new Set(ownersSet));
  const [actionH, setActionH] = useState(56);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Inline "add new person" form
  const [newName, setNewName]   = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch(`${BACKEND_URL}/api/users`);
      const data = await res.json();
      const list = Array.isArray(data) ? data.map(normUser) : [];
      setUsers(list);
    } catch {
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const toggle = (id) => {
    const key = String(id);
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key); else s.add(key);
      return s;
    });
  };

  const removeChip = (id) => {
    const key = String(id);
    setSelected(prev => {
      const s = new Set(prev);
      s.delete(key);
      return s;
    });
  };

  const selectOwners   = () => setSelected(new Set(ownersSet));
  const clearSelection = () => setSelected(new Set());

  const create = async () => {
    const participants = Array.from(selected).map(String);
    if (participants.length < 2) {
      Alert.alert("Pick participants", "Select at least two people for the thread.");
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants, subject: subject.trim() }),
      });

      // Show backend error body if not OK
      if (!res.ok) {
        const text = await res.text();
        Alert.alert("Create failed", `HTTP ${res.status}\n${text}`);
        return;
      }

      const conv = await res.json();
      if (conv?._id) onCreated?.(String(conv._id));
      else Alert.alert("Couldn’t create", "Server didn’t return a conversation id.");
    } catch (e) {
      Alert.alert("Network error", String(e?.message || e));
    }
  };

  // --- Search logic (name, email, phone) ---
  const q = query.trim().toLowerCase();
  const filtered = users.filter(u => {
    if (!q) return true;
    const name  = u.name.toLowerCase();
    const email = u.email.toLowerCase();
    const phone = u.phone.toLowerCase();
    return name.includes(q) || email.includes(q) || phone.includes(q);
  });

  // If user typed something and there are zero matches, show "Add new person" card
  const showAddNew = q.length > 0 && filtered.length === 0;

  // Initialize "add new person" fields from the query if empty
  useEffect(() => {
    if (showAddNew) {
      const looksEmail = q.includes("@");
      const looksPhone = /^\+?[\d\-\s().]{6,}$/.test(query);
      if (!newName)  setNewName(query);
      if (looksEmail && !newEmail) setNewEmail(query);
      if (looksPhone && !newPhone) setNewPhone(query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddNew]);

  const addNewPerson = async () => {
    const name  = newName.trim();
    const email = newEmail.trim();
    const phone = newPhone.trim();

    if (!name && !email && !phone) {
      Alert.alert("Missing info", "At least provide a name, email, or phone.");
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "customer", name, email: email || undefined, phone: phone || undefined }),
      });

      if (!res.ok) {
        const text = await res.text();
        Alert.alert("Add failed", `HTTP ${res.status}\n${text}`);
        return;
      }

      const created = normUser(await res.json());
      if (!created._id) {
        Alert.alert("Couldn’t add", "Server didn’t return a user id.");
        return;
      }

      // Add to local list, select them, clear search + form
      setUsers(prev => [created, ...prev]);
      setSelected(prev => new Set(prev).add(created._id));
      setQuery("");
      setNewName(""); setNewEmail(""); setNewPhone("");
    } catch (e) {
      Alert.alert("Network error", String(e?.message || e));
    }
  };

  const listBottomPad = actionH + (insets?.bottom ?? 0) + 12;
  const canCreate = selected.size >= 2;

  const renderItem = ({ item }) => {
    const picked = selected.has(item._id);
    const isOwner = ownersSet.has(item._id);
    return (
      <Pressable onPress={() => toggle(item._id)} style={[styles.row, picked && styles.rowActive]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>
            {item.name || item.email || item.phone || item._id.slice(0,6)}{isOwner ? " (Owner)" : ""}
          </Text>
          <Text style={styles.meta}>
            {item.email}{item.phone ? ` • ${item.phone}` : ""}
          </Text>
        </View>
        <Text style={styles.pick}>{picked ? "✓" : "+"}</Text>
      </Pressable>
    );
  };

  const selectedUsers = users.filter(u => selected.has(u._id));

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTxt}>New Thread</Text>
        <Text style={styles.sub}>Pick participants (✓). Subject is optional.</Text>
      </View>

      {/* Subject + Search + Reload */}
      <View style={{ padding: 12, gap: 8 }}>
        <TextInput
          style={styles.input}
          placeholder="Subject (optional)"
          placeholderTextColor="#9fb2d3"
          value={subject}
          onChangeText={setSubject}
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Search people (name, email, or phone)"
            placeholderTextColor="#9fb2d3"
            value={query}
            onChangeText={setQuery}
          />
          <Pressable onPress={loadUsers} style={[styles.quickBtn, styles.quickGhost]}>
            <Text style={styles.quickTxt}>{loadingUsers ? "…" : "Reload"}</Text>
          </Pressable>
        </View>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <Pressable onPress={selectOwners} style={[styles.quickBtn, styles.quickPrimary]}>
            <Text style={styles.quickTxt}>Select Owners</Text>
          </Pressable>
          <Pressable onPress={clearSelection} style={[styles.quickBtn, styles.quickGhost]}>
            <Text style={styles.quickTxt}>Clear</Text>
          </Pressable>
          <Text style={styles.countTxt}>{selected.size} selected</Text>
        </View>

        {/* Selected chips */}
        {selectedUsers.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {selectedUsers.map(u => (
              <Pressable key={u._id} onPress={() => removeChip(u._id)} style={styles.chip}>
                <Text style={styles.chipTxt}>{u.name || u.email || u.phone || u._id.slice(0,6)}</Text>
                <Text style={styles.chipX}>×</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Add new person UI when no matches */}
        {q.length > 0 && filtered.length === 0 && (
          <View style={styles.addCard}>
            <Text style={styles.addTitle}>Add new person</Text>
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor="#9fb2d3"
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#9fb2d3"
              autoCapitalize="none"
              keyboardType="email-address"
              value={newEmail}
              onChangeText={setNewEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone"
              placeholderTextColor="#9fb2d3"
              keyboardType="phone-pad"
              value={newPhone}
              onChangeText={setNewPhone}
            />
            <Pressable onPress={addNewPerson} style={[styles.btn, styles.btnOk]}>
              <Text style={styles.btnTxt}>Add & Select</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* People list */}
      <FlatList
        data={filtered}
        keyExtractor={(u) => String(u._id)}
        renderItem={renderItem}
        extraData={selected}
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: listBottomPad }}
      />

      {/* Pinned Create button */}
      <View
        onLayout={(e) => setActionH(e.nativeEvent.layout.height)}
        style={[styles.actionWrap, { paddingBottom: (insets?.bottom ?? 0) }]}
      >
        <Pressable
          onPress={create}
          disabled={!canCreate}
          style={[styles.btn, canCreate ? styles.btnOk : styles.btnDisabled]}
        >
          <Text style={styles.btnTxt}>Create</Text>
        </Pressable>
      </View>
    </SafeAreaView>
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
  sub: { color: "#9fb2d3", fontSize: 12, marginTop: 4 },

  input: {
    backgroundColor: "#16213a",
    color: "white",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },

  quickRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  quickBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  quickPrimary: { backgroundColor: "#2e5a9c" },
  quickGhost: { backgroundColor: "#1f2b45" },
  quickTxt: { color: "white", fontWeight: "700", fontSize: 12 },
  countTxt: { color: "#9fb2d3", marginLeft: "auto", fontSize: 12 },

  chipsRow: { gap: 8, paddingTop: 4 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: "#1f2b45",
  },
  chipTxt: { color: "white", fontSize: 12, fontWeight: "700" },
  chipX: { color: "#c9d7f2", fontSize: 12, opacity: 0.8 },

  addCard: {
    marginTop: 8,
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#0f1628",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#263045",
  },
  addTitle: { color: "white", fontSize: 14, fontWeight: "700" },

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
  rowActive: { borderColor: "#2e5a9c" },
  name: { color: "white", fontSize: 16, fontWeight: "700" },
  meta: { color: "#9fb2d3", fontSize: 12 },
  pick: { color: "white", fontSize: 18, width: 24, textAlign: "center" },

  actionWrap: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    backgroundColor: "#0f1628",
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#263045",
    paddingHorizontal: 12, paddingTop: 10,
    alignItems: "stretch",
  },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  btnOk: { backgroundColor: "#2e5a9c" },
  btnDisabled: { backgroundColor: "#263045" },
  btnTxt: { color: "white", fontWeight: "700" },
});
