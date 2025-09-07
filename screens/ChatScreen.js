import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { GiftedChat } from "react-native-gifted-chat";
import io from "socket.io-client";
import { BACKEND_URL, CONVERSATION_ID, ADMIN_ID, CUSTOMER_ID } from "../lib/config";

// Map backend message -> GiftedChat format
const toGifted = (m) => ({
  _id: m._id || Math.random().toString(36).slice(2),
  text: m.body || "",
  createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
  user: {
    _id: m.senderId,
    name: m.senderId === ADMIN_ID ? "Admin" : "Customer",
  },
});

export default function ChatScreen() {
  // quick role toggle so you can test both sides
  const [role, setRole] = useState("customer"); // 'customer' | 'admin'
  const me = useMemo(() => (role === "admin" ? ADMIN_ID : CUSTOMER_ID), [role]);

  const [messages, setMessages] = useState([]);
  const socketRef = useRef(null);

  // Load history on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/conversations/${CONVERSATION_ID}/messages`);
        const data = await res.json();
        // GiftedChat expects newest first, so reverse
        const gifted = (data || []).map(toGifted).reverse();
        if (mounted) setMessages(gifted);
      } catch (e) {
        console.warn("Failed to load messages:", e?.message || e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Socket.IO join + live updates
  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ["websocket"], forceNew: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("joinConversation", CONVERSATION_ID);
    });

    socket.on("messageCreated", (msg) => {
      if (msg?.conversationId === CONVERSATION_ID) {
        setMessages((prev) => GiftedChat.append(prev, [toGifted(msg)]));
      }
    });

    return () => socket.disconnect();
  }, []);

  const onSend = useCallback(async (newMsgs = []) => {
    const first = newMsgs[0];
    if (!first?.text?.trim()) return;

    // optimistic append
    setMessages((prev) =>
      GiftedChat.append(prev, [{
        _id: `local-${Date.now()}`,
        text: first.text.trim(),
        createdAt: new Date(),
        user: { _id: me, name: me === ADMIN_ID ? "Admin" : "Customer" },
      }])
    );

    try {
      await fetch(`${BACKEND_URL}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: CONVERSATION_ID,
          senderId: me,
          body: first.text.trim(),
        }),
      });
      // Server will broadcast 'messageCreated' to all (including us)
    } catch (e) {
      console.warn("send error:", e?.message || e);
    }
  }, [me]);

  return (
    <View style={{ flex: 1, backgroundColor: "#0b1220" }}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <View style={styles.roleRow}>
          <Pressable
            onPress={() => setRole("customer")}
            style={[styles.roleBtn, role === "customer" && styles.roleActive]}
          >
            <Text style={styles.roleTxt}>As Customer</Text>
          </Pressable>
          <Pressable
            onPress={() => setRole("admin")}
            style={[styles.roleBtn, role === "admin" && styles.roleActive]}
          >
            <Text style={styles.roleTxt}>As Admin</Text>
          </Pressable>
        </View>
      </View>

      <GiftedChat
        messages={messages}
        onSend={onSend}
        user={{ _id: me, name: me === ADMIN_ID ? "Admin" : "Customer" }}
        renderAvatarOnTop
        alwaysShowSend
      />
    </View>
  );
