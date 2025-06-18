const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  
  try {
    const db = await mongoose.connect(process.env.MONGODB_URI);
    isConnected = db.connections[0].readyState === 1;
    console.log('Koneksi database berhasil!');
  } catch (error) {
    console.error('Gagal terhubung ke database:', error);
    throw error;
  }
};

module.exports = { connectDB };