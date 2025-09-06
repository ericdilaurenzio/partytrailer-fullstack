// mobile/lib/api.js
import { BACKEND_URL, CONVERSATION_ID } from "./config";

export async function getMessages() {
  const res = await fetch(`${BACKEND_URL}/api/conversations/${CONVERSATION_ID}/messages`);
  if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);
  return res.json();
}

export async function postMessage({ senderId, body }) {
  const res = await fetch(`${BACKEND_URL}/api/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversationId: CONVERSATION_ID,
      senderId,
      body,
    }),
  });
  if (!res.ok) throw new Error(`Failed to send message: ${res.status}`);
  return res.json();
}
