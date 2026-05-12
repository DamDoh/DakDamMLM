const { registerUser } = require('./src/lib/auth-service.ts');

async function testAuth() {
  try {
    console.log('Testing auth service...');

    const result = await registerUser({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      surname: 'Doe',
      phoneNumber: '+1234567890'
    });

    console.log('Registration successful:', result);
  } catch (error) {
    console.error('Registration failed:', error.message);
  }
}

testAuth();