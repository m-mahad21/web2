import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Enhanced CORS configuration
app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session storage with IP-based tracking
const sessionStore = {};

// Secure client IP detection
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
         req.socket?.remoteAddress ||
         'unknown-ip';
};

// API endpoint for chat
app.post('/api/chat', async (req, res) => {
  try {
    const clientIp = getClientIp(req);
    
    // Initialize session if needed
    if (!sessionStore[clientIp]) {
      sessionStore[clientIp] = [];
    }

    // System message configuration
    const systemMessage = {
      role: "system",
      content: `
        You are BeaconLight AI, developed by Muhammad Saim Hussain.
        - Creator: Muhammad Saim Hussain (13-year-old developer)
        - Skills: DevOps, Full-stack development, Automation
        - Education: Grade 7 at Beaconhouse School System
        Maintain professional tone focused on technical topics.
      `.replace(/\n\s+/g, '\n').trim()
    };

    // Build message history
    const messages = [systemMessage];
    if (req.body.system_message) {
      messages.push({ role: 'system', content: req.body.system_message });
    }
    
    messages.push(
      ...sessionStore[clientIp],
      { role: 'user', content: req.body.message }
    );

    // OpenRouter API request
    const apiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'Beacon Light AI',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-r1:free",
        messages,
        temperature: req.body.temperature || 0.7,
        max_tokens: req.body.max_tokens || 1000
      })
    });

    // Enhanced error handling
    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      console.error('OpenRouter API Error:', {
        status: apiResponse.status,
        headers: Object.fromEntries(apiResponse.headers.entries()),
        error: errorData
      });
      throw new Error(`API Error: ${apiResponse.status} ${apiResponse.statusText}`);
    }

    const responseData = await apiResponse.json();
    const aiResponse = responseData.choices[0].message.content;

    // Update session history
    sessionStore[clientIp] = [
      ...sessionStore[clientIp],
      { role: 'user', content: req.body.message },
      { role: 'assistant', content: aiResponse }
    ];

    res.json({ content: aiResponse });

  } catch (error) {
    console.error('Server Error:', {
      error: error.stack,
      timestamp: new Date().toISOString()
    });
    res.status(500).json({ 
      error: "Sorry, I'm experiencing technical difficulties. Please try again later.",
      debug: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Server initialization
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server ready at ${process.env.APP_URL || `http://localhost:${PORT}`}`);
});
