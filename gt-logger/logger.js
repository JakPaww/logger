import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import axios from "axios";

// --- CONFIG ---
// Menggunakan config yang sama dengan website
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyDJ7L7-xKPVnynLua8lVXQCQLJL139vtlo",
    authDomain: "gt-tools-627f9.firebaseapp.com",
    projectId: "gt-tools-627f9",
    storageBucket: "gt-tools-627f9.firebasestorage.app",
    messagingSenderId: "633849365353",
    appId: "1:633849365353:web:ed852dc913a01d8fbc73f8",
    measurementId: "G-NV098SR8V2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const fetchAndSave = async () => {
    console.log("----------------------------------------");
    console.log("Bot started at:", new Date().toLocaleString());

    let playerCount = 0;
    let success = false;

    // Headers to mimic browser (Full Chrome Headers)
    const HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate', // Node.js might struggle with 'br' without external libs
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
    };

    // Strategies / Sources (Sama seperti website)
    const strategies = [
        // 0. Direct Access (Paling Cepat & Stabil untuk Node.js)
        async () => {
            console.log("Trying Strategy 0: Direct Connection...");
            try {
                const r = await axios.get('https://growtopiagame.com/detail', {
                    headers: HEADERS,
                    timeout: 5000,
                    validateStatus: status => status < 500 // Accept 403/400 to debug
                });

                // Debugging Info if not successful immediately
                if (r.status !== 200) {
                    console.log(`⚠️ Status Code: ${r.status}`);
                }

                let data = r.data;
                if (typeof data === 'string') {
                    // Try to parse if it's a string
                    try { data = JSON.parse(data); } catch (e) { }
                }

                if (data && data.online_user) {
                    return parseInt(data.online_user);
                } else {
                    // Log the first 100 chars to see what we got (Cloudflare page?)
                    const preview = typeof r.data === 'string' ? r.data.substring(0, 100).replace(/\n/g, ' ') : JSON.stringify(r.data);
                    console.log(`⚠️ Invalid Response Content: ${preview}...`);
                }
            } catch (e) {
                console.log(`⚠️ Direct Connect Error: ${e.message}`);
            }
            throw new Error('API Response Invalid / Blocked');
        },
        // 1. AllOrigins
        async () => {
            console.log("Trying Strategy 1: AllOrigins...");
            const r = await axios.get('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://growtopiagame.com/detail') + '&t=' + Date.now(), { headers: HEADERS });
            if (r.data && r.data.online_user) return parseInt(r.data.online_user);
            throw new Error('API Response Invalid');
        },
        // 2. ThingProxy
        async () => {
            console.log("Trying Strategy 2: ThingProxy...");
            const r = await axios.get('https://thingproxy.freeboard.io/fetch/' + encodeURIComponent('https://growtopiagame.com/detail'), { headers: HEADERS });
            if (r.data && r.data.online_user) return parseInt(r.data.online_user);
            throw new Error('API Response Invalid');
        },
        // 3. CorsProxy.io
        async () => {
            console.log("Trying Strategy 3: CorsProxy.io...");
            const r = await axios.get('https://corsproxy.io/?' + encodeURIComponent('https://growtopiagame.com/detail'), { headers: HEADERS });
            if (r.data && r.data.online_user) return parseInt(r.data.online_user);
            throw new Error('API Response Invalid');
        },
        // 4. Vercel API (Backup)
        async () => {
            console.log("Trying Strategy 4: Vercel API...");
            const r = await axios.get('https://gt-tool-seven.vercel.app/api/gt-status');
            if (r.data.success && r.data.data.online_user) return parseInt(r.data.data.online_user);
            throw new Error('API Response Invalid');
        }
    ];

    // --- LOOP SETUP ---
    const LOOP_INTERVAL_MS = 15 * 1000; // 30 Detik
    const AUTO_STOP_MS = 14.5 * 60 * 1000; // 14.5 Menit (Biar ga overlap sama jadwal Cron 15 menit)

    const runBot = async () => {
        console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Starting check...`);
        let playerCount = 0;
        let success = false;

        // Strategies Execution (Sequential)
        for (let i = 0; i < strategies.length; i++) {
            try {
                playerCount = await strategies[i]();
                if (playerCount > 0) {
                    success = true;
                    console.log(`✅ LIVE: ${playerCount} players online (Strategy ${i})`);
                    break;
                }
            } catch (e) {
                console.log(`Warning: Strategy ${i} failed (${e.message})`);
            }
        }

        if (!success) {
            console.log("❌ All strategies failed.");
        }

        // SAVE TO FIREBASE
        if (success) {
            try {
                await addDoc(collection(db, "server_pings"), {
                    online: playerCount,
                    timestamp: serverTimestamp()
                });
                console.log("💾 Saved to Firebase.");
            } catch (e) {
                console.error("❌ Firebase Save Error:", e.message);
            }
        }
    };

    // First Run
    runBot();

    // Loop
    const loopId = setInterval(runBot, LOOP_INTERVAL_MS);

    // AUTO STOP untuk GitHub Actions
    console.log(`🚀 Logger started! Running every 30s for ${AUTO_STOP_MS / 60000} mins.`);
    setTimeout(() => {
        console.log("🛑 Auto-stop limit reached (prevent overlap). Exiting...");
        clearInterval(loopId);
        process.exit(0);
    }, AUTO_STOP_MS);
};

fetchAndSave();

