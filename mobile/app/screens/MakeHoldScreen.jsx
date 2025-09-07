import React, { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, Platform } from "react-native";

/**
 * MakeHoldScreen
 * Minimal form to create a tentative HOLD (local-only).
 * POST -> /api/holds  { customerName, startAt, endAt, notes }
 */
export default function MakeHoldScreen({ onDone }) {
  const API_BASE = useMemo(() => "https://ea-being-toys-harmony.trycloudflare.com", []);

  const [customerName, setCustomerName] = useState("");
  const [startISO, setStartISO] = useState("");   // e.g. 2025-09-15T14:00:00Z
  const [endISO, setEndISO]     = useState("");   // e.g. 2025-09-15T18:00:00Z
  const [notes, setNotes]       = useState("");
  const [busy, setBusy]         = useState(false);

  const submit = async () => {
    if (!customerName || !startISO || !endISO) {
      Alert.alert("Missing info", "Customer name, start and end are required (ISO, e.g. 2025-09-15T14:00:00Z).");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/holds`, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          customerName,
          startAt: startISO,
          endAt: endISO,
          notes
        })
      });
      const txt = await r.text();
      let j; try { j = JSON.parse(txt); } catch { j = { raw: txt }; }
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Failed to create hold");
      }
      Alert.alert("Hold created", "Your tentative hold is on the calendar feed.");
      if (onDone) onDone();
      // Reset
      setCustomerName(""); setStartISO(""); setEndISO(""); setNotes("");
    } catch (e) {
      Alert.alert("Error", e?.message || "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = { backgroundColor:"#111827", color:"white", borderRadius:10, padding:12, marginBottom:12, borderWidth:1, borderColor:"#1f2937" };

  return (
    <View style={{ flex:1, padding:16, backgroundColor:"#0B0C10" }}>
      <Text style={{ color:"white", fontSize:20, fontWeight:"700", marginBottom:12 }}>Make Tentative Hold</Text>

      <Text style={{ color:"#9aa0a6", marginBottom:6 }}>Customer name</Text>
      <TextInput
        value={customerName}
        onChangeText={setCustomerName}
        placeholder="e.g. Jane Smith (Tentative)"
        placeholderTextColor="#6b7280"
        style={inputStyle}
        autoCapitalize="words"
      />

      <Text style={{ color:"#9aa0a6", marginBottom:6 }}>Start (ISO 8601 UTC)</Text>
      <TextInput
        value={startISO}
        onChangeText={setStartISO}
        placeholder="2025-09-15T14:00:00Z"
        placeholderTextColor="#6b7280"
        style={inputStyle}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={{ color:"#9aa0a6", marginBottom:6 }}>End (ISO 8601 UTC)</Text>
      <TextInput
        value={endISO}
        onChangeText={setEndISO}
        placeholder="2025-09-15T18:00:00Z"
        placeholderTextColor="#6b7280"
        style={inputStyle}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={{ color:"#9aa0a6", marginBottom:6 }}>Notes (optional)</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Any notes…"
        placeholderTextColor="#6b7280"
        style={[inputStyle, { minHeight:90, textAlignVertical:"top" }]}
        multiline
      />

      <TouchableOpacity
        onPress={submit}
        disabled={busy}
        style={{ padding:16, borderRadius:12, backgroundColor: busy ? "#334155" : "#22c55e", marginTop:4 }}
      >
        <Text style={{ color:"white", fontSize:16, textAlign:"center" }}>
          {busy ? "Saving…" : "Create Hold"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
