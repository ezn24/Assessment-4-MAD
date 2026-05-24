// Firebase Authentication Test Script
// Run with: node test-firebase-auth.js

const { initializeApp } = require('firebase/app');
const { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut 
} = require('firebase/auth');

// Firebase configuration from .env
const firebaseConfig = {
  apiKey: "AIzaSyB5H58jpb6RxcpG8bKeEd0RsvzkIqPBLOU",
  authDomain: "vizminder-20b7a.firebaseapp.com",
  projectId: "vizminder-20b7a",
  storageBucket: "vizminder-20b7a.firebasestorage.app",
  messagingSenderId: "413650478333",
  appId: "1:413650478333:web:99661ff33bf09a72aa0a94"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

console.log('Firebase initialized successfully');
console.log('Project ID:', firebaseConfig.projectId);
console.log('---');

// Test functions
async function testLogin(email, password) {
  console.log(`Testing login for: ${email}`);
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('✓ Login successful!');
    console.log('  User ID:', userCredential.user.uid);
    console.log('  Email:', userCredential.user.email);
    console.log('  Email Verified:', userCredential.user.emailVerified);
    return userCredential.user;
  } catch (error) {
    console.log('✗ Login failed:', error.code);
    console.log('  Message:', error.message);
    return null;
  }
}

async function testRegister(email, password) {
  console.log(`Testing registration for: ${email}`);
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('✓ Registration successful!');
    console.log('  User ID:', userCredential.user.uid);
    console.log('  Email:', userCredential.user.email);
    return userCredential.user;
  } catch (error) {
    console.log('✗ Registration failed:', error.code);
    console.log('  Message:', error.message);
    return null;
  }
}

async function testSignOut() {
  console.log('Testing sign out...');
  try {
    await signOut(auth);
    console.log('✓ Sign out successful!');
  } catch (error) {
    console.log('✗ Sign out failed:', error.message);
  }
}

// Export functions for testing
module.exports = {
  testLogin,
  testRegister,
  testSignOut,
  auth
};

// If run directly, perform basic config test
if (require.main === module) {
  console.log('Firebase Auth Test Script');
  console.log('==========================');
  console.log('This script tests Firebase authentication with your project keys.');
  console.log('');
  console.log('To test login/registration, use these functions in your code:');
  console.log('  const { testLogin, testRegister } = require("./test-firebase-auth.js");');
  console.log('  await testLogin("test@example.com", "password123");');
  console.log('');
}
