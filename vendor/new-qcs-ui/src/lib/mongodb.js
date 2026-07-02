import mongoose from "mongoose";

// Global variable to track connection status
let isConnected = false;

const connectMongo = async () => {
  // Check if we're already connected
  if (isConnected) {
    console.log('Using existing MongoDB connection');
    return mongoose.connection;
  }

  // Check if there's a pending connection
  if (mongoose.connection.readyState === 2) {
    console.log('Waiting for pending MongoDB connection...');
    return new Promise((resolve, reject) => {
      mongoose.connection.on('connected', () => {
        isConnected = true;
        resolve(mongoose.connection);
      });
      mongoose.connection.on('error', (err) => {
        reject(err);
      });
    });
  }

  // Configure connection options
  const options = {
    // useNewUrlParser: true,
    // useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,  // 5 seconds timeout for server selection
    socketTimeoutMS: 45000,         // 45 seconds timeout for operations
    maxPoolSize: 10,               // Maximum number of sockets in the connection pool
    retryWrites: true,
    retryReads: true
  };

  try {
    console.log('Attempting new MongoDB connection...');
    await mongoose.connect(process.env.MONGODB_URI, options);
    
    mongoose.connection.on('connected', () => {
      isConnected = true;
      console.log('MongoDB connected successfully');
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
      isConnected = false;
    });

    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB initial connection error:', error);
    throw error;
  }
};

// Graceful shutdown
const shutdown = async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed gracefully');
    process.exit(0);
  } catch (err) {
    console.error('Error closing MongoDB connection:', err);
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default connectMongo;