// Interactive Firebase Authentication Test
// Run with: node test-auth-interactive.js

const { initializeApp } = require('firebase/app');
const { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut 
} = require('firebase/auth');

const readline = require('readline');

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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function testLogin(email, password) {
  console.log(`\nTesting login for: ${email}`);
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('✓ Login successful!');
    console.log('  User ID:', userCredential.user.uid);
    console.log('  Email:', userCredential.user.email);
    console.log('  Email Verified:', userCredential.user.emailVerified);
    return true;
  } catch (error) {
    console.log('✗ Login failed:', error.code);
    console.log('  Message:', error.message);
    return false;
  }
}

async function testRegister(email, password) {
  console.log(`\nTesting registration for: ${email}`);
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('✓ Registration successful!');
    console.log('  User ID:', userCredential.user.uid);
    console.log('  Email:', userCredential.user.email);
    return true;
  } catch (error) {
    console.log('✗ Registration failed:', error.code);
    console.log('  Message:', error.message);
    return false;
  }
}

async function testSignOut() {
  console.log('\nTesting sign out...');
  try {
    await signOut(auth);
    console.log('✓ Sign out successful!');
    return true;
  } catch (error) {
    console.log('✗ Sign out failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('Firebase Authentication Interactive Test');
  console.log('========================================');
  console.log('Project ID:', firebaseConfig.projectId);
  console.log('');

  while (true) {
    console.log('\nOptions:');
    console.log('1. Test Login');
    console.log('2. Test Registration');
    console.log('3. Test Sign Out');
    console.log('4. Exit');
    
    const choice = await question('\nEnter your choice (1-4): ');
    
    if (choice === '1') {
      const email = await question('Enter email: ');
      const password = await question('Enter password: ');
      await testLogin(email, password);
    } else if (choice === '2') {
      const email = await question('Enter email: ');
      const password = await question('Enter password (min 6 chars): ');
      await testRegister(email, password);
    } else if (choice === '3') {
      await testSignOut();
    } else if (choice === '4') {
      console.log('\nExiting...');
      rl.close();
      break;
    } else {
      console.log('\nInvalid choice. Please try again.');
    }
  }
}

main().catch(console.error);
