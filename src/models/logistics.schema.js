import mongoose from "mongoose";

/**
 * Reusable sub-schema for delivery/pickup logistics.
 * Use as: schema.add({ logistics: logisticsSchema })
 */
const logisticsSchema = new mongoose.Schema({
  deliveryType: {
    type: String,
    enum: ["pickup", "delivery", "customer_dropoff"],
    default: "pickup",
  },
  address: { type: String, trim: true },        // required only for delivery
  windowStart: { type: Date },                   // optional scheduling window
  windowEnd: { type: Date },
  miles: { type: Number, min: 0 },               // computed or entered
  deliveryFee: { type: Number, min: 0, default: 0 }, // computed from miles
}, { _id: false }); // embed, no _id

export default logisticsSchema;
