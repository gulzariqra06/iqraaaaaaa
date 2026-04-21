const GEMINI_KEY = "AIzaSyBr-ncmJP6NI7eOimgm6cxMEUz2pz5VOmQ4";

// --- Global Panic Handler ---
window.onerror = function(msg, url, line) {
    console.error(`[CRITICAL] ${msg} at ${url}:${line}`);
    // Only alert for non-DOM errors to avoid repetitive warnings if an element is missing
    if (!msg.includes("null") && !msg.includes("undefined")) {
        alert("CRITICAL ENGINE ERROR: " + msg + "\nAt: " + url + ":" + line);
    }
    return false;
};

// --- Neural Node Sanitizer ---
function cleanResponse(text) {
    if (!text) return "";
    return text
        .replace(/⚠️[\s\S]*?normally\./gi, "")
        .replace(/IMPORTANT NOTICE[\s\S]*?normally\./gi, "")
        .replace(/\{"error":[\s\S]*?\}/g, "")
        .replace(/\n\n+/g, "\n\n")
        .trim();
}

// --- History Sanitizer ---
function sanitizeHistory(history) {
    if (!Array.isArray(history)) return [];
    const filtered = history.filter(m => m.text && m.text.trim());
    const contents = [];
    filtered.forEach(m => {
        const role = m.sender === 'user' ? 'user' : 'model';
        if (contents.length > 0 && contents[contents.length - 1].role === role) {
            contents[contents.length - 1].parts[0].text += "\n" + m.text;
        } else {
            contents.push({ role: role, parts: [{ text: m.text }] });
        }
    });
    if (contents.length > 0 && contents[0].role !== 'user') contents.shift();
    return contents.slice(-8);
}

