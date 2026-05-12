# 🔐 Simple OTP Service for Traditional Web Hosting

**Eliminate third-party OTP dependencies while keeping your traditional hosting!**

This simple OTP system replaces Twilio/Auth0/Firebase authentication services with a self-hosted solution that works perfectly on Bluehost, HostGator, and other shared hosting providers.

---

## 🎯 **Perfect For Your Use Case**

| Your Requirements | ✅ **Simple OTP Solution** |
|-------------------|---------------------------|
| Traditional hosting (Bluehost, HostGator) | ✅ Compatible |
| Keep existing infrastructure | ✅ No changes needed |
| Eliminate third-party OTP costs | ✅ **$0/month** |
| Simple integration | ✅ Drop-in replacement |
| Secure authentication | ✅ Enterprise-grade security |

---

## 🚀 **Quick Setup (5 Minutes)**

### 1. **Add Environment Variables**
```bash
# Email Configuration (use your hosting's email)
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Your MLM Platform

# Optional: SMTP relay (if your hosting supports it)
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASSWORD=your-email-password
```

### 2. **Run Database Migration**
```bash
npx prisma migrate dev --name add_simple_otp
npx prisma generate
```

### 3. **Replace Your OTP Calls**
```javascript
// OLD: Twilio/Auth0 expensive API calls
const twilio = require('twilio');
await twilio.sendOTP(phone, code);

// NEW: Free self-hosted calls
const response = await fetch('/api/simple-otp/generate', {
  method: 'POST',
  body: JSON.stringify({
    identifier: 'user@example.com',
    type: 'email',
    purpose: 'verification'
  })
});
```

---

## 📧 **Email Integration**

### **Automatic Email Delivery**
The system automatically sends beautiful HTML emails using your hosting provider's mail system:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    .code { font-size: 32px; font-weight: bold; color: #007bff; }
  </style>
</head>
<body>
  <h2>Your Verification Code</h2>
  <div class="code">123456</div>
  <p>Expires in 10 minutes</p>
</body>
</html>
```

### **Hosting Provider Compatibility**

| Hosting Provider | Email Method | Setup |
|------------------|-------------|-------|
| **Bluehost** | SMTP Relay | `SMTP_HOST=mail.yourdomain.com` |
| **HostGator** | SMTP Relay | `SMTP_HOST=mail.yourdomain.com` |
| **GoDaddy** | SMTP Relay | `SMTP_HOST=smtpout.secureserver.net` |
| **Generic** | Built-in mail() | No extra configuration needed |

---

## 📱 **API Endpoints**

### **Generate OTP**
```http
POST /api/simple-otp/generate
Content-Type: application/json

{
  "identifier": "user@example.com",
  "type": "email",
  "purpose": "verification",
  "companyId": "optional"
}
```

**Response:**
```json
{
  "success": true,
  "otpId": "otp_123456",
  "message": "OTP sent to email"
}
```

### **Verify OTP**
```http
POST /api/simple-otp/verify
Content-Type: application/json

{
  "identifier": "user@example.com",
  "code": "123456",
  "purpose": "verification",
  "companyId": "optional"
}
```

**Response:**
```json
{
  "success": true,
  "otpId": "otp_123456",
  "message": "OTP verified successfully"
}
```

---

## 🔧 **Integration Examples**

### **1. User Registration**
```javascript
// In your registration form
async function registerUser(email, password) {
  // Generate OTP for email verification
  const otpResponse = await fetch('/api/simple-otp/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: email,
      type: 'email',
      purpose: 'verification'
    })
  });

  const otpData = await otpResponse.json();

  if (otpData.success) {
    // Show OTP input field
    showOTPInput(email);
  }
}
```

### **2. Password Reset**
```javascript
// Password reset request
async function requestPasswordReset(email) {
  const response = await fetch('/api/simple-otp/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: email,
      type: 'email',
      purpose: 'password_reset'
    })
  });

  const data = await response.json();

  if (data.success) {
    alert('Password reset code sent to your email');
  }
}
```

### **3. Login Verification (2FA)**
```javascript
// After password verification, send 2FA code
async function sendLoginOTP(email) {
  const response = await fetch('/api/simple-otp/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: email,
      type: 'email',
      purpose: 'login_2fa'
    })
  });

  return await response.json();
}
```

### **4. OTP Verification**
```javascript
// Verify entered OTP code
async function verifyOTP(identifier, code, purpose) {
  const response = await fetch('/api/simple-otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier,
      code,
      purpose
    })
  });

  const data = await response.json();

  if (data.success) {
    // OTP verified - proceed with action
    completeVerification(identifier);
  } else {
    // Show error
    showError(data.error);
  }

  return data;
}
```

---

## 🔒 **Security Features**

### **Enterprise-Grade Security**
- ✅ **SHA-256 hashed storage** - Codes never stored in plain text
- ✅ **Timing-safe comparison** - Prevents timing attacks
- ✅ **Rate limiting** - 3 attempts per code, automatic lockout
- ✅ **10-minute expiry** - Codes expire automatically
- ✅ **Single-use codes** - Each code can only be used once
- ✅ **Automatic cleanup** - Expired codes removed regularly

### **Database Security**
```sql
-- OTP codes are stored hashed
CREATE TABLE otp_codes (
  id VARCHAR PRIMARY KEY,
  identifier VARCHAR NOT NULL,     -- email/phone
  type VARCHAR NOT NULL,          -- 'email' or 'sms'
  purpose VARCHAR NOT NULL,       -- 'verification', 'password_reset', 'login_2fa'
  code VARCHAR NOT NULL,          -- SHA-256 hashed
  expires_at TIMESTAMP NOT NULL,
  attempts INTEGER DEFAULT 0,     -- Failed attempts counter
  is_active BOOLEAN DEFAULT true,
  company_id VARCHAR,             -- Multi-tenant support
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 💰 **Cost Savings**

| Service | Previous Cost | New Cost | Savings |
|---------|---------------|----------|---------|
| **Twilio SMS** | $0.05-0.10/message | **$0** | 💰 |
| **Auth0/Authy** | $50-200/month | **$0** | 💰 |
| **Firebase Auth** | $0.005/user/month | **$0** | 💰 |
| **SendGrid** | $20-100/month | **$0** | 💰 |

**Total Savings: $70-400/month** (depending on your usage)

---

## 🏗️ **Architecture**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Your App      │────│  Simple OTP      │────│  Your Hosting   │
│                 │    │  Service         │    │  Email System   │
│ • Registration  │    │                  │    │                 │
│ • Login         │    │ • Code Generation │    │ • SMTP Relay    │
│ • Password Reset│    │ • Secure Storage  │    │ • Mail() Func   │
│ • 2FA           │    │ • Email Delivery  │    │ • HTML Emails   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Your Database  │
                       │                  │
                       │ • PostgreSQL     │
                       │ • MySQL          │
                       │ • SQLite         │
                       └──────────────────┘
```

---

## ⚙️ **Configuration Options**

### **Environment Variables**
```bash
# Required
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Your MLM Platform

# Optional (for SMTP relay)
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASSWORD=your-email-password

# Advanced (usually not needed)
OTP_CODE_LENGTH=6
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=3
```

### **Hosting-Specific Setup**

#### **Bluehost Setup**
```bash
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASSWORD=your-email-password
```

#### **HostGator Setup**
```bash
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASSWORD=your-email-password
```

#### **GoDaddy Setup**
```bash
SMTP_HOST=smtpout.secureserver.net
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASSWORD=your-email-password
```

---

## 🧪 **Testing**

### **Test Email Configuration**
```bash
# Test email sending
curl -X POST http://localhost:3000/api/simple-otp/generate \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "test@yourdomain.com",
    "type": "email",
    "purpose": "verification"
  }'
