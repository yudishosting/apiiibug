const mongoose = require('mongoose');
const { connectDB } = require('../utils/db');

const messageSchema = new mongoose.Schema({
  remoteJid: String,
  fromMe: Boolean,
  id: String,
  pushName: String,
  participant: String,
  messageType: String,
  messageContent: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

const saveMessageToDB = async (msg) => {
  try {
    await connectDB();
    
    const messageType = Object.keys(msg.message)[0];
    let messageContent;
    
    switch (messageType) {
      case 'conversation':
        messageContent = msg.message.conversation;
        break;
      case 'extendedTextMessage':
        messageContent = msg.message.extendedTextMessage.text;
        break;
      case 'imageMessage':
        messageContent = {
          caption: msg.message.imageMessage.caption,
          mimetype: msg.message.imageMessage.mimetype
        };
        break;
      default:
        messageContent = 'Tipe pesan tidak didukung: ' + messageType;
    }
    
    const newMessage = new Message({
      remoteJid: msg.key.remoteJid,
      fromMe: msg.key.fromMe,
      id: msg.key.id,
      pushName: msg.pushName,
      participant: msg.key.participant,
      messageType,
      messageContent,
      timestamp: new Date(msg.messageTimestamp * 1000)
    });
    
    await newMessage.save();
    return newMessage;
  } catch (error) {
    console.error('Gagal menyimpan pesan:', error);
    throw error;
  }
};

const getMessageHistory = async (jid, limit = 50) => {
  try {
    await connectDB();
    
    const messages = await Message.find({ remoteJid: jid })
      .sort({ timestamp: -1 })
      .limit(limit);
    
    return messages;
  } catch (error) {
    console.error('Gagal mendapatkan riwayat pesan:', error);
    throw error;
  }
};

module.exports = {
  Message,
  saveMessageToDB,
  getMessageHistory
};