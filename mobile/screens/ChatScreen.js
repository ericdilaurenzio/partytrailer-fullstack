// mobile/screens/ChatScreen.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet,
} from "react-native";
import io from "socket.io-client";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BACKEND_URL, OWNERS, DEFAULT_OWNER_INDEX } from "../lib/config";

/* helpers */
function toISO(input){ try{ if(typeof input==="string"){ const d=new Date(input); if(!Number.isNaN(d.getTime())) return d.toISOString(); } else if(input instanceof Date){ return input.toISOString(); } }catch{} return new Date().toISOString(); }
function sanitizeMessage(raw, idx=0){
  const rawId = raw?._id ?? raw?.id ?? `fallback-${idx}-${Date.now()}`;
  const body = typeof raw?.body === "string" ? raw.body : String(raw?.body ?? "");
  const senderId = raw?.senderId ?? raw?.sender ?? "unknown";
  const createdAt = toISO(raw?.createdAt);
  const reads = Array.isArray(raw?.reads) ? raw.reads.map(r => ({ userId: String(r.userId), at: toISO(r.at) })) : [];
  return { _id:String(rawId), body:String(body), senderId:String(senderId), createdAt:String(createdAt), reads };
}
function safeTimeLabel(iso){ try{ const d=new Date(iso); if(Number.isNaN(d.getTime())) return ""; return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}`; }catch{ return ""; } }
/* /helpers */

export default function ChatScreen({ conversationId }) {
  const insets = useSafeAreaInsets();
  const [ownerIndex, setOwnerIndex] = useState(DEFAULT_OWNER_INDEX);
  const me = useMemo(() => OWNERS[Math.max(0, Math.min(ownerIndex, OWNERS.length-1))]?.id, [ownerIndex]);
  const nameOf = useCallback((id)=> OWNERS.find(o=>o.id===id)?.name ?? id?.slice(0,6), []);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [connecting, setConnecting] = useState(true);
  const scrollRef = useRef(null);
  const [composerH, setComposerH] = useState(60);

  // If no conversation chosen, show a friendly placeholder
  if (!conversationId) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Chat</Text>
          <Text style={styles.sub}>Pick a thread from the Threads tab to start chatting.</Text>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#9fb2d3" }}>No conversation selected.</Text>
        </View>
      </SafeAreaView>
    );
  }

  /* load history + mark read */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/conversations/${conversationId}/messages`);
        const data = (await res.json()) || [];
        const safe = data.map((m, i) => sanitizeMessage(m, i));
        if (mounted) setMessages(Array.isArray(safe) ? safe : []);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 0);

        // per-user mark read
        await fetch(`${BACKEND_URL}/api/conversations/${conversationId}/read`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ viewerId: me }),
        });
      } catch {
        if (mounted) setMessages([]);
      }
    })();
    return () => { mounted = false; };
  }, [conversationId, me]);

  /* live updates */
  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ["websocket"], forceNew: true });
    socket.on("connect", () => { setConnecting(false); socket.emit("joinConversation", conversationId); });
    socket.on("messageCreated", (msg) => {
      if (String(msg?.conversationId) === String(conversationId)) {
        setMessages((prev) => {
          const safe = sanitizeMessage(msg, prev.length);
          return [...(Array.isArray(prev) ? prev : []), safe];
        });
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 0);
      }
    });
    socket.on("disconnect", () => setConnecting(true));
    return () => socket.disconnect();
  }, [conversationId]);

  const send = useCallback(async () => {
    const trimmed = String(text ?? "").trim();
    if (!trimmed) return;
    setText("");

    setMessages((prev) => {
      const local = sanitizeMessage(
        { _id: `local-${Date.now()}`, body: trimmed, senderId: me, createdAt: new Date().toISOString(), reads: [] },
        Array.isArray(prev) ? prev.length : 0
      );
      return [...(Array.isArray(prev) ? prev : []), local];
    });
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 0);

    try {
      await fetch(`${BACKEND_URL}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, senderId: me, body: trimmed }),
      });
    } catch {}
  }, [me, text, conversationId]);

  const bottomPad = composerH + (insets?.bottom ?? 0) + 8;

  return (
    <SafeAreaView style={[styles.safe, { paddingBottom: 0 }]} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Chat</Text>
          <View style={styles.roleRow}>
            {OWNERS.map((o, i) => (
              <Pressable key={o.id} onPress={() => setOwnerIndex(i)} style={[styles.roleBtn, ownerIndex === i && styles.roleActive]}>
                <Text style={styles.roleTxt}>As {o.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.sub}>{connecting ? "Connecting…" : "Live"}</Text>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: bottomPad }}
          keyboardShouldPersistTaps="handled"
        >
          {(Array.isArray(messages) ? messages : []).map((m, idx) => {
            const item = sanitizeMessage(m, idx);
            const mine = item.senderId === String(me);
            const key = String(item._id ?? `k-${idx}`);

            // "everyone read" check among the other owners
            const others = OWNERS.map(o => o.id).filter(id => id !== String(me));
            const readBy = new Set((item.reads || []).map(r => r.userId));
            const allRead = others.every(id => readBy.has(id));

            return (
              <View key={key} style={[styles.row, mine ? styles.right : styles.left]}>
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  {!mine && <Text style={[styles.meta, { marginBottom: 2 }]}>{nameOf(item.senderId)}</Text>}
                  <Text style={styles.body}>{item.body}</Text>
                  <Text style={styles.meta}>
                    {safeTimeLabel(item.createdAt)} {mine && (allRead ? "✓✓" : "✓")}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View onLayout={(e) => setComposerH(e.nativeEvent.layout.height)} style={[styles.composerWrap, { paddingBottom: (insets?.bottom ?? 0) }]}>
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              placeholder={`Message as ${nameOf(me)}`}
              placeholderTextColor="#9fb2d3"
              value={text}
              onChangeText={setText}
              onSubmitEditing={send}
              returnKeyType="send"
            />
            <Pressable style={styles.sendBtn} onPress={send}>
              <Text style={styles.sendTxt}>Send</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: "#0b1220" },
  header: { padding: 12, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#263045", backgroundColor: "#0f1628" },
  title: { color: "white", fontSize: 18, fontWeight: "700" },
  sub: { color: "#9fb2d3", fontSize: 12 },
  roleRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  roleBtn: { backgroundColor: "#1f2b45", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginTop: 4 },
  roleActive: { backgroundColor: "#28406d" },
  roleTxt: { color: "white", fontSize: 12, fontWeight: "600" },
  row: { flexDirection: "row" },
  left: { justifyContent: "flex-start" },
  right: { justifyContent: "flex-end" },
  bubble: { maxWidth: "80%", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, gap: 6 },
  mine: { backgroundColor: "#2e5a9c" },
  theirs: { backgroundColor: "#1f2b45" },
  body: { color: "white", fontSize: 14 },
  meta: { color: "#c9d7f2", fontSize: 10, opacity: 0.8, textAlign: "right" },
  composerWrap: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#0f1628", borderTopWidth: StyleSheet.hairlineWidth, borderColor: "#263045" },
  composer: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingTop: 10 },
  input: { flex: 1, backgroundColor: "#16213a", color: "white", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  sendBtn: { backgroundColor: "#2e5a9c", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  sendTxt: { color: "white", fontWeight: "700" },
});
