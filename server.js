import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'index.html')));

// Serve index.html for the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname,'index.html'));
});

const sessionStore = {};

function getClientIp(req) {
    // X-Forwarded-For is standard for proxies (like Vercel, etc.)
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
        return xForwardedFor.split(',')[0].trim();
    }
    return req.ip || req.connection.remoteAddress;
}

// API endpoint for chat
app.post('/api/chat', async (req, res) => {
    try {
        const clientIp = getClientIp(req);
        if (!sessionStore[clientIp]) {
            sessionStore[clientIp] = [];
        }
        // Use stored history if none provided
        const userHistory = req.body.history && req.body.history.length > 0 ? req.body.history : sessionStore[clientIp];
        const messages = [
            {
                role: "system",
                content: `
You are BeaconLight, a professional AI assistant developed by Muhammad Saim Hussain.

If asked about your developer, respond that BeaconLight was created by Muhammad Saim Hussain—a skilled young coder with strong expertise in DevOps, full-stack development, and automation.

If asked about him personally, share that Saim is 13 years old, currently in Grade 7 at Beaconhouse School System, and already demonstrating exceptional talent in software engineering.

Maintain a professional, knowledgeable tone, and focus on delivering clear, relevant answers in coding, development, and DevOps.`
            }
        ];

        if (req.body.system_message) {
            messages.push({ role: 'system', content: req.body.system_message });
        }
        messages.push(...userHistory, { role: 'user', content: req.body.message });

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
                
                'X-Title': 'DeepSeek Chat',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "model": "deepseek/deepseek-r1:free",
                messages,
                temperature: req.body.temperature,
                max_tokens: req.body.max_tokens
            })
        });

        if (!response.ok) {
            throw new Error(`OpenRouter API error: ${response.statusText}`);
        }

        const data = await response.json();
        // Update session store with new conversation
        sessionStore[clientIp] = [
            ...userHistory,
            { role: 'user', content: req.body.message },
            { role: 'assistant', content: data.choices[0].message.content }
        ];
        res.json({ content: data.choices[0].message.content });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});