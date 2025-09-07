import mongoose from "mongoose";

const ReservationSchema = new mongoose.Schema({
  externalSystem: { type: String, default: "booqable", index: true },
  externalId: { type: String, index: true, unique: true, sparse: true },
  status: { type: String, default: "pending" },
  customer: {
    name: String, email: String, phone: String, externalCustomerId: String
  },
  items: [{
    booqableId: String,
    inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem" },
    name: String, qty: Number
  }],
  startAt: Date, endAt: Date,
  delivery: { address: String, notes: String },
  totals: { subtotal: Number, tax: Number, delivery: Number, securityDeposit: Number, grandTotal: Number },
  payment: { required: { type: Boolean, default: true }, collected: { type: Number, default: 0 }, currency: { type: String, default: "USD" }, linkUrl: String, stripeCheckoutId: String },
  notes: String,
  lastSyncedAt: Date
}, { timestamps: true });

export default mongoose.model("Reservation", ReservationSchema);