import { connectToDatabase } from './lib/mongo.js'
import { User, ServiceRequest, Notification, Vendor, PurchaseOrder, DeliverySchedule, GoodsReceipt, GateEntry } from './models.js'
import bcrypt from 'bcryptjs'

const campusUsers = [
  {
    name: 'Campus Admin',
    email: 'admin@msec.edu.in',
    password: '123',
    role: 'admin',
    department: 'ADMIN',
    phoneNumber: '+91-9876543201'
  },
  {
    name: 'Service Manager John',
    email: 'manager@msec.edu.in',
    password: '123',
    role: 'manager',
    department: 'MAINTENANCE',
    phoneNumber: '+91-9876543202'
  },
  {
    name: 'Technician Dave',
    email: 'tech@msec.edu.in',
    password: '123',
    role: 'technician',
    department: 'ELECTRICAL',
    phoneNumber: '+91-9876543203'
  },
  {
    name: 'Accounts Officer Sarah',
    email: 'accounts@msec.edu.in',
    password: '123',
    role: 'accounts',
    department: 'ACCOUNTS',
    phoneNumber: '+91-9876543204'
  },
  {
    name: 'Dr. Helen (Faculty Requester)',
    email: 'faculty@msec.edu.in',
    password: '123',
    role: 'requester',
    department: 'CSE',
    phoneNumber: '+91-9876543205'
  },
  {
    name: 'Super Admin',
    email: 'super@msec.edu.in',
    password: '123',
    role: 'super_admin',
    department: 'SYSTEM',
    phoneNumber: '+91-9876543200'
  },
  {
    name: 'Gate Security Guard',
    email: 'gate@msec.edu.in',
    password: '123',
    role: 'gate',
    department: 'SECURITY',
    phoneNumber: '+91-9876543206'
  },
  {
    name: 'Receiving Officer Kumar',
    email: 'receiving@msec.edu.in',
    password: '123',
    role: 'receiving_officer',
    department: 'STORES',
    phoneNumber: '+91-9876543207'
  }
]

