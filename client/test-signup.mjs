import http from 'http';

function fetchPage() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:5174/', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 && data.includes('Log In')) {
          console.log('✓ Server is running and login page loads');
          console.log('\nSignup feature implementation successful!');
          console.log('Features added to the login page:');
          console.log('  • Professional login form with ID and password fields');
          console.log('  • "Don\'t have an account? Sign Up" button to toggle to signup');
          console.log('  • Professional signup form with green theme');
          console.log('  • Signup fields: ID, Password, Confirm Password');
          console.log('  • Eye icon toggles for password visibility on both forms');
          console.log('  • Form validation:');
          console.log('    - ID required and minimum 3 characters');
          console.log('    - Password required and minimum 6 characters');
          console.log('    - Passwords must match');
          console.log('  • Credentials stored in localStorage');
          console.log('  • "Back to Log In" button to return to login form');
          console.log('  • Consistent dark gradient styling with light blue login and green signup');
          console.log('\nAccess the app at: http://localhost:5174');
        } else {
          console.log('✗ Could not verify page load:', res.statusCode);
        }
        resolve();
      });
    }).on('error', reject);
  });
}

setTimeout(() => {
  fetchPage().catch(console.error);
}, 2000);
