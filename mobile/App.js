import "./screens-off"; // keep screens disabled
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView,
  Platform, TouchableWithoutFeedback, Keyboard, ActivityIndicator, ScrollView, Modal, Pressable,
  ToastAndroid, Alert
} from "react-native";
import "react-native-gesture-handler";
import DateTimePicker from '@react-native-community/datetimepicker';
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Calendar } from "react-native-calendars";
import io from "socket.io-client";
import dayjs from "dayjs";

// ===== Your backend (LAN IP) =====
const API_BASE = "http://192.168.1.5:5000";

const ADMINS = ["Eric","Jessica","Stacey"];
const DEFAULT_MINUTES = { booking: 1440, customer_pickup: 120, customer_dropoff: 120, delivery: 120, pickup: 120 };
const TYPE_LABELS = { booking:"Booking", customer_pickup:"Customer Pickup", customer_dropoff:"Customer Dropoff", delivery:"Delivery", pickup:"Pickup" };
const SAFE_BOTTOM = Platform.OS === "ios" ? 20 : 0;

function Chat({ currentUser }) {
  const [messages, setMessages] = useState([{ id:"1", text: "Hi " + currentUser + "!", user:"System", ts: Date.now() }]);
  const [text, setText] = useState("");
  const send = () => { if(!text.trim()) return; setMessages(p=>[{ id:String(Date.now()), text, user:currentUser, ts:Date.now() }, ...p]); setText(""); };

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:"#fff" }}>
      <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==="ios"?"padding":"height"}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex:1 }}>
            <FlatList inverted data={messages} keyExtractor={m=>m.id} renderItem={({item})=>(
              <View style={{ padding:12 }}>
                <View style={{ alignSelf:item.user===currentUser?"flex-end":"flex-start", backgroundColor:item.user===currentUser?"#0A84FF":"#E5E5EA", padding:10, borderRadius:16 }}>
                  <Text style={{ color:item.user===currentUser?"#fff":"#000" }}>{item.text}</Text>
                </View>
              </View>
            )}/>
            <View style={{ flexDirection:"row", padding:8, borderTopWidth:1, borderColor:"#e5e7eb" }}>
              <TextInput value={text} onChangeText={setText} placeholder="iMessage the team…" style={{ flex:1, backgroundColor:"#f3f4f6", borderRadius:20, paddingHorizontal:14, paddingVertical:10 }} onSubmitEditing={send} returnKeyType="send"/>
              <TouchableOpacity onPress={send} style={{ marginLeft:8, alignSelf:"center", paddingHorizontal:16, paddingVertical:10, backgroundColor:"#0A84FF", borderRadius:20 }}>
                <Text style={{ color:"#fff", fontWeight:"600" }}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function UserPicker({ onPicked }) {
  const [loading, setLoading] = useState(true);
  const pickedRef = useRef(false);
  useEffect(() => { (async () => { await AsyncStorage.removeItem("CURRENT_USER"); setLoading(false); })(); }, []);
  if (loading) return <SafeAreaView style={{ flex:1, justifyContent:"center", alignItems:"center", backgroundColor:"#fff" }}><ActivityIndicator/><Text style={{marginTop:8}}>Loading…</Text></SafeAreaView>;
  const pick = async (n) => { if(pickedRef.current) return; pickedRef.current = true; await AsyncStorage.setItem("CURRENT_USER", n); onPicked(n); };
  return (
    <SafeAreaView style={{ flex:1, backgroundColor:"#fff", padding:20 }}>
      <Text style={{ fontSize:22, fontWeight:"800", marginBottom:16 }}>Who are you?</Text>
      {ADMINS.map(n=>(
        <TouchableOpacity key={n} onPress={()=>pick(n)} style={{ padding:14, borderRadius:10, borderWidth:1, borderColor:"#0A84FF", backgroundColor:"#E6F0FF", marginBottom:12 }}>
          <Text style={{ color:"#0A84FF", fontWeight:"700" }}>{n}</Text>
        </TouchableOpacity>
      ))}
    </SafeAreaView>
  );
}