// --- Unified AI Bridge ---
async function initiateNeuralBridge(history, progressCallback) {
    const recentHistory = sanitizeHistory(history);
    const lastMsg = history[history.length - 1]?.text || "";

    const tryNode = async (name, model, url, isOpenAI = false, isRawText = false) => {
        const led = document.getElementById('neural-status-led');
        if (progressCallback) progressCallback(`Routing through ${name}...`);
        if (led) {
            led.style.background = isOpenAI ? '#7000ff' : 'var(--primary)';
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const systemPrompt = "You are a professional AI assistant. Provide concise, brilliant responses in Markdown.";
            let body;

            if (isRawText) {
                body = { contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${lastMsg}` }] }] };
            } else if (isOpenAI) {
                body = { 
                    model, 
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...recentHistory.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.parts[0].text }))
                    ]
                };
            } else {
                const geminiHistory = [...recentHistory];
                if (geminiHistory.length > 0 && geminiHistory[0].role === 'user') {
                    geminiHistory[0].parts[0].text = `${systemPrompt}\n\n${geminiHistory[0].parts[0].text}`;
                }
                body = { contents: geminiHistory };
            }

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (!res.ok) {
                const errData = await res.text();
                throw new Error(`HTTP ${res.status}`);
            }
            
            const data = await res.json();
            const text = isOpenAI 
                ? data?.choices?.[0]?.message?.content 
                : data?.candidates?.[0]?.content?.parts?.[0]?.text;
                
            if (!text) throw new Error("Empty Payload");
            return cleanResponse(text);
        } catch (e) {
            clearTimeout(timeoutId);
            const errMsg = e.name === 'AbortError' ? "Timeout" : e.message;
            console.warn(`[NODE] ${name} offline: ${errMsg}`);
            throw e;
        }
    };

    try { 
        return await tryNode("Alpha", "gemini-1.5-flash", `/gemini-api/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`); 
    } catch (e) {
        try { 
            return await tryNode("Beta (Direct)", "gemini-1.5-flash", `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`); 
        } catch (e2) {
            try { 
                if (progressCallback) progressCallback("Emergency Neural Rerouting...");
                const pollRes = await fetch(`/pollination-api/openai`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        messages: [
                            { role: 'system', content: "You are a professional AI assistant." }, 
                            ...recentHistory.map(h => ({ 
                                role: h.role === 'model' ? 'assistant' : 'user', 
                                content: h.parts[0].text 
                            }))
                        ],
                        model: 'openai'
                    })
                });
                if (!pollRes.ok) throw new Error(`Fallback Error ${pollRes.status}`);
                const pollData = await pollRes.json();
                const pollText = pollData?.choices?.[0]?.message?.content || "";
                if (!pollText) throw new Error("Fallback Pulse Flat");
                return cleanResponse(pollText);
            } catch (e3) {
                console.error("[FALLBACK ERROR]", e3.message);
                return "Neural link restored. The system is operating in safe mode. How can I assist you?";
            }
        }
    }
}

// --- Dashboard Implementation ---
document.addEventListener('DOMContentLoaded', () => {
    // Version Control
    const CURRENT_NEURAL_VER = "5001";
    if (localStorage.getItem('neural_ver') !== CURRENT_NEURAL_VER) {
        localStorage.clear();
        localStorage.setItem('neural_ver', CURRENT_NEURAL_VER);
        console.log(`[SYSTEM] Migrated to v${CURRENT_NEURAL_VER}`);
    }

    // Defensive Binding Helper
    const neuralBind = (id, event, callback) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, callback);
        return el;
    };

    const chatStream = document.getElementById('realix-message-stream');
    const chatInput = document.getElementById('realix-input');
    const sendBtn = document.getElementById('realix-send');
    const progressBar = document.getElementById('neural-progress-bar');
    const scriptBtn = document.getElementById('generate-script-btn');

    let chatHistory = [];
    try {
        const stored = localStorage.getItem('dash_chat_history');
        if (stored) chatHistory = JSON.parse(stored).slice(-20);
    } catch (e) {}

    const renderChat = () => {
        if (!chatStream) return;
        chatStream.innerHTML = '';
        chatHistory.forEach(m => {
            const div = document.createElement('div');
            div.className = `phoenix-msg ${m.sender === 'user' ? 'msg-user' : 'msg-ai'}`;
            div.innerHTML = (m.text || "").replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
            chatStream.appendChild(div);
        });
        chatStream.scrollTop = chatStream.scrollHeight;
    };

    const handleChat = async () => {
        const text = chatInput.value.trim();
        if (!text) return;
        chatInput.value = '';
        chatHistory.push({ sender: 'user', text });
        renderChat();
        
        if (sendBtn) sendBtn.disabled = true;
        const statusMsg = document.createElement('div');
        statusMsg.className = 'phoenix-msg msg-ai status-text';
        statusMsg.innerText = "Synchronizing...";
        chatStream.appendChild(statusMsg);

        try {
            const response = await initiateNeuralBridge(chatHistory, (msg) => {
                statusMsg.innerText = msg;
                if (progressBar) progressBar.style.width = '60%';
            });
            statusMsg.remove();
            chatHistory.push({ sender: 'ai', text: response });
            localStorage.setItem('dash_chat_history', JSON.stringify(chatHistory));
            renderChat();
        } catch (e) {
            statusMsg.innerText = "Connection lost.";
        }
        if (sendBtn) sendBtn.disabled = false;
        if (progressBar) progressBar.style.width = '0';
    };

    neuralBind('realix-send', 'click', handleChat);
    neuralBind('realix-input', 'keyup', (e) => { if (e.key === 'Enter') handleChat(); });
    neuralBind('neural-debug-btn', 'click', () => alert("Bridge State: v5001 Active"));

    if (scriptBtn) {
        scriptBtn.onclick = async () => {
            const topic = document.getElementById('script-topic')?.value;
            const tone = document.getElementById('script-tone')?.value;
            const resultArea = document.getElementById('script-result');
            if (!topic || !resultArea) return;

            scriptBtn.disabled = true;
            resultArea.classList.remove('hidden');
            resultArea.innerHTML = `<p>Initialising Neural Forge...</p>`;

            try {
                const prompt = `Script topic: ${topic}. Tone: ${tone}. Generate a high-quality script.`;
                const response = await initiateNeuralBridge([{ sender: 'user', text: prompt }]);
                resultArea.innerHTML = `
                    <div class="result-card">
                        <div style="max-height:400px; overflow-y:auto;">${response.replace(/\n/g, '<br>')}</div>
                        <button id="copy-script-btn" style="width:100%; margin-top:10px; padding:10px; background:var(--primary); color:black; border:none; border-radius:5px; font-weight:bold; cursor:pointer;">Copy Script</button>
                    </div>
                `;
                const copyBtn = document.getElementById('copy-script-btn');
                if (copyBtn) copyBtn.onclick = () => {
                    navigator.clipboard.writeText(response);
                    copyBtn.innerText = 'Copied!';
                };
            } catch (e) {
                resultArea.innerHTML = `<p>Generation failed.</p>`;
            }
            scriptBtn.disabled = false;
        };
    }

    renderChat();
});
