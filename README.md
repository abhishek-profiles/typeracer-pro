# Multiplayer Typing Speed Test

A real-time multiplayer typing speed test application where users can compete against each other in typing races. Built with modern web technologies and featuring a responsive, beautiful UI.

## Features

- **Real-time Multiplayer Racing**: Compete with other players in real-time typing competitions
- **Live Progress Tracking**: See your competitors' progress, WPM, and accuracy in real-time
- **User Authentication**: Secure account system with JWT authentication
- **Room System**: Create or join rooms with unique codes
- **Performance Metrics**: Track Words Per Minute (WPM) and accuracy
- **Responsive Design**: Beautiful, modern UI that works on all devices
- **Real-time Updates**: Instant feedback on typing progress and race status

## Tech Stack

### Frontend
- React 18 with Vite
- Socket.IO Client for real-time communication
- Tailwind CSS for styling
- Axios for HTTP requests
- React Context for state management

### Backend
- Node.js with Express
- Socket.IO for real-time features
- MongoDB with Mongoose
- JWT for authentication
- CORS for cross-origin resource sharing

## Getting Started

### Prerequisites

- Node.js >= 14.0.0
- MongoDB instance
- npm or yarn package manager

### Environment Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd <project-directory>
```

2. Frontend Setup:
```bash
cd frontend
npm install

# Create .env file with:
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

3. Backend Setup:
```bash
cd backend
npm install

# Create .env file with:
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=3000
CLIENT_URL=http://localhost:5173
```

### Running the Application

1. Start the backend server:
```bash
cd backend
npm run dev
```

2. Start the frontend development server:
```bash
cd frontend
npm run dev
```

## Deployment

### Backend Deployment
1. Set up your production environment variables
2. Install production dependencies: `npm install --production`
3. Start the server: `npm run prod`

### Frontend Deployment
1. Build the frontend: `npm run build`
2. Deploy the `dist` directory to your hosting service
3. Ensure the Vercel configuration (`vercel.json`) is properly set up for SPA routing

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/YourFeature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/YourFeature`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Thanks to all contributors who have helped shape this project
- Built with modern web technologies and best practices
- Inspired by the need for an engaging, multiplayer typing practice platform
