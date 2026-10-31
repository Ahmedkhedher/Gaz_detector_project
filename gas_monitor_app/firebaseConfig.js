import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Replace with your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyAseHslRnydfHQjIDfLERa5BF0bzRm7z8c",
  authDomain: "gasmonitor-5ec63.firebaseapp.com",
  databaseURL: "https://gasmonitor-5ec63-default-rtdb.firebaseio.com",
  projectId: "gasmonitor-5ec63",
  storageBucket: "gasmonitor-5ec63.firebasestorage.app",
  messagingSenderId: "510061700514",
  appId: "1:510061700514:web:0e2db973e1614da3e93efb"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