function CalendarLite({ currentUser }) {
  const [events, setEvents] = useState([]);
  const [selectedDay, setSelectedDay] = useState(dayjs().format("YYYY-MM-DD"));
  const [banner, setBanner] = useState("");
  const [adding, setAdding] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false); const [title, setTitle] = useState("");
  const [type, setType] = useState("booking");
  const [start, setStart] = useState(new Date());
  const [end, setEnd] = useState(new Date(Date.now() + DEFAULT_MINUTES.booking*60*1000));
  const [endEdited, setEndEdited] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [crew, setCrew] = useState([currentUser || "Eric"]);

  // Android-safe pickers (date then time)
  const [showStartDate, setShowStartDate] = useState(false);
  const [showStartTime, setShowStartTime] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [showEndTime, setShowEndTime] = useState(false);

  const socketRef = useRef(null);

  // LOCAL day key and helper to build a Date at a time on that day
  const dateKey = (d) => dayjs(d).format("YYYY-MM-DD");
  const dateFromKey = (key, hour = 9, minute = 0) => {
    const d = dayjs(key + " 00:00").toDate();
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  const typeColor = (t) =>
    t === "booking" ? "#2563eb" :
    t === "delivery" ? "#16a34a" :
    t === "pickup" ? "#a855f7" :
    t === "customer_pickup" ? "#0891b2" :
    t === "customer_dropoff" ? "#f59e0b" : "#6b7280";

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(API_BASE + "/api/events");
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch {}
  }, []);
  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    try {
      socketRef.current = io(API_BASE, { transports: ["websocket"] });
      const s = socketRef.current;
      s.on("event:created", (ev) => {
        setEvents(prev => [ev, ...prev]);
        const msg = "New " + (TYPE_LABELS[ev.type] || ev.type) + ": " + ev.title + " • " + dayjs(ev.start).format("ddd M/D h:mm A");
        setBanner(msg);
        if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.SHORT);
        setTimeout(() => setBanner(""), 3000);
      });
      s.on("event:updated", (ev) => setEvents(prev => prev.map(p => p._id === ev._id ? ev : p)));
      s.on("event:deleted", ({ _id }) => setEvents(prev => prev.filter(p => p._id !== _id)));
      return () => { s.disconnect(); };
    } catch {}
  }, []);

  const marked = useMemo(() => {
    const acc = {};
    for (const ev of events) {
      const k = dateKey(ev.start);
      acc[k] = acc[k] || { marked: true, dots: [], selected: false };
      acc[k].dots.push({ color: typeColor(ev.type) });
    }
    acc[selectedDay] = { ...(acc[selectedDay] || {}), selected: true, selectedColor: "#2563eb" };
    return acc;
  }, [events, selectedDay]);

  const visibleEvents = useMemo(() => {
    return events
      .filter(ev => dateKey(ev.start) === selectedDay)
      .sort((a,b)=> new Date(a.start) - new Date(b.start));
  }, [events, selectedDay]);

  useEffect(() => {
    if (!endEdited) {
      const mins = DEFAULT_MINUTES[type] ?? 120;
      setEnd(new Date(start.getTime() + mins*60*1000));
    }
  }, [type]); // only when type changes

  const showError = (msg) => {
    setBanner(msg);
    if (Platform.OS === "android") ToastAndroid.show(msg, ToastAndroid.LONG);
    else Alert.alert("Error", msg);
    setTimeout(()=>setBanner(""), 3500);
  };

  const saveEvent = async () => {
    if (!title.trim()) return showError("Title is required.");
    if (end <= start) return showError("End time must be after start time.");

    const payload = {
      title, type, start, end, customerName, address, notes,
      assignedTo: crew, status: "planned", createdBy: currentUser || "Eric"
    };

    try {
      const res = await fetch(API_BASE + "/api/events", {
        method: "POST", headers: { "Content-Type":"application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("HTTP " + res.status);

      let created = null;
      try { created = await res.json(); } catch {}

      const nowIso = new Date().toISOString();
      const optimistic = created || {
        _id: "local-" + Date.now(),
        title, type,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
        customerName, address, notes,
        assignedTo: crew, status: "planned", createdBy: currentUser || "Eric",
        createdAt: nowIso, updatedAt: nowIso, __v: 0
      };

      const day = dateKey(optimistic.start);
      setSelectedDay(day);
      setEvents(prev => [optimistic, ...prev]);

      fetchEvents && fetchEvents();

      setAdding(false);
      setTitle(""); setCustomerName(""); setAddress(""); setNotes("");
      setType("booking"); setCrew([currentUser || "Eric"]);
      const defaultEnd = new Date(Date.now() + (DEFAULT_MINUTES.booking*60*1000));
      setStart(new Date()); setEnd(defaultEnd); setEndEdited(false);

      const successMsg = "Saved: " + optimistic.title + " • " + dayjs(optimistic.start).format("ddd M/D h:mm A");
      setBanner(successMsg);
      if (Platform.OS === "android") ToastAndroid.show(successMsg, ToastAndroid.SHORT);
      setTimeout(()=>setBanner(""), 3000);
    } catch (e) {
      showError("Could not save. Check network and API_BASE/IP.");
    }
  };

  const setDatePart = (base, picked) => {
    const d = new Date(base);
    d.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
    return d;
  };
  const setTimePart = (base, picked) => {
    const d = new Date(base);
    d.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
    return d;
  };

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:"#fff" }}>
      {/* Top banner */}
      {banner ? (
        <View style={{ position:"absolute", top:10, left:10, right:10, backgroundColor:"#0A84FF", padding:12, borderRadius:12, zIndex:50 }}>
          <Text style={{ color:"#fff", fontWeight:"600" }}>{banner}</Text>
        </View>
      ) : null}

      <Calendar
        current={selectedDay}
        onDayPress={(d) => setSelectedDay(d.dateString)}
        markedDates={marked}
        markingType="multi-dot"
        theme={{
          todayTextColor: "#2563eb",
          selectedDayBackgroundColor: "#2563eb",
          dotColor: "#2563eb",
        }}
        enableSwipeMonths
      />

      <ScrollView contentContainerStyle={{ padding:16 }}>
        {visibleEvents.length === 0 ? (
          <Text style={{ color:"#9ca3af" }}>No events for this day.</Text>
        ) : (
          visibleEvents.map(item => (
            <View key={item._id} style={{ backgroundColor:"#fff", padding:12, borderRadius:12, borderWidth:1, borderColor:"#e5e7eb", marginBottom:10 }}>
              <View style={{ flexDirection:"row", alignItems:"center", marginBottom:6 }}>
                <View style={{ width:10, height:10, borderRadius:5, backgroundColor:typeColor(item.type), marginRight:8 }} />
                <Text style={{ fontWeight:"600" }}>{item.title}</Text>
              </View>
              <Text style={{ color:"#374151" }}>
                {dayjs(item.start).format("h:mm A")} – {dayjs(item.end).format("h:mm A")}
              </Text>
              {item.address ? <Text style={{ color:"#6b7280", marginTop:4 }}>{item.address}</Text> : null}
              {item.assignedTo?.length ? <Text style={{ color:"#6b7280", marginTop:4 }}>Crew: {item.assignedTo.join(", ")}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>

      {/* + button: prefill Start/End to selectedDay @ 9:00 AM */}
      <TouchableOpacity
        onPress={() => {
          const mins = DEFAULT_MINUTES[type] ?? 120;
          const s = dateFromKey(selectedDay, 9, 0);
          const e = new Date(s.getTime() + mins * 60 * 1000);
          setStart(s);
          setEnd(e);
          setEndEdited(false);
          setAdding(true);
        }}
        style={{ position:"absolute", right:20, bottom:20 + SAFE_BOTTOM, backgroundColor:"#0A84FF", borderRadius:30, paddingVertical:14, paddingHorizontal:18, shadowOpacity:0.2, shadowRadius:6 }}
      >
        <Text style={{ color:"#fff", fontSize:20, fontWeight:"700" }}>+</Text>
      </TouchableOpacity>

      {/* Add Event Modal */}
      <Modal visible={adding} animationType="slide" onRequestClose={() => setAdding(false)} transparent={false}>
        <SafeAreaView style={{ flex:1, backgroundColor:"#fff" }}>
          <View style={{ paddingHorizontal:16, paddingVertical:12, borderBottomWidth:1, borderColor:"#e5e7eb" }}>
            {banner ? (
              <View style={{ backgroundColor:"#0A84FF", padding:10, borderRadius:10, marginBottom:8 }}>
                <Text style={{ color:"#fff", fontWeight:"600" }}>{banner}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between" }}>
              <Text style={{ fontSize:18, fontWeight:"700" }}>New Event</Text>
              <Pressable onPress={() => setAdding(false)}><Text style={{ color:"#0A84FF", fontWeight:"600" }}>Cancel</Text></Pressable>
            </View>
          </View>

          <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <ScrollView contentContainerStyle={{ padding:16, paddingBottom: 24 + SAFE_BOTTOM }} keyboardDismissMode="on-drag">
                <Text style={{ fontWeight:"600", marginBottom:6 }}>Title</Text>
                <TextInput value={title} onChangeText={setTitle} placeholder="e.g., Delivery - 20x40 Tent" style={{ borderWidth:1, borderColor:"#e5e7eb", borderRadius:10, padding:10, marginBottom:14 }} />

                <Text style={{ fontWeight:"600", marginBottom:6 }}>Type</Text>
                <View style={{ flexDirection:"row", marginBottom:14, flexWrap:"wrap" }}>
                  {Object.keys(TYPE_LABELS).map(t => (
                    <Pressable key={t} onPress={() => setType(t)} style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:20, borderWidth:1, borderColor: type===t ? "#0A84FF" : "#e5e7eb", marginRight:8, marginBottom:8, backgroundColor: type===t ? "#E6F0FF" : "#fff" }}>
                      <Text style={{ color: type===t ? "#0A84FF" : "#111827" }}>{TYPE_LABELS[t]}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={{ fontWeight:"600", marginBottom:6 }}>Date</Text>
<Pressable
  onPress={() => setShowStartDate(true)}
  style={{ borderWidth:1, borderColor:"#e5e7eb", borderRadius:10, padding:10, marginBottom:14 }}
>
  <Text>{dayjs(start).format("YYYY-MM-DD")}</Text>
</Pressable>


<Text style={{ fontWeight:"600", marginBottom:6 }}>Start</Text>
                <Pressable onPress={() => setShowStartDate(true)} style={{ borderWidth:1, borderColor:"#e5e7eb", borderRadius:10, padding:10, marginBottom:10 }}>
                  <Text>{dayjs(start).format("ddd, MMM D, YYYY h:mm A")}</Text>
                </Pressable>
                {showStartDate && (
                  <DateTimePicker
                    value={start}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={(_, d) => {
                      setShowStartDate(false);
                      if (d) { const withDate = setDatePart(start, d); setStart(withDate); setShowStartTime(true); }
                    }}
                  />
                )}
                {showStartTime && (
                  <DateTimePicker
                    value={start}
                    mode="time"
                    display="default"
                    onChange={(_, d) => {
                      setShowStartTime(false);
                      if (d) {
                        const withTime = setTimePart(start, d);
                        setStart(withTime);
                        if (!endEdited) {
                          const mins = DEFAULT_MINUTES[type] ?? 120;
                          setEnd(new Date(withTime.getTime() + mins*60*1000));
                        }
                      }
                    }}
                  />
                )}

                {/* End: date then time */}
                <Text style={{ fontWeight:"600", marginBottom:6 }}>End</Text>
                <Pressable onPress={() => setShowEndDate(true)} style={{ borderWidth:1, borderColor:"#e5e7eb", borderRadius:10, padding:10, marginBottom:10 }}>
                  <Text>{dayjs(end).format("ddd, MMM D, YYYY h:mm A")}</Text>
                </Pressable>
                {showEndDate && (
                  <DateTimePicker
                    value={end}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={(_, d) => {
                      setShowEndDate(false);
                      if (d) { const withDate = setDatePart(end, d); setEnd(withDate); setShowEndTime(true); }
                    }}
                  />
                )}
                {showEndTime && (
                  <DateTimePicker
                    value={end}
                    mode="time"
                    display="default"
                    onChange={(_, d) => {
                      setShowEndTime(false);
                      if (d) { const withTime = setTimePart(end, d); setEnd(withTime); setEndEdited=true; }
                    }}
                  />
                )}

                <Text style={{ fontWeight:"600", marginBottom:6 }}>Customer / Event</Text>
                <TextInput value={customerName} onChangeText={setCustomerName} placeholder="Smith Wedding" style={{ borderWidth:1, borderColor:"#e5e7eb", borderRadius:10, padding:10, marginBottom:14 }} />

                <Text style={{ fontWeight:"600", marginBottom:6 }}>Address</Text>
                <TextInput value={address} onChangeText={setAddress} placeholder="123 Lakeview Rd, Litchfield, CT" style={{ borderWidth:1, borderColor:"#e5e7eb", borderRadius:10, padding:10, marginBottom:14 }} />

                <Text style={{ fontWeight:"600", marginBottom:6 }}>Crew</Text>
                <View style={{ flexDirection:"row", marginBottom:14, flexWrap:"wrap" }}>
                  {ADMINS.map(n => {
                    const on = crew.includes(n);
                    return (
                      <Pressable key={n} onPress={() => setCrew(c => c.includes(n) ? c.filter(x => x !== n) : [...c, n])} style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:20, borderWidth:1, borderColor: on ? "#0A84FF" : "#e5e7eb", marginRight:8, marginBottom:8, backgroundColor: on ? "#E6F0FF" : "#fff" }}>
                        <Text style={{ color: on ? "#0A84FF" : "#111827" }}>{n}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={{ fontWeight:"600", marginBottom:6 }}>Notes</Text>
                <TextInput value={notes} onChangeText={setNotes} placeholder="Gate code, staging notes, etc." multiline style={{ borderWidth:1, borderColor:"#e5e7eb", borderRadius:10, padding:10, minHeight:80 }} />

                <View style={{ height:20 }} />
                <TouchableOpacity onPress={saveEvent} style={{ backgroundColor:"#0A84FF", paddingVertical:14, borderRadius:12 }}>
                  <Text style={{ color:"#fff", fontWeight:"700", textAlign:"center" }}>Save Event</Text>
                </TouchableOpacity>
              </ScrollView>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const Tab = createBottomTabNavigator();

export default function App(){
  const [user, setUser] = useState(null);
  if (!user) return <UserPicker onPicked={setUser} />;
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerShown:false }}>
        <Tab.Screen name="Calendar">{() => <CalendarLite currentUser={user} />}</Tab.Screen>
        <Tab.Screen name="Chat">{() => <Chat currentUser={user} />}</Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}















