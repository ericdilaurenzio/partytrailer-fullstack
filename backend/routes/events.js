const express = require('express');
const Event = require('../models/Event');
const router = express.Router();

const MINUTE = 60 * 1000;
const DEFAULT_MINUTES = {
  booking: 24 * 60,          // 24h
  customer_pickup: 120,      // 2h
  customer_dropoff: 120,     // 2h
  delivery: 120,             // 2h
  pickup: 120                // 2h
};

function withDefaultEnd(payload) {
  const start = new Date(payload.start);
  let end = payload.end ? new Date(payload.end) : null;

  const type = payload.type;
  const mins = DEFAULT_MINUTES[type] ?? 120;

  // If no end OR end <= start, apply default duration
  if (!end || isNaN(end.getTime()) || end <= start) {
    end = new Date(start.getTime() + mins * MINUTE);
  }
  return { ...payload, start, end };
}

// GET /api/events?from=ISO&to=ISO
router.get('/', async (req, res) => {
  const { from, to } = req.query;
  const q = {};
  if (from || to) {
    q.$and = [];
    if (from) q.$and.push({ end:   { $gte: new Date(from) } });
    if (to)   q.$and.push({ start: { $lte: new Date(to)   } });
    if (!q.$and.length) delete q.$and;
  }
  const events = await Event.find(q).sort({ start: 1 }).lean();
  res.json(events);
});

// POST /api/events
router.post('/', async (req, res) => {
  const payload = withDefaultEnd(req.body);
  const ev = await Event.create(payload);
  req.io?.emit('event:created', ev);  // broadcast to all clients
  res.status(201).json(ev);
});

// PATCH /api/events/:id
router.patch('/:id', async (req, res) => {
  const updated = withDefaultEnd(req.body);
  const ev = await Event.findByIdAndUpdate(req.params.id, updated, { new: true });
  if (!ev) return res.status(404).json({ error: 'Not found' });
  req.io?.emit('event:updated', ev);
  res.json(ev);
});

// DELETE /api/events/:id
router.delete('/:id', async (req, res) => {
  const ev = await Event.findByIdAndDelete(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Not found' });
  req.io?.emit('event:deleted', { _id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
