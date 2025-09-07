import mongoose from "mongoose";
import logisticsSchema from "./logistics.schema.js";

const HoldSchema = new mongoose.Schema({
  customerName:  { type: String, required: true, trim: true },
  customerEmail: { type: String, default: "", trim: true },
  customerPhone: { type: String, default: "", trim: true },
  startAt:       { type: Date, required: true },
  endAt:         { type: Date, required: true },
  notes:         { type: String, default: "" },
  status:        { type: String, default: "tentative", enum: ["tentative"] },

  // NEW: logistics subdocument
  logistics: { type: logisticsSchema, default: {} },
}, { timestamps: true });

HoldSchema.index({ startAt: 1, endAt: 1 });
HoldSchema.index({ customerEmail: 1 });

export default mongoose.model("Hold", HoldSchema);
