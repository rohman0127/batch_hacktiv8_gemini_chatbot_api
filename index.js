import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const __filename = fileURLToPath(import.meta.url);

const app = express();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Endpoint untuk melihat daftar model yang aktif untuk API Key Anda
app.get('/api/models', async (req, res) => {
    try {
        const pager = await ai.models.list();
        const models = [];
        for await (const m of pager) {
            models.push(m.name);
        }
        res.json({ count: models.length, models });
    } catch (err) {
        console.error('List models error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/chat', async (req, res) => {
    // Mendukung key 'conversation' maupun 'messages'
    const conversation = req.body.conversation || req.body.messages;

    try {
        if (!Array.isArray(conversation) || conversation.length === 0) {
            return res.status(400).json({ error: 'Conversation/messages must be a non-empty array' });
        }
        
        // Normalisasi role agar sesuai dengan format Gemini ('user' dan 'model')
        const contents = conversation.map(({ role, text }) => ({
             role: role === 'assistant' ? 'model' : (role || 'user'),
             parts: [{ text: String(text || '') }]
        }));

        // Prioritas model: mulai dari gemini-3.6-flash yang direkomendasikan Google
        const modelsToTry = [
            GEMINI_MODEL,
            "gemini-3.6-flash",
            "gemini-3.5-flash",
            "gemini-3.8-flash",
            "gemini-3.7-flash",
            "gemini-3.1-pro-preview"
        ].filter(Boolean);

        const uniqueModels = [...new Set(modelsToTry)];
        let response = null;
        const errorDetails = [];

        for (const model of uniqueModels) {
            try {
                response = await ai.models.generateContent({
                    model,
                    contents,
                    config: {
                        systemInstruction: `
                        Anda adalah asisten travel berpengalaman 10 tahun,
                        jawab hanya pertanyaan terkait travelling,
                        jawab dengan nada ramah, tanyakan mau liburan kemana, dan berapa lama,
                        lalu buatkan itinerary berdasarkan tempat dan lama liburan dari user
                        `
                    }
                });

                if (response && response.text) {
                    console.log(`[Success] Respon AI berhasil digenerate menggunakan model: ${model}`);
                    break;
                }
            } catch (err) {
                console.warn(`[Model ${model} dilewati]: ${err.message}`);
                errorDetails.push({ model, error: err.message });
            }
        }

        if (!response || !response.text) {
            return res.status(500).json({
                error: "Semua model gagal menghasilkan respon.",
                details: errorDetails
            });
        }

        res.status(200).json({ result: response.text });
    } catch (e) {
        console.error('API Error:', e);
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server ready on http://localhost:${PORT}`));