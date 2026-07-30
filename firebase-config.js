/* ============================================================
   FIREBASE CONFIG
   Replace the placeholder values below with YOUR project's
   config. Get this from:
   Firebase Console -> Project settings (gear icon) -> General
   -> "Your apps" -> the web app you registered -> SDK setup.

   This is the ONLY file you should need to touch when moving
   the site to a new Firebase project.
   ============================================================ */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);

// These two are used everywhere in script.js
const db = firebase.firestore();
const auth = firebase.auth();
