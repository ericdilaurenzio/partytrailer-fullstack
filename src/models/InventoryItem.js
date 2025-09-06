import mongoose from "mongoose";

const InventoryItemSchema = new mongoose.Schema({
  booqableId: { type: String, index: true, unique: true, sparse: true },
  name: String,
  sku: String,
  category: String,
  stockCount: { type: Number, default: 0 },
  attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
  images: [String],
  active: { type: Boolean, default: true },
  lastSyncedAt: Date
}, { timestamps: true });

export default mongoose.model("InventoryItem", InventoryItemSchema);