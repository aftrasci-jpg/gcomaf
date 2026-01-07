// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC2Js5CQ2YA8WBYocEXTwUcnQ-i7P9aF2U",
  authDomain: "gcomaf-c73f9.firebaseapp.com",
  projectId: "gcomaf-c73f9",
  storageBucket: "gcomaf-c73f9.firebasestorage.app",
  messagingSenderId: "613552794894",
  appId: "1:613552794894:web:fa1b5188c0d5dc5729bb5f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
