// seeders/seedDatabase.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Notice = require('../models/Notice');
const Comment = require('../models/Comment');

dotenv.config();

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scnbcp');
    console.log('✅ MongoDB Connected');

    // Clear existing data
    await User.deleteMany({});
    await Notice.deleteMany({});
    await Comment.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create Admin User
    const admin = await User.create({
      name: 'Dr. Rajesh Kumar',
      email: 'admin@vignan.edu',
      password: 'admin123',
      role: 'admin',
      employeeId: 'ADM001',
      department: 'Administration'
    });
    console.log('✅ Admin created');

    // Create Faculty Users
    const faculty1 = await User.create({
      name: 'Prof. Sarah Johnson',
      email: 'sarah.johnson@vignan.edu',
      password: 'faculty123',
      role: 'faculty',
      department: 'CSE',
      employeeId: 'FAC001'
    });

    const faculty2 = await User.create({
      name: 'Dr. Amit Patel',
      email: 'amit.patel@vignan.edu',
      password: 'faculty123',
      role: 'faculty',
      department: 'ECE',
      employeeId: 'FAC002'
    });

    const faculty3 = await User.create({
      name: 'Prof. Meera Singh',
      email: 'meera.singh@vignan.edu',
      password: 'faculty123',
      role: 'faculty',
      department: 'IT',
      employeeId: 'FAC003'
    });
    console.log('✅ Faculty created');

    // Create Student Users
    const students = await User.create([
      {
        name: 'Rahul Sharma',
        email: 'rahul.sharma@student.vignan.edu',
        password: 'student123',
        role: 'student',
        department: 'CSE',
        year: '3rd Year',
        studentId: 'CSE2021001'
      },
      {
        name: 'Priya Reddy',
        email: 'priya.reddy@student.vignan.edu',
        password: 'student123',
        role: 'student',
        department: 'CSE',
        year: '3rd Year',
        studentId: 'CSE2021002'
      },
      {
        name: 'Arjun Krishnan',
        email: 'arjun.k@student.vignan.edu',
        password: 'student123',
        role: 'student',
        department: 'ECE',
        year: '2nd Year',
        studentId: 'ECE2022001'
      },
      {
        name: 'Sneha Gupta',
        email: 'sneha.gupta@student.vignan.edu',
        password: 'student123',
        role: 'student',
        department: 'IT',
        year: '4th Year',
        studentId: 'IT2020001'
      }
    ]);
    console.log('✅ Students created');

    // Create Sample Notices
    const notice1 = await Notice.create({
      title: 'Mid-Term Examination Schedule - December 2024',
      content: 'The mid-term examinations for all departments will commence from December 15th, 2024. Students are advised to check their respective department notice boards for detailed timetables. Hall tickets will be available from December 10th.',
      category: 'exams',
      department: 'All Departments',
      author: admin._id,
      priority: 'high',
      status: 'published',
      views: [
        { user: students[0]._id },
        { user: students[1]._id },
        { user: students[2]._id }
      ],
      acknowledged: [
        { user: students[0]._id },
        { user: students[1]._id }
      ]
    });

    const notice2 = await Notice.create({
      title: 'Annual Tech Fest 2024 - Call for Participation',
      content: 'We are excited to announce our Annual Tech Fest "TechVignan 2024" scheduled for January 20-22, 2025. Students are encouraged to participate in various technical events, workshops, and competitions.',
      category: 'events',
      department: 'CSE',
      targetYear: '3rd Year',
      author: faculty1._id,
      priority: 'medium',
      status: 'published',
      views: [
        { user: students[0]._id },
        { user: students[1]._id }
      ]
    });

    const notice3 = await Notice.create({
      title: 'Workshop on Artificial Intelligence and Machine Learning',
      content: 'A two-day intensive workshop on AI/ML will be conducted on December 10-11, 2024. Industry experts from leading tech companies will be conducting hands-on sessions.',
      category: 'academic',
      department: 'CSE',
      author: faculty1._id,
      priority: 'high',
      status: 'published',
      views: [{ user: students[0]._id }],
      acknowledged: [{ user: students[0]._id }]
    });

    const notice4 = await Notice.create({
      title: 'Library Hours Extended During Exam Week',
      content: 'The central library will remain open from 7:00 AM to 11:00 PM during the examination week (Dec 15-25). Students can utilize the extended hours for preparation.',
      category: 'circulars',
      department: 'All Departments',
      author: admin._id,
      priority: 'medium',
      status: 'published'
    });

    const notice5 = await Notice.create({
      title: 'Placement Drive - TCS On-Campus Recruitment',
      content: 'TCS will be conducting an on-campus recruitment drive on December 18-19, 2024. Eligible students (final year, all branches) must register by December 12th.',
      category: 'events',
      department: 'All Departments',
      targetYear: '4th Year',
      author: admin._id,
      priority: 'high',
      status: 'published',
      views: [{ user: students[3]._id }],
      acknowledged: [{ user: students[3]._id }]
    });

    console.log('✅ Notices created');

    // Create Sample Comments
    await Comment.create([
      {
        notice: notice2._id,
        author: students[0]._id,
        content: 'This sounds exciting! Can we get more details about the events?'
      },
      {
        notice: notice2._id,
        author: faculty1._id,
        content: 'Detailed event schedule will be shared next week. Stay tuned!'
      },
      {
        notice: notice3._id,
        author: students[1]._id,
        content: 'Is registration open for all years or only 3rd year?'
      },
      {
        notice: notice3._id,
        author: faculty1._id,
        content: 'Registration is open for 2nd, 3rd, and 4th year students.'
      }
    ]);
    console.log('✅ Comments created');

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📝 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Admin:');
    console.log('  Email: admin@vignan.edu');
    console.log('  Password: admin123');
    console.log('\nFaculty (CSE):');
    console.log('  Email: sarah.johnson@vignan.edu');
    console.log('  Password: faculty123');
    console.log('\nFaculty (ECE):');
    console.log('  Email: amit.patel@vignan.edu');
    console.log('  Password: faculty123');
    console.log('\nFaculty (IT):');
    console.log('  Email: meera.singh@vignan.edu');
    console.log('  Password: faculty123');
    console.log('\nStudent (CSE):');
    console.log('  Email: rahul.sharma@student.vignan.edu');
    console.log('  Password: student123');
    console.log('\nStudent (ECE):');
    console.log('  Email: arjun.k@student.vignan.edu');
    console.log('  Password: student123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Error:', error);
    process.exit(1);
  }
};

seedDatabase();
