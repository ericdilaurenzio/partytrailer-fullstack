const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const Event = require("../models/Event");

const DEFAULT_MINUTES = {
  booking: 24 * 60,
  customer_pickup: 120,
  customer_dropoff: 120,
  delivery: 120,
  pickup: 120
};

function withEnd(ev) {
  const start = new Date(ev.start);
  const mins  = DEFAULT_MINUTES[ev.type] ?? 120;
  const end   = ev.end ? new Date(ev.end) : new Date(start.getTime() + mins * 60 * 1000);
  return { ...ev, start, end };
}

(async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      console.error("MONGO_URI missing in .env");
      process.exit(1);
    }
    await mongoose.connect(uri);

    await Event.deleteMany({});
    const data = [
      {
        title: "Delivery - 20x40 + Tables",
        type: "delivery",
        start: new Date("2025-09-06T08:00:00-04:00"),
        customerName: "Smith Wedding",
        address: "123 Lakeview Rd, Litchfield, CT",
        items: [{ name: "20x40 High-Peak Tent", qty: 1 }, { name: "8ft Tables", qty: 18 }],
        assignedTo: ["Eric","Jessica"],
        status: "scheduled",
        createdBy: "Eric"
      },
      {
        title: "Pickup - Smith Wedding",
        type: "pickup",
        start: new Date("2025-09-07T09:00:00-04:00"),
        customerName: "Smith Wedding",
        address: "123 Lakeview Rd, Litchfield, CT",
        assignedTo: ["Stacey"],
        status: "planned",
        createdBy: "Eric"
      },
      {
        title: "Booking - Community Benefit",
        type: "booking",
        start: new Date("2025-09-13T12:00:00-04:00"),
        customerName: "Community Benefit",
        address: "Town Green, Watertown, CT",
        assignedTo: ["Eric","Stacey","Jessica"],
        status: "planned",
        createdBy: "Jessica"
      },
      {
        title: "Customer Pickup - 4x Tables",
        type: "customer_pickup",
        start: new Date("2025-09-08T10:00:00-04:00"),
        customerName: "Jones",
        address: "Warehouse",
        assignedTo: ["Eric"],
        status: "planned",
        createdBy: "Eric"
      },
      {
        title: "Customer Dropoff - 4x Tables",
        type: "customer_dropoff",
        start: new Date("2025-09-09T10:00:00-04:00"),
        customerName: "Jones",
        address: "Warehouse",
        assignedTo: ["Eric"],
        status: "planned",
        createdBy: "Eric"
      }
    ].map(withEnd);

    await Event.create(data);
    console.log("Seeded.");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
