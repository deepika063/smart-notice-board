# SCNBCP Backend API

Smart College Notice Board & Communication Portal - Backend Server (MERN Stack)

## 🚀 Features

- **User Authentication**: JWT-based authentication with role-based access control
- **Role Management**: Admin, Faculty, and Student roles with different permissions
- **Notice Management**: CRUD operations for notices with scheduling and targeting
- **Real-time Updates**: Socket.io for live notifications
- **Comments System**: Discussion threads on notices with privacy controls
- **Analytics Dashboard**: Engagement metrics and statistics
- **File Attachments**: Support for document uploads
- **Search & Filter**: Advanced filtering by category, department, date, etc.

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## 🛠️ Installation

1. **Clone or navigate to the backend directory**

```bash
cd backend-code
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

```bash
cp .env.example .env
```

Edit `.env` file with your configuration:
- Set your MongoDB connection string
- Change JWT_SECRET to a secure random string
- Configure other settings as needed

4. **Start MongoDB**

Make sure MongoDB is running on your system:
```bash
# On macOS/Linux
sudo systemctl start mongod

# On Windows
net start MongoDB
```

## 🌱 Seed Database

Populate the database with sample data:

```bash
npm run seed
```

This will create:
- 1 Admin user
- 3 Faculty users
- 4 Student users
- 5 Sample notices
- Sample comments

**Default Login Credentials** (created by seeder):

**Admin:**
- Email: `admin@vignan.edu`
- Password: `admin123`

**Faculty (CSE):**
- Email: `sarah.johnson@vignan.edu`
- Password: `faculty123`

**Faculty (ECE):**
- Email: `amit.patel@vignan.edu`
- Password: `faculty123`

**Faculty (IT):**
- Email: `meera.singh@vignan.edu`
- Password: `faculty123`

**Student (CSE):**
- Email: `rahul.sharma@student.vignan.edu`
- Password: `student123`

**Student (ECE):**
- Email: `arjun.k@student.vignan.edu`
- Password: `student123`

## 🏃 Running the Server

**Development mode (with auto-restart):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:5000`

## 📡 API Endpoints

### Authentication (`/api/auth`)

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)
- `PUT /api/auth/change-password` - Change password (requires auth)
- `POST /api/auth/logout` - Logout user

### Notices (`/api/notices`)

- `GET /api/notices` - Get all notices (with filters)
- `GET /api/notices/:id` - Get single notice
- `POST /api/notices` - Create notice (Admin/Faculty only)
- `PUT /api/notices/:id` - Update notice (Admin/Faculty only)
- `DELETE /api/notices/:id` - Delete notice (Admin/Faculty only)
- `POST /api/notices/:id/acknowledge` - Acknowledge notice

### Comments (`/api/comments`)

- `GET /api/comments/notice/:noticeId` - Get comments for a notice
- `POST /api/comments` - Add comment
- `PUT /api/comments/:id` - Update comment (own comments only)
- `DELETE /api/comments/:id` - Delete comment (own comments or admin)

### Notifications (`/api/notifications`)

- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark notification as read
- `PUT /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

### Users (`/api/users`)

- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/:id` - Get user by ID (Admin only)
- `PUT /api/users/:id` - Update user (Admin only)
- `DELETE /api/users/:id` - Delete user (Admin only)
- `GET /api/users/stats/overview` - Get user statistics (Admin only)

### Analytics (`/api/analytics`)

- `GET /api/analytics/dashboard` - Get dashboard analytics (Admin/Faculty)
- `GET /api/analytics/engagement` - Get engagement metrics (Admin/Faculty)

## 🔐 Authentication

All protected routes require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 🌐 Socket.io Events

**Client → Server:**
- `join-room` - Join user-specific room for notifications

**Server → Client:**
- `new-notice` - New notice published
- `new-comment` - New comment on user's notice
- `notification` - General notification

## 🗄️ Database Models

### User
- name, email, password (hashed)
- role: admin | faculty | student
- department, year (for students)
- employeeId (for admin/faculty)
- studentId (for students)

### Notice
- title, content, category, department
- author (ref: User)
- priority, status, targetYear
- views[], acknowledged[]
- attachments[]

### Comment
- notice (ref: Notice)
- author (ref: User)
- content, isEdited

### Notification
- user (ref: User)
- type, message
- relatedNotice, relatedComment
- isRead

## 🔒 Privacy Features

- Admin cannot see faculty-student private conversations (unless admin participates)
- Role-based access control on all routes
- Users can only edit/delete their own content (except admins)

## 🚀 Deployment

### Deploy to Heroku

```bash
# Install Heroku CLI
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Add MongoDB Atlas connection
heroku config:set MONGODB_URI="your-mongodb-atlas-uri"
heroku config:set JWT_SECRET="your-secret-key"

# Deploy
git push heroku main
```

### Deploy to Railway/Render

1. Connect your GitHub repository
2. Set environment variables in dashboard
3. Deploy automatically

## 📝 Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| MONGODB_URI | MongoDB connection string | mongodb://localhost:27017/scnbcp |
| JWT_SECRET | Secret for JWT tokens | your-secret-key |
| FRONTEND_URL | Frontend URL for CORS | http://localhost:5173 |
| NODE_ENV | Environment | development/production |

## 🧪 Testing

```bash
# Test server health
curl http://localhost:5000/api/health

# Test login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vignan.edu","password":"admin123"}'
```

## 📦 Project Structure

```
backend-code/
├── models/           # Mongoose models
│   ├── User.js
│   ├── Notice.js
│   ├── Comment.js
│   └── Notification.js
├── routes/           # API routes
│   ├── auth.js
│   ├── notices.js
│   ├── comments.js
│   ├── notifications.js
│   ├── users.js
│   └── analytics.js
├── middleware/       # Express middleware
│   └── auth.js
├── seeders/          # Database seeders
│   └── seedDatabase.js
├── server.js         # Main server file
├── package.json
└── .env.example
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License

## 🆘 Support

For issues or questions, please contact the development team.
