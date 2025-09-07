// must be first – harmless polyfill to avoid lowercase `formdata` crashes
import "./polyfills";

import React, { useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { View, Text, Button, ActivityIndicator } from "react-native";
import ChatScreen from "./screens/ChatScreen";

const Stack = createNativeStackNavigator();
const BACKEND = "https://partytrailer-fullstack.onrender.com";
const currentUser = { uid: "cus_demo123", role: "customer", name: "Demo Customer" };

export default function App() {
  const [threadId, setThreadId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createThread() {
    setBusy(true); setError("");
    try {
      const res = await fetch(`${BACKEND}/api/messages/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants: [currentUser.uid, "admin:eric"] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const thread = await res.json();
      setThreadId(thread._id);
    } catch (e) {
      setError(`Could not create thread: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!threadId ? (
          <Stack.Screen name="Home" options={{ title: "PartyTrailer Chat" }}>
            {() => (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 }}>
                <Text style={{ fontSize: 16 }}>Backend:</Text>
                <Text selectable style={{ textAlign: "center" }}>{BACKEND}</Text>
                {error ? <Text style={{ color: "red" }}>{error}</Text> : null}
                {busy ? <ActivityIndicator size="large" /> : <Button title="Create / Open Chat with Admin" onPress={createThread} />}
              </View>
            )}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Chat" options={{ title: "Chat" }}>
            {() => (<ChatScreen threadId={threadId} user={currentUser} backend={BACKEND} />)}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
