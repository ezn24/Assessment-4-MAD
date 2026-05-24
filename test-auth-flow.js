// Test Firebase Authentication Flow
// This script tests actual login/registration with your Firebase project

const { initializeApp } = require('firebase/app');
const { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut 
} = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyB5H58jpb6RxcpG8bKeEd0RsvzkIqPBLOU",
  authDomain: "vizminder-20b7a.firebaseapp.com",
  projectId: "vizminder-20b7a",
  storageBucket: "vizminder-20b7a.firebasestorage.app",
  messagingSenderId: "413650478333",
  appId: "1:413650478333:web:99661ff33bf09a72aa0a94"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

console.log('========================================');
console.log('Firebase Authentication Flow Test');
console.log('========================================\n');

// Test with a test account
const testEmail = 'test@vizminder.com';
const testPassword = 'test123456';

async function runTests() {
  try {
    // Test 1: Try to register a new account
    console.log('Test 1: Attempting to register new account...');
    console.log(`Email: ${testEmail}`);
    console.log(`Password: ${testPassword}`);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
      console.log('✓ Registration successful!');
      console.log('  User ID:', userCredential.user.uid);
      console.log('  Email:', userCredential.user.email);
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        console.log('⚠ Email already exists (expected if test was run before)');
        console.log('  Proceeding to login test...');
      } else {
        console.log('✗ Registration failed:', error.code);
        console.log('  Message:', error.message);
        return;
      }
    }

    // Test 2: Try to login
    console.log('\nTest 2: Attempting to login...');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, testEmail, testPassword);
      console.log('✓ Login successful!');
      console.log('  User ID:', userCredential.user.uid);
      console.log('  Email:', userCredential.user.email);
      console.log('  Email Verified:', userCredential.user.emailVerified);
    } catch (error) {
      console.log('✗ Login failed:', error.code);
      console.log('  Message:', error.message);
      return;
    }

    // Test 3: Sign out
    console.log('\nTest 3: Attempting to sign out...');
    try {
      await signOut(auth);
      console.log('✓ Sign out successful!');
    } catch (error) {
      console.log('✗ Sign out failed:', error.message);
    }

    console.log('\n========================================');
    console.log('✓ All authentication tests passed!');
    console.log('========================================');
    console.log('\nYour Firebase authentication is working correctly.');
    console.log('The accounts page should work properly in the app.');

  } catch (error) {
    console.log('\n✗ Test failed with unexpected error:', error.message);
  }
}

runTests();
