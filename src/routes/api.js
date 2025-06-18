const express = require('express');
const router = express.Router();
const { getConnectionStatus, sendWhatsAppMessage } = require('../services/whatsappService');
const { getMessageHistory } = require('../models/messageModel');

router.get('/status', (req, res) => {
  const status = getConnectionStatus();
  res.json(status);
});

router.post('/send', async (req, res) => {
  try {
    const { number, message, messageType } = req.body;
    
    if (!number || !message) {
      return res.status(400).json({
        success: false,
        error: 'Nomor dan pesan diperlukan'
      });
    }
    
    const result = await sendWhatsAppMessage(number, message, messageType || 'simple');
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/messages/:jid', async (req, res) => {
  try {
    const { jid } = req.params;
    const { limit } = req.query;
    
    const messages = await getMessageHistory(jid, limit ? parseInt(limit) : 50);
    
    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;