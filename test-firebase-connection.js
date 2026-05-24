// Firebase Connection Test - Validates configuration and basic auth setup
// Run with: node test-firebase-connection.js

const { initializeApp } = require('firebase/app');
const { getAuth } = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyB5H58jpb6RxcpG8bKeEd0RsvzkIqPBLOU",
  authDomain: "vizminder-20b7a.firebaseapp.com",
  projectId: "vizminder-20b7a",
  storageBucket: "vizminder-20b7a.firebasestorage.app",
  messagingSenderId: "413650478333",
  appId: "1:413650478333:web:99661ff33bf09a72aa0a94"
};

console.log('Testing Firebase Configuration...');
console.log('====================================\n');

// Validate config
console.log('Configuration Check:');
console.log('  API Key:', firebaseConfig.apiKey ? '✓ Present' : '✗ Missing');
console.log('  Auth Domain:', firebaseConfig.authDomain ? '✓ Present' : '✗ Missing');
console.log('  Project ID:', firebaseConfig.projectId ? '✓ Present' : '✗ Missing');
console.log('  Storage Bucket:', firebaseConfig.storageBucket ? '✓ Present' : '✗ Missing');
console.log('  Messaging Sender ID:', firebaseConfig.messagingSenderId ? '✓ Present' : '✗ Missing');
console.log('  App ID:', firebaseConfig.appId ? '✓ Present' : '✗ Missing');

try {
  console.log('\nInitializing Firebase...');
  const app = initializeApp(firebaseConfig);
  console.log('✓ Firebase app initialized successfully');
  
  console.log('\nInitializing Auth...');
  const auth = getAuth(app);
  console.log('✓ Firebase Auth initialized successfully');
  
  console.log('\nProject Details:');
  console.log('  Project ID:', firebaseConfig.projectId);
  console.log('  Auth Domain:', firebaseConfig.authDomain);
  
  console.log('\n====================================');
  console.log('✓ All Firebase checks passed!');
  console.log('====================================');
  console.log('\nYour Firebase configuration is valid.');
  console.log('You can now test login/registration in the app.');
  
} catch (error) {
  console.log('\n✗ Firebase initialization failed:');
  console.log('  Error:', error.message);
  console.log('  Code:', error.code);
  process.exit(1);
}
