require('dotenv').config();
const mongoose = require('mongoose');
const Thread = require('./models/Thread');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  let t = await Thread.findOneAndUpdate(
    { slug: 'general-support' },
    { slug: 'general-support', participants: ['admin:eric'] },
    { upsert: true, new: true }
  );
  console.log('Ensured thread:', t);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
