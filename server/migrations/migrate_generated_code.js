require('dotenv').config()
const mongoose = require('mongoose')
const Room = require('../models/Room')

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codeconnect'

async function migrate() {
  await mongoose.connect(MONGO_URI)
  console.log('Connected to MongoDB for migration')
  const rooms = await Room.find({}).lean()
  for (const r of rooms) {
    if (r.generatedCode && !r.generatedCodes) {
      console.log('Migrating room', r.roomId)
      const generatedCodesArray = [{ language: r.generatedCode.language || 'unknown', generated_codes: r.generatedCode.code ? { default: r.generatedCode.code } : {}, generatedAt: r.generatedCode.generatedAt || new Date() }]
      await Room.updateOne({ _id: r._id }, { $set: { generatedCodes: generatedCodesArray }, $unset: { generatedCode: "" } })
      console.log('Migrated', r.roomId)
    }
  }
  console.log('Migration complete')
  process.exit(0)
}

migrate().catch(err => {
  console.error('Migration failed', err)
  process.exit(1)
})