const academicUsers = [
  // HODs for each department
  {
    name: 'Dr. Rajesh Kumar',
    email: 'hod.cse@msec.edu.in',
    password: '123',
    role: 'hod',
    department: 'CSE',
    phoneNumber: '+91-9876543210'
  },
  {
    name: 'Dr. Priya Sharma',
    email: 'hod.ece@msec.edu.in',
    password: '123',
    role: 'hod',
    department: 'ECE',
    phoneNumber: '+91-9876543211'
  },
  {
    name: 'Dr. Amit Patel',
    email: 'hod.mech@msec.edu.in',
    password: '123',
    role: 'hod',
    department: 'MECH',
    phoneNumber: '+91-9876543212'
  },
  {
    name: 'Dr. Sunita Reddy',
    email: 'hod.civil@msec.edu.in',
    password: '123',
    role: 'hod',
    department: 'CIVIL',
    phoneNumber: '+91-9876543213'
  },
  {
    name: 'Dr. Vikram Singh',
    email: 'hod.eee@msec.edu.in',
    password: '123',
    role: 'hod',
    department: 'EEE',
    phoneNumber: '+91-9876543214'
  },
  {
    name: 'Dr. Latha Narayanan',
    email: 'hod.hns@msec.edu.in',
    password: '123',
    role: 'hod',
    department: 'HNS',
    phoneNumber: '+91-9876543230'
  },
  
  // Staff members for CSE department
  {
    name: 'Prof. Anita Desai',
    email: 'anita.desai@msec.edu.in',
    password: '123',
    role: 'staff',
    department: 'CSE',
    class: 'A',
    phoneNumber: '+91-9876543215'
  },
  {
    name: 'Prof. Ramesh Gupta',
    email: 'ramesh.gupta@msec.edu.in',
    password: '123',
    role: 'staff',
    department: 'CSE',
    class: 'B',
    phoneNumber: '+91-9876543216'
  },
  
  // Staff members for ECE department
  {
    name: 'Prof. Meera Joshi',
    email: 'meera.joshi@msec.edu.in',
    password: '123',
    role: 'staff',
    department: 'ECE',
    class: 'A',
    phoneNumber: '+91-9876543217'
  },
  {
    name: 'Prof. Suresh Kumar',
    email: 'suresh.kumar@msec.edu.in',
    password: '123',
    role: 'staff',
    department: 'ECE',
    class: 'B',
    phoneNumber: '+91-9876543218'
  },
  
  // Staff members for MECH department
  {
    name: 'Prof. Kavitha Nair',
    email: 'kavitha.nair@msec.edu.in',
    password: '123',
    role: 'staff',
    department: 'MECH',
    class: 'A',
    phoneNumber: '+91-9876543219'
  },
  {
    name: 'Prof. Ravi Krishnan',
    email: 'ravi.krishnan@msec.edu.in',
    password: '123',
    role: 'staff',
    department: 'MECH',
    class: 'B',
    phoneNumber: '+91-9876543220'
  },
  
  // Staff members for CIVIL department
  {
    name: 'Prof. Deepa Mehta',
    email: 'deepa.mehta@msec.edu.in',
    password: '123',
    role: 'staff',
    department: 'CIVIL',
    class: 'A',
    phoneNumber: '+91-9876543221'
  },
  {
    name: 'Prof. Arun Verma',
    email: 'arun.verma@msec.edu.in',
    password: '123',
    role: 'staff',
    department: 'CIVIL',
    class: 'B',
    phoneNumber: '+91-9876543222'
  },
  
  // Staff members for EEE department
  {
    name: 'Prof. Lakshmi Pillai',
    email: 'lakshmi.pillai@msec.edu.in',
    password: '123',
    role: 'staff',
    department: 'EEE',
    class: 'A',
    phoneNumber: '+91-9876543223'
  },
  {
    name: 'Prof. Manoj Tiwari',
    email: 'manoj.tiwari@msec.edu.in',
    password: '123',
    role: 'staff',
    department: 'EEE',
    class: 'B',
    phoneNumber: '+91-9876543224'
  },
  {
    name: 'Prof. Maya Krishnan',
    email: 'maya.krishnan@msec.edu.in',
    password: '123',
    role: 'staff',
    department: 'HNS',
    class: 'A',
    phoneNumber: '+91-9876543231'
  },
  {
    name: 'Prof. S. Ramesh',
    email: 's.ramesh@msec.edu.in',
    password: '123',
    role: 'staff',
    department: 'HNS',
    class: 'B',
    phoneNumber: '+91-9876543232'
  }
]

async function seedAllUsers() {
  try {
    console.log('🔄 Connecting to database...')
    await connectToDatabase()
    
    console.log('🧹 Clearing all existing users and all other collections...')
    await User.deleteMany({})
    await ServiceRequest.deleteMany({})
    await Notification.deleteMany({})
    await Vendor.deleteMany({})
    await PurchaseOrder.deleteMany({})
    await DeliverySchedule.deleteMany({})
    await GoodsReceipt.deleteMany({})
    await GateEntry.deleteMany({})
    
    const allUsers = [...campusUsers, ...academicUsers]
    console.log(`🌱 Seeding ${allUsers.length} total demo users (Campus + Academic)...`)
    
    for (const userData of allUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 10)
      const user = new User({
        ...userData,
        password: hashedPassword
      })
      await user.save()
      console.log(`✅ Created [${userData.role.toUpperCase()}] ${userData.name} (${userData.email})`)
    }
    
    console.log('\n🎉 Successfully seeded all demo users with password: 123!')
    console.log('\n📧 CampusServe Credentials:')
    campusUsers.forEach(user => {
      console.log(`  Role: [${user.role.toUpperCase()}] Email: ${user.email}`)
    })
    
    console.log('\n📧 Academic Credentials:')
    academicUsers.forEach(user => {
      console.log(`  Role: [${user.role.toUpperCase()}] Email: ${user.email} (${user.department}${user.class ? ' - Class ' + user.class : ''})`)
    })
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding users:', error)
    process.exit(1)
  }
}

seedAllUsers()
