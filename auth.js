import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { initApp, setCurrentUser, loadDevices } from './script.js';

const firebaseConfig = {
    apiKey: "AIzaSyCysmZUdUYEGQ3ODBoHFgo_n6WRgcSnUhs",
    authDomain: "management-system-6afbd.firebaseapp.com",
    projectId: "management-system-6afbd",
    storageBucket: "management-system-6afbd.appspot.com",
    messagingSenderId: "593129749958",
    appId: "1:593129749958:web:886e812c9220375e5e86c7",
    measurementId: "G-G4LNGD3G4B"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let users = [];
let currentUser = null;

// تهيئة المستخدم الافتراضي (admin)
async function initUsers() {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    if (usersSnapshot.empty) {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, 'admin@example.com', 'admin123');
            await setDoc(doc(db, 'users', userCredential.user.uid), {
                username: 'admin',
                role: 'admin',
                email: 'admin@example.com'
            });
            console.log('Default admin created');
        } catch (error) {
            console.error('Error creating default admin:', error);
        }
    }
}

// تقييد الوصول بناءً على الدور
function restrictAccess(role) {
    if (role !== 'admin') {
        document.querySelector('a[onclick="showSection(\'add-device\')"]').parentElement.style.display = 'none';
        document.querySelector('a[onclick="showSection(\'reports\')"]').parentElement.style.display = 'none';
        document.querySelector('a[onclick="showSection(\'settings\')"]').parentElement.style.display = 'none';
        document.getElementById('add-device').style.display = 'none';
        document.getElementById('reports').style.display = 'none';
        document.getElementById('settings').style.display = 'none';
    } else {
        document.querySelector('a[onclick="showSection(\'add-device\')"]').parentElement.style.display = 'block';
        document.querySelector('a[onclick="showSection(\'reports\')"]').parentElement.style
