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

    // Strategies / Sources (Sama seperti website)
    const strategies = [
        async () => {
             console.log("Trying Strategy 1: Vercel API...");
             const r = await axios.get('https://gt-tool-seven.vercel.app/api/gt-status');
             if (r.data.success && r.data.data.online_user) return parseInt(r.data.data.online_user);
             throw new Error('API Response Invalid');
        },
        async () => {
             console.log("Trying Strategy 2: AllOrigins...");
             const r = await axios.get('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://growtopiagame.com/detail'));
             if (r.data.online_user) return parseInt(r.data.online_user);
             throw new Error('API Response Invalid');
        }
    ];

    for (let strategy of strategies) {
        try {
            playerCount = await strategy();
            success = true;
            console.log("✅ Success! Online Players:", playerCount);
            break;
        } catch (e) {
            console.log("❌ Strategy failed:", e.message);
        }
    }

    if (success) {
        try {
            console.log("Saving to Firestore...");
            await addDoc(collection(db, "server_pings"), {
                online: playerCount,
                timestamp: serverTimestamp() // Gunakan server timestamp asli
            });
            console.log("✅ Data saved successfully!");
        } catch (e) {
            console.error("❌ Firestore Save Error:", e.message);
            // Don't crash process, just log
        }
    } else {
        console.error("❌ All fetch strategies failed.");
    }
    
    console.log("Bot finished.");
    console.log("----------------------------------------");
    process.exit(0);
};

fetchAndSave();
