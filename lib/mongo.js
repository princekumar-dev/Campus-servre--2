import mongoose from 'mongoose'
import dotenv from 'dotenv'
import dns from 'dns'

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1'])

// Load environment variables
dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI || 
  process.env.MONGO_URI || 
  process.env.MONGODB_URL || 
  null

console.log('🔗 MongoDB URI:', MONGODB_URI ? MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') : 'NOT SET')

if (!MONGODB_URI || MONGODB_URI.includes('undefined')) {
  console.error('lib/mongo.js: No valid MONGODB_URI found. Set MONGODB_URI in your .env file.')
}

// Use a global variable to cache the connection in serverless environments
let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 20, // Increased for better concurrency
      minPoolSize: 5,  // Maintain minimum connections
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4
      retryWrites: true,
      retryReads: true
    }

    console.log('🔄 Attempting to connect to MongoDB...')
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('✅ Successfully connected to MongoDB')
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}
