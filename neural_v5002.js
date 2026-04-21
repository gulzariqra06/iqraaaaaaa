const GEMINI_KEY = "AIzaSyAUAiqSvhFOfRj2gO27iGV-WzBwahxfBWI".trim();
const GEMINI_MODEL = "gemini-2.5-flash-lite"; // Shifting to "Lite" for higher quotas

// --- System Telemetry Dashboard ---
const createTelemetry = () => {
    if (document.getElementById('neural-telemetry')) return;
    const box = document.createElement('div');
    box.id = 'neural-telemetry';
    box.style = 'position:fixed; bottom:10px; right:10px; background:rgba(0,0,0,0.92); color:#7000ff; padding:12px; border-radius:10px; font-family:monospace; font-size:11px; z-index:9999; border:1px solid #7000ff; width:340px; pointer-events:none; box-shadow:0 0 25px rgba(112,0,255,0.4); border-left: 4px solid #7000ff;';
    box.innerHTML = '<b style="color:#00ff88; letter-spacing:1px;">REALIX.AI TELEMETRY v5002.8</b><hr style="border:0; border-top:1px solid #333; margin:8px 0;"><div id="telemetry-log"></div>';
    document.body.appendChild(box);
};

const sysLog = (msg, isErr = false) => {
    const log = document.getElementById('telemetry-log');
    if (log) {
        const div = document.createElement('div');
        div.style.color = isErr ? '#ff4444' : '#00ff88';
        div.style.marginBottom = '6px';
        div.style.borderLeft = isErr ? '2px solid #ff4444' : '2px solid #00ff88';
        div.style.paddingLeft = '6px';
        div.innerText = `> ${msg}`;
        log.prepend(div);
        if (log.children.length > 12) log.lastChild.remove();
    }
};

// --- Neural Scrubber ---
function cleanResponse(text) {
    if (!text) return "";
    let cleaned = text;
    const patterns = [
        /⚠️[\s\S]*?normally\./gi,
        /IMPORTANT NOTICE[\s\S]*?normally\./gi,
        /The Pollinations legacy text API is being deprecated/gi,
        /Please migrate to our new service/gi,
        /Note: Anonymous requests/gi,
        /\{"error":[\s\S]*?\}/g
    ];
    patterns.forEach(p => cleaned = cleaned.replace(p, ''));
    return cleaned.trim();
}

// --- History Sanitizer ---
function sanitizeHistory(history) {
    const contents = [];
    if (!Array.isArray(history)) return contents;
    history.forEach(m => {
        if (!m.text) return;
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
    const contents = sanitizeHistory(history);
    sysLog(`Bridge v5002.8 [${GEMINI_MODEL}]`);

    const tryNode = async (name, url) => {
        sysLog(`Syncing ${name}...`);
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 20000);

        try {
            const systemPrompt = "You are the Gemini AI Assistant, a professional production specialist. Generate elite Markdown output.";
            const gHistory = JSON.parse(JSON.stringify(contents));
            if (gHistory.length > 0 && gHistory[0].parts?.[0]) {
                gHistory[0].parts[0].text = `[DIRECTIVE]: ${systemPrompt}\n\nTask: ${gHistory[0].parts[0].text}`;
            }

            const body = { 
                contents: gHistory,
                generationConfig: { temperature: 0.8, maxOutputTokens: 3000 }
            };

            const res = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-goog-api-key': GEMINI_KEY
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            clearTimeout(tid);

            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                const errDetail = j?.error?.message || `Status ${res.status}`;
                throw new Error(errDetail.substring(0, 200));
            }

            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error("Empty Neural Transmission");
            sysLog(`${name} ONLINE.`);
            return cleanResponse(text);
        } catch (e) {
            clearTimeout(tid);
            sysLog(`${name} ERROR: ${e.message.substring(0, 50)}...`, true);
            throw e;
        }
    };

    try {
        return await tryNode("Alpha", `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`);
    } catch {
        try {
            return await tryNode("Beta (Direct)", `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`);
        } catch {
            sysLog("Automatic Gamma Shift...");
            try {
                // Hardened Pollinations Fallback
                const pRes = await fetch(`https://text.pollinations.ai/openai`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        messages: [{ role: 'system', content: "Elite AI" }, ...contents.map(c => ({ role: c.role === 'model' ? 'assistant' : 'user', content: c.parts[0].text }))],
                        model: 'openai'
                    })
                });
                if (!pRes.ok) throw new Error("Pollinations Connection Lost");
                const d = await pRes.json();
                const t = d?.choices?.[0]?.message?.content;
                if (!t) throw new Error("Null");
                sysLog("Gamma SUCCESS.");
                return cleanResponse(t);
            } catch (eFallback) {
                sysLog(`Gamma FAIL: ${eFallback.message}`, true);
                sysLog("CRITICAL: Bridge Collapse.", true);
                return "Neural connection failed. Both Gemini and Fallback systems are overloaded. Please try again in 30 seconds.";
            }
        }
    }
}

// --- Init Logic ---
document.addEventListener('DOMContentLoaded', () => {
    // createTelemetry();
    const CURRENT_NEURAL_VER = "5002.8";
    if (localStorage.getItem('neural_ver') !== CURRENT_NEURAL_VER) {
        localStorage.clear();
        localStorage.setItem('neural_ver', CURRENT_NEURAL_VER);
    }
    sysLog("Bridge v5002.8 [Flash Lite] Active.");

    const stream = document.getElementById('realix-message-stream');
    const input = document.getElementById('realix-input');
    const send = document.getElementById('realix-send');
    const scriptBtn = document.getElementById('generate-script-btn');

    let chatData = [];
    const sync = () => {
        if (!stream) return;
        stream.innerHTML = '';
        chatData.forEach(m => {
            const d = document.createElement('div');
            d.className = `phoenix-msg ${m.sender === 'user' ? 'msg-user' : 'msg-ai'}`;
            d.innerHTML = (m.text || "").replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
            stream.appendChild(d);
        });
        stream.scrollTop = stream.scrollHeight;
    };

    const runChat = async () => {
        const val = input.value.trim();
        if (!val) return;
        input.value = '';
        chatData.push({ sender: 'user', text: val });
        sync();
        if (send) send.disabled = true;
        const response = await initiateNeuralBridge(chatData);
        if (response) {
            chatData.push({ sender: 'ai', text: response });
            sync();
        }
        if (send) send.disabled = false;
    };

    if (send) send.onclick = runChat;
    if (input) input.onkeyup = (e) => e.key === 'Enter' && runChat();

    if (scriptBtn) {
        scriptBtn.onclick = async () => {
            const topic = document.getElementById('script-topic')?.value;
            const resArea = document.getElementById('script-result');
            if (!topic || !resArea) return;
            sysLog("Building Script Logic (Flash Lite)...");
            scriptBtn.disabled = true;
            resArea.classList.remove('hidden');
            resArea.innerHTML = "<p>Pulsing Neural Core (Flash Lite)...</p>";
            try {
                const response = await initiateNeuralBridge([{ sender: 'user', text: `Create a professional movie script about: ${topic}` }]);
                resArea.innerHTML = `<div class="result-card">${response.replace(/\n/g, '<br>')}</div>`;
                sysLog("Forge Success.");
            } catch {
                resArea.innerHTML = "<p>Forge Error. Please retry.</p>";
            }
            scriptBtn.disabled = false;
        };
    }
});
