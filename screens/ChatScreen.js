import React, { useEffect, useRef, useState, useCallback } from "react";
import { GiftedChat } from "react-native-gifted-chat";
import io from "socket.io-client";

export default function ChatScreen({ threadId, user, backend }) {
  const [messages, setMessages] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    socketRef.current = io(backend, { transports: ["websocket"] });

    (async () => {
      try {
        const res = await fetch(`${backend}/api/messages/threads/${threadId}/messages`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const data = await res.json();
        if (isMounted) setMessages(mapToGifted((data || []).reverse()));
      } catch (e) {
        console.log("load messages error:", e?.message || e);
      }
    })();

    socketRef.current.on("message", (m) => {
      setMessages((prev) => GiftedChat.append(prev, mapToGifted([m])));
    });

    return () => { isMounted = false; socketRef.current?.disconnect(); };
  }, [backend, threadId]);

  const onSend = useCallback(
    async (msgs = []) => {
      const msg = msgs[0];
      if (!msg?.text?.trim()) return;
      try {
        const res = await fetch(`${backend}/api/messages/threads/${threadId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ senderId: user.uid, text: msg.text.trim() }),
        });
        const saved = await res.json();
        setMessages((prev) => GiftedChat.append(prev, mapToGifted([saved])));
        socketRef.current?.emit("sendMessage", { threadId, sender: user.uid, body: msg.text.trim() });
      } catch (e) {
        console.log("sendMessage error:", e?.message || e);
      }
    },
    [backend, threadId, user.uid]
  );

  return (
    <GiftedChat
      messages={messages}
      onSend={(msgs) => onSend(msgs)}
      user={{ _id: user.uid, name: user.name || user.uid }}
      renderAvatarOnTop
      alwaysShowSend
    />
  );
}

function mapToGifted(msgs) {
  return (msgs || []).map((m) => ({
    _id: m._id || Math.random().toString(36).slice(2),
    text: m.body,
    createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
    user: {
      _id: m.sender,
      name: String(m.sender || "").startsWith("admin:") ? "Admin" : m.sender,
    },
  }));
}
