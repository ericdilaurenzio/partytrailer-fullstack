// mobile/lib/config.js
export const BACKEND_URL = "http://192.168.1.5:5000"; // your PC’s LAN IP

export const OWNERS = [
  { id: "68b5f3f3a4a7faf2b2dc11d5", name: "Eric" },
  { id: "68b61f6b32cf27e92dae96d1", name: "Stacey" },
  { id: "68b61f6b32cf27e92dae96d3", name: "Jessica" },
];

// Default “who I am” when the app first loads
export const DEFAULT_OWNER_INDEX = 0; // 0 = Eric

// If you still want a fallback conversation ID:
export const CONVERSATION_ID = "68b61fd332cf27e92dae96d5";
