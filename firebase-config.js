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
  apiKey: "AIzaSyDpZM9BS61il3O-bgb_e7O13n6hlHq8ypU",
  authDomain: "tols-hack-club.firebaseapp.com",
  projectId: "tols-hack-club",
  storageBucket: "tols-hack-club.firebasestorage.app",
  messagingSenderId: "86974902495",
  appId: "1:86974902495:web:5475bf977c13d77314796a"
};

firebase.initializeApp(firebaseConfig);

// These two are used everywhere in script.js
const db = firebase.firestore();
const auth = firebase.auth();
