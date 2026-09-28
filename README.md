# 💬 PulseChat

A real-time chat application built with React Native (Expo / Web) and Node.js with Socket.IO and MongoDB.

---

## 📋 Features
- **User Authentication:** Login and Registration with dynamic validation error handling (incorrect username vs incorrect password).
- **Real-time Messaging:** WebSockets implementation via Socket.IO.
- **Persistent Data:** Stored in MongoDB using Mongoose.
- **Message Read Receipts:** Status indicators (`✓✓`) tracking delivery and read updates.
- **Online User Counter:** Dynamic counter displaying online users.
- **Typing Indicator:** Live notifications when another user is typing.
- **Session Timestamp:** Displaying exact login timestamp.

---

## 🛠️ Project Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- MongoDB Instance (Local or MongoDB Atlas)

---

### 1. Backend Setup

```bash
cd backend
npm install