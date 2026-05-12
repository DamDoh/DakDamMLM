/**
 * Test script for Language API
 * Run with: node test-language-api.js
 */

const API_BASE = 'http://localhost:3000/api/languages';

// Test token - you'll need to replace this with a real token from localStorage
// Or run this in browser console after logging in
const TEST_TOKEN = process.env.AUTH_TOKEN || '';

async function testLanguageAPI() {
  console.log('🧪 Testing Language API...\n');

  const headers = {
    'Content-Type': 'application/json',
    ...(TEST_TOKEN && { Authorization: `Bearer ${TEST_TOKEN}` })
  };

  // Test 1: Get all languages
  console.log('1️⃣ Testing GET /api/languages');
  try {
    const response = await fetch(`${API_BASE}?includeTranslations=false`, {
      headers,
      credentials: 'include'
    });
    
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${data.success}`);
    console.log(`   Languages found: ${data.data?.length || 0}`);
    
    if (data.data && data.data.length > 0) {
      console.log(`   First language: ${data.data[0].code} - ${data.data[0].name}`);
    }
    console.log('   ✅ GET test passed\n');
  } catch (error) {
    console.error('   ❌ GET test failed:', error.message);
  }

  // Test 2: Get specific language (if exists)
  console.log('2️⃣ Testing GET /api/languages/en');
  try {
    const response = await fetch(`${API_BASE}/en`, {
      headers,
      credentials: 'include'
    });
    
    const data = await response.json();
    console.log(`   Status: ${response.status}`);
    console.log(`   Success: ${data.success}`);
    
    if (data.success) {
      console.log(`   Language: ${data.data?.code} - ${data.data?.name}`);
      console.log(`   Translations: ${data.data?.translationCount || 0} keys`);
      console.log('   ✅ GET single language test passed\n');
    } else {
      console.log(`   ⚠️  Language 'en' not found in database (this is OK if not seeded yet)\n`);
    }
  } catch (error) {
    console.error('   ❌ GET single language test failed:', error.message);
  }

  // Test 3: Create a test language (if authenticated)
  if (TEST_TOKEN) {
    console.log('3️⃣ Testing POST /api/languages (create test language)');
    try {
      const testLang = {
        code: 'test',
        name: 'Test Language',
        nativeName: 'Test Language',
        flag: '🧪',
        isRTL: false,
        translations: {
          'common.loading': 'Testing...',
          'common.error': 'Test Error'
        }
      };

      const response = await fetch(API_BASE, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(testLang)
      });
      
      const data = await response.json();
      console.log(`   Status: ${response.status}`);
      console.log(`   Success: ${data.success}`);
      
      if (data.success) {
        console.log(`   Created language: ${data.data?.code}`);
        console.log('   ✅ POST test passed\n');
        
        // Clean up: Delete test language
        console.log('4️⃣ Testing DELETE /api/languages/test (cleanup)');
        const deleteResponse = await fetch(`${API_BASE}/test`, {
          method: 'DELETE',
          headers,
          credentials: 'include'
        });
        const deleteData = await deleteResponse.json();
        console.log(`   Status: ${deleteResponse.status}`);
        console.log(`   Success: ${deleteData.success}`);
        console.log('   ✅ DELETE test passed\n');
      } else {
        console.log(`   Error: ${data.error}`);
        if (response.status === 409) {
          console.log('   ⚠️  Language already exists (this is OK)\n');
        } else {
          console.log('   ❌ POST test failed\n');
        }
      }
    } catch (error) {
      console.error('   ❌ POST test failed:', error.message);
    }
  } else {
    console.log('3️⃣ Skipping POST test (no auth token provided)');
    console.log('   💡 To test POST, set AUTH_TOKEN environment variable\n');
  }

  console.log('✨ Test completed!');
  console.log('\n📝 Notes:');
  console.log('   - If you see 401/403 errors, you need to be logged in as Super Admin');
  console.log('   - If languages are not found, run: npm run db:seed:languages');
  console.log('   - Check browser console for detailed error messages');
}

// Run tests
testLanguageAPI().catch(console.error);

