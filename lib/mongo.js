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
  cached = global.mongoose = { conn: null, promise: null, indexesPromise: null }
}

async function ensureOperationalIndexes(connection) {
  if (!cached.indexesPromise) {
    cached.indexesPromise = Promise.all([
      connection.connection.db.collection('notifications').createIndex(
        { userEmail: 1, read: 1, createdAt: -1 },
        { name: 'notifications_user_read_created' }
      ),
      connection.connection.db.collection('push_subscriptions').createIndex(
        { 'subscription.endpoint': 1 },
        { name: 'push_subscription_endpoint' }
      ),
      connection.connection.db.collection('servicerequests').createIndex(
        { assignedManagerId: 1, createdAt: -1 },
        { name: 'requests_manager_created' }
      ),
      connection.connection.db.collection('servicerequests').createIndex(
        { requesterId: 1, createdAt: -1 },
        { name: 'requests_requester_created' }
      ),
      connection.connection.db.collection('servicerequests').createIndex(
        { status: 1, createdAt: -1 },
        { name: 'requests_status_created' }
      ),
      connection.connection.db.collection('vendorquotations').createIndex(
        { assignedManagerId: 1, createdAt: -1 },
        { name: 'quotations_manager_created' }
      ),
      connection.connection.db.collection('purchaseorders').createIndex(
        { status: 1, createdAt: -1 },
        { name: 'purchase_orders_status_created' }
      ),
      connection.connection.db.collection('purchaseorders').createIndex(
        { vendorId: 1, createdAt: -1 },
        { name: 'purchase_orders_vendor_created' }
      ),
      connection.connection.db.collection('purchaseorders').createIndex(
        { requestId: 1, createdAt: -1 },
        { name: 'purchase_orders_request_created' }
      ),
      connection.connection.db.collection('goodsreceipts').createIndex(
        { grnType: 1, source: 1, poId: 1 },
        { name: 'goods_receipts_qr_final_po' }
      ),
      connection.connection.db.collection('goodsreceipts').createIndex(
        { source: 1, receivedAt: -1 },
        { name: 'goods_receipts_source_received' }
      ),
      connection.connection.db.collection('gateentries').createIndex(
        { decision: 1, entryTime: -1 },
        { name: 'gate_entries_decision_time' }
      ),
      connection.connection.db.collection('deliveryschedules').createIndex(
        { status: 1, scheduledDate: -1 },
        { name: 'deliveries_status_scheduled' }
      )
    ]).catch((error) => {
      // Index creation should not prevent the API from starting. Requests still
      // work without the indexes, although notification lookups may be slower.
      console.warn('⚠️ Could not ensure operational indexes:', error.message)
    })
  }
  await cached.indexesPromise
}

export async function connectToDatabase() {
  if (cached.conn) {
    await ensureOperationalIndexes(cached.conn)
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
    await ensureOperationalIndexes(cached.conn)
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}