```

### **Test OTP Verification**
```bash
# Check generated code in database, then verify
curl -X POST http://localhost:3000/api/simple-otp/verify \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "test@yourdomain.com",
    "code": "123456",
    "purpose": "verification"
  }'
```

### **View OTP Statistics**
```bash
curl http://localhost:3000/api/simple-otp/stats
```

---

## 🔄 **Migration Guide**

### **Replace Twilio Authy**
```javascript
// OLD CODE
const authy = require('authy');
await authy.sendOTP(phone, code);

// NEW CODE
await fetch('/api/simple-otp/generate', {
  method: 'POST',
  body: JSON.stringify({
    identifier: phone,
    type: 'sms',
    purpose: 'verification'
  })
});
```

### **Replace Firebase Auth**
```javascript
// OLD CODE
await firebase.auth().sendSignInLinkToEmail(email);

// NEW CODE
await fetch('/api/simple-otp/generate', {
  method: 'POST',
  body: JSON.stringify({
    identifier: email,
    type: 'email',
    purpose: 'verification'
  })
});
```

### **Replace Auth0**
```javascript
// OLD CODE
await auth0.sendOTP(email, code);

// NEW CODE
await fetch('/api/simple-otp/generate', {
  method: 'POST',
  body: JSON.stringify({
    identifier: email,
    type: 'email',
    purpose: 'verification'
  })
});
```

---

## 📊 **Monitoring & Maintenance**

### **Automatic Cleanup**
The system automatically cleans up expired OTP codes. You can also trigger manual cleanup:

```bash
# Manual cleanup
curl http://localhost:3000/api/simple-otp/cleanup
```

### **Statistics**
```bash
# Get OTP usage statistics
curl http://localhost:3000/api/simple-otp/stats
```

### **Logs**
All OTP operations are logged. Check your application logs for:
- OTP generation events
- Verification attempts
- Failed attempts
- Email delivery status

---

## 🚨 **Troubleshooting**

### **Emails Not Sending**
1. Check your hosting control panel for email settings
2. Verify SMTP credentials (if using relay)
3. Check spam/junk folders
4. Test with a simple email first

### **OTP Verification Failing**
1. Check code expiry (10 minutes default)
2. Verify code format (6 digits)
3. Check for typos in email/phone
4. Review attempt limits (3 max)

### **Database Issues**
1. Run Prisma migrations: `npx prisma migrate deploy`
2. Regenerate client: `npx prisma generate`
3. Check database connection

---

## 🎯 **Success Checklist**

- [ ] Environment variables configured
- [ ] Database migration completed
- [ ] Email configuration tested
- [ ] OTP generation working
- [ ] OTP verification working
- [ ] Old third-party calls replaced
- [ ] Testing completed
- [ ] Monitoring set up

---

## 💡 **Pro Tips**

1. **Test thoroughly** before going live
2. **Monitor email deliverability** in your hosting panel
3. **Set up alerts** for failed OTP deliveries
4. **Regular cleanup** of expired codes
5. **Backup your database** regularly

---

## 🎉 **You're Done!**

**You now have a completely self-hosted OTP system that:**
- ✅ Eliminates third-party authentication costs
- ✅ Works perfectly with traditional hosting
- ✅ Provides enterprise-grade security
- ✅ Requires zero infrastructure changes
- ✅ Saves you $70-400/month

**No more vendor lock-in. No more unpredictable costs. Complete control over your authentication.**

**Welcome to financial freedom!** 🇺🇸💰