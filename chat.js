export default async function handler(req, res) {
    // सिर्फ POST रिक्वेस्ट की अनुमति देगा
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "प्रॉम्प्ट (Prompt) खाली नहीं हो सकता।" });
        }

        // Vercel Environment Variables से 1 से 10 तक की सभी API Keys को एक सूची में जोड़ना
        const keys = [];
        for (let i = 1; i <= 10; i++) {
            const key = process.env[`GEMINI_API_KEY_${i}`];
            if (key) keys.push(key);
        }
        
        // अगर पुरानी बिना नंबर वाली सिंगल की हो, उसे भी बैकअप के लिए जोड़ लेगा
        if (process.env.GEMINI_API_KEY) {
            keys.push(process.env.GEMINI_API_KEY);
        }

        // सुरक्षा जाँच: अगर एक भी Key नहीं मिली
        if (keys.length === 0) {
            return res.status(500).json({ 
                error: "Vercel में कोई भी API Key नहीं मिली! कृपया Environment Variables में GEMINI_API_KEY_1 से GEMINI_API_KEY_10 तक सेट करें।" 
            });
        }

        let lastError = null;

        // 🔄 ऑटो-रोटेशन लूप: एक-एक करके सभी Keys से ट्राई करेगा
        for (const key of keys) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });

                const data = await response.json();

                // यदि गूगल सर्वर से सही जवाब मिल जाता है
                if (response.ok && data.candidates && data.candidates.length > 0) {
                    const replyText = data.candidates[0]?.content?.parts[0]?.text || "जवाब उपलब्ध नहीं है।";
                    return res.status(200).json({ text: replyText });
                }

                // अगर यह Key फेल हुई, तो एरर को सेव करके अगली Key पर बढ़ेगा
                lastError = data.error || data;
            } catch (err) {
                lastError = err;
            }
        }

        // अगर दसों (10) Keys की लिमिट या कनेक्शन फेल हो जाए
        return res.status(500).json({ 
            error: "सभी 10 API Keys की लिमिट समाप्त हो गई या कनेक्शन में एरर है।", 
            details: lastError 
        });

    } catch (err) {
        return res.status(500).json({ error: "सर्वर की अंदरूनी समस्या (Internal Server Error): " + err.message });
    }
    }
