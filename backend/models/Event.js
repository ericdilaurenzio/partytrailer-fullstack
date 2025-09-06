const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    type: {
      type: String,
      enum: ['booking','customer_pickup','customer_dropoff','delivery','pickup'],
      required: true
    },
    start: { type: Date, required: true },
    end:   { type: Date, required: true },
    allDay: { type: Boolean, default: false },

    customerName: String,
    booqableOrderId: String,
    address: String,
    items: [{ name: String, qty: Number }],

    assignedTo: [{ type: String, enum: ['Eric','Jessica','Stacey'] }],
    status: { type: String, enum: ['planned','scheduled','in_progress','done','canceled'], default: 'planned' },

    notes: String,
    color: String,
    createdBy: { type: String, enum: ['Eric','Jessica','Stacey'], required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Event', EventSchema);
