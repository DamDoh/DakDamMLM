
# DakDam MLM API Endpoints Documentation

This document provides comprehensive API documentation for all endpoints across the DakDam MLM microservices platform.

## Table of Contents

1. [Authentication Endpoints](#authentication-endpoints)
2. [User Service APIs (Port 3001)](#user-service-apis-port-3001)
3. [Commission Service APIs (Port 3002)](#commission-service-apis-port-3002)
4. [Genealogy Service APIs (Port 3003)](#genealogy-service-apis-port-3003)
5. [Payment Service APIs (Port 3004)](#payment-service-apis-port-3004)
6. [Order Service APIs (Port 3005)](#order-service-apis-port-3005)
7. [Notification Service APIs (Port 3006)](#notification-service-apis-port-3006)
8. [Analytics Service APIs (Port 3007)](#analytics-service-apis-port-3007)
9. [OTP Service APIs (Port 3008)](#otp-service-apis-port-3008)
10. [Admin Service APIs (Port 3009)](#admin-service-apis-port-3009)
11. [Company Service APIs (Port 3010)](#company-service-apis-port-3010)
12. [Upload Service APIs (Port 3011)](#upload-service-apis-port-3011)
13. [Migration Service APIs (Port 3012)](#migration-service-apis-port-3012)
14. [API Gateway Endpoints](#api-gateway-endpoints)
15. [Common Patterns](#common-patterns)

---

## Authentication Endpoints

All services use JWT-based authentication. Tokens are obtained from the User Service and validated by individual services.

### Headers
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-Request-ID: <uuid> (auto-generated)
```

### Token Refresh
```http
POST /api/auth/refresh
Authorization: Bearer <refresh_token>
```

---

## User Service APIs (Port 3001)

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "surname": "Doe",
  "phoneNumber": "+1234567890",
  "memberId": "M001",
  "sponsorId": "M002",
  "companyId": "company-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "memberId": "M001",
      "email": "user@example.com",
      "firstName": "John",
      "surname": "Doe",
      "fullName": "John Doe",
      "accountType": "Distributor",
      "rank": "Member",
      "pv": 0,
      "active": true,
      "createdAt": "2024-01-15T10:00:00Z"
    },
    "accessToken": "jwt-token",
    "refreshToken": "refresh-jwt-token"
  }
}
```

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

#### Change Password
```http
POST /api/auth/change-password
Authorization: Bearer <token>

{
  "currentPassword": "oldPassword",
  "newPassword": "newSecurePassword123"
}
```

#### Request Password Reset
```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "email": "user@example.com",
  "companyId": "company-uuid"
}
```

#### Reset Password with OTP
```http
PUT /api/auth/reset-password
Content-Type: application/json

{
  "email": "user@example.com",
  "otpCode": "123456",
  "newPassword": "newSecurePassword123",
  "companyId": "company-uuid"
}
```

### User Management

#### Get Current User Profile
```http
GET /api/users/profile
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "memberId": "M001",
    "email": "user@example.com",
    "firstName": "John",
    "surname": "Doe",
    "phoneNumber": "+1234567890",
    "rank": "Bronze",
    "pv": 150.50,
    "teamSize": { "left": 25, "right": 30, "total": 55 },
    "sponsorId": "M002",
    "placementParentId": "M003",
    "position": "left",
    "active": true,
    "addresses": [...],
    "lastActivityDate": "2024-01-15T10:30:00Z"
  }
}
```

#### Update User Profile
```http
PUT /api/users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "Johnny",
  "phoneNumber": "+1987654321",
  "addresses": [
    {
      "type": "home",
      "street": "123 Main St",
      "city": "Anytown",
      "country": "US",
      "postalCode": "12345"
    }
  ]
}
```

#### Get User Genealogy Tree
```http
GET /api/users/genealogy/tree?depth=3&includeInactive=false
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "member": { /* current user data */ },
    "children": {
      "left": { /* left leg root */ },
      "right": { /* right leg root */ }
    },
    "stats": {
      "totalMembers": 55,
      "activeMembers": 42,
      "leftLegSize": 25,
      "rightLegSize": 30,
      "maxDepth": 8
    }
  }
}
```

#### Get Genealogy Statistics
```http
GET /api/users/genealogy/stats
Authorization: Bearer <token>
```

---

## Commission Service APIs (Port 3002)

### Commission Calculations

#### Calculate Commissions for Order
```http
POST /api/commissions/calculate
Authorization: Bearer <token>
Content-Type: application/json

{
  "orderId": "order-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "commission-uuid",
      "userId": "user-uuid",
      "memberId": "M001",
      "type": "binary_bonus",
      "amount": 25.50,
      "level": 1,
      "description": "Binary commission from order #12345",
      "status": "pending",
      "periodStart": "2024-01-01T00:00:00Z",
      "periodEnd": "2024-01-31T23:59:59Z",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "summary": {
    "totalCommissions": 5,
    "totalAmount": 125.75,
    "processedAt": "2024-01-15T10:00:05Z"
  }
}
```

#### Get Commissions (with filtering)
```http
GET /api/commissions?page=1&limit=20&status=pending&type=binary_bonus&startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "commissions": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    },
    "summary": {
      "totalAmount": 2500.00,
      "pendingAmount": 500.00,
      "paidAmount": 2000.00
    }
  }
}
```

#### Get User Commissions
```http
GET /api/commissions/user/:userId?page=1&limit=10&status=paid
Authorization: Bearer <token>
```

#### Get User Commission Statistics
```http
GET /api/commissions/stats/:userId?period=month
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "period": "month",
    "currentPeriod": {
      "totalEarned": 450.75,
      "totalPaid": 425.50,
      "pending": 25.25,
      "commissionCount": 12
    },
    "previousPeriod": {
      "totalEarned": 380.25,
      "totalPaid": 380.25,
      "pending": 0,
      "commissionCount": 10
    },
    "yearToDate": {
      "totalEarned": 5200.00,
      "totalPaid": 5100.00,
      "pending": 100.00
    }
  }
}
```

### Commission Rules Management

#### Create Commission Rule
```http
POST /api/commissions/rules
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Binary Commission Rule",
  "type": "binary_bonus",
  "category": "commission",
  "priority": 100,
  "isActive": true,
  "conditions": [
    {
      "type": "rank",
      "operator": "greater_equal",
      "value": "Bronze"
    }
  ],
  "calculation": {
    "type": "percentage",
    "percentage": 10
  },
  "applicableTo": ["distributor"],
  "frequency": "monthly",
  "payoutTiming": "end_of_period"
}
```

#### Get Commission Rules
```http
GET /api/commissions/rules?page=1&limit=20&type=binary_bonus&isActive=true
Authorization: Bearer <token>
```

### Payout Management

#### Create Payout Request
```http
POST /api/payouts
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 500.00,
  "method": "bank_transfer",
  "bankDetails": {
    "accountName": "John Doe",
    "accountNumber": "1234567890",
    "bankName": "Bank of America",
    "routingNumber": "021000021"
  },
  "notes": "Monthly commission payout"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "payout-uuid",
    "userId": "user-uuid",
    "amount": 500.00,
    "method": "bank_transfer",
    "status": "pending",
    "fee": 5.00,
    "estimatedCompletion": "2024-01-20T00:00:00Z",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

#### Get Payouts
```http
GET /api/payouts?page=1&limit=10&status=completed&method=bank_transfer
Authorization: Bearer <token>
```

#### Update Payout Status (Admin)
```http
PUT /api/payouts/:id/status
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "status": "completed",
  "transactionId": "TXN-12345",
  "notes": "Processed via wire transfer"
}
```

### Bonus Management

#### Calculate Bonuses
```http
POST /api/bonuses/calculate
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "period": "2024-01",
  "types": ["leadership_bonus", "matching_bonus"]
}
```

#### Get User Bonuses
```http
GET /api/bonuses/user/:userId?page=1&limit=10&type=leadership_bonus&period=2024-01
Authorization: Bearer <token>
```

### Analytics

#### Get Commission Analytics
```http
GET /api/commissions/analytics?period=month&startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "totalCommissions": 1250,
    "totalAmount": 45000.00,
    "averageCommission": 36.00,
    "topPerformers": [...],
    "commissionTypes": {
      "binary_bonus": { "count": 800, "amount": 28000.00 },
      "matching_bonus": { "count": 350, "amount": 14000.00 },
      "leadership_bonus": { "count": 100, "amount": 3000.00 }
    },
    "trends": {
      "daily": [...],
      "weekly": [...],
      "monthly": [...]
    }
  }
}
```

---

## Genealogy Service APIs (Port 3003)

### Tree Operations

#### Get Genealogy Tree
```http
GET /api/genealogy/tree/:memberId?depth=5&includeInactive=false&includeStats=true
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "root": {
      "id": "user-uuid",
      "memberId": "M001",
      "fullName": "John Doe",
      "rank": "Diamond",
      "pv": 5000,
      "children": {
        "left": {
          "id": "user-uuid-2",
          "memberId": "M002",
          "fullName": "Jane Smith",
          "rank": "Gold",
          "pv": 2500,
          "children": { /* nested structure */ }
        },
        "right": {
          "id": "user-uuid-3",
          "memberId": "M003",
          "fullName": "Bob Johnson",
          "rank": "Silver",
          "pv": 1800,
          "children": { /* nested structure */ }
        }
      }
    },
    "stats": {
      "totalMembers": 156,
      "activeMembers": 142,
      "leftLegSize": 89,
      "rightLegSize": 67,
      "maxDepth": 12,
      "weakestLeg": "right",
      "balanceRatio": 0.75
    }
  }
}
```

#### Get Tree Statistics
```http
GET /api/genealogy/tree/:memberId/stats
Authorization: Bearer <token>
```

#### Compress Inactive Branches
```http
POST /api/genealogy/tree/compress
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "rootMemberId": "M001",
  "inactiveThresholdDays": 90,
  "minCommissionThreshold": 10.00
}
```

### Member Movement

#### Move Member in Tree
```http
POST /api/genealogy/move
Authorization: Bearer <token>
Content-Type: application/json

{
  "memberId": "M005",
  "newParentId": "M010",
  "newPosition": "left",
  "reason": "Optimization for balance",
  "requiresApproval": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "movementId": "movement-uuid",
    "memberId": "M005",
    "oldParentId": "M003",
    "newParentId": "M010",
    "oldPosition": "right",
    "newPosition": "left",
    "status": "pending_approval",
    "requestedBy": "user-uuid",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

#### Approve Movement (Admin)
```http
PUT /api/genealogy/movements/:id/approve
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "approvedBy": "admin-uuid",
  "notes": "Approved for tree balancing"
}
```

#### Get Movement History
```http
GET /api/genealogy/movements?page=1&limit=20&status=completed&startDate=2024-01-01
Authorization: Bearer <token>
```

### Analytics

#### Get Genealogy Growth Analytics
```http
GET /api/genealogy/analytics/growth?period=month&startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "newMembers": 45,
    "activeGrowth": 38,
    "leftLegGrowth": 22,
    "rightLegGrowth": 23,
    "averageDepthIncrease": 1.2,
    "topRecruiters": [
      { "memberId": "M001", "recruits": 12 },
      { "memberId": "M005", "recruits": 8 }
    ],
    "growthRate": 15.5,
    "retentionRate": 84.2
  }
}
```

#### Get Genealogy Health Score
```http
GET /api/genealogy/analytics/health?memberId=M001
Authorization: Bearer <token>
```

---

## Payment Service APIs (Port 3004)

### Wallet Operations

#### Get Wallet Balance
```http
GET /api/wallet/balance
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "walletId": "wallet-uuid",
    "userId": "user-uuid",
    "balance": 1250.75,
    "currency": "USD",
    "isActive": true,
    "lastTransaction": "2024-01-15T09:45:00Z",
    "availableBalance": 1200.75,
    "escrowBalance": 50.00
  }
}
```

#### Get Transaction History
```http
GET /api/wallet/transactions?page=1&limit=20&type=credit&startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "txn-uuid",
        "type": "credit",
        "amount": 100.00,
        "balanceBefore": 1150.75,
        "balanceAfter": 1250.75,
        "description": "Commission payout",
        "referenceId": "commission-uuid",
        "referenceType": "commission",
        "status": "completed",
        "createdAt": "2024-01-15T09:45:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    },
    "summary": {
      "totalCredits": 2500.00,
      "totalDebits": 1250.00,
      "netFlow": 1250.00
    }
  }
}
```

#### Transfer E-cash
```http
POST /api/wallet/transfer
Authorization: Bearer <token>
Content-Type: application/json

{
  "toMemberId": "M005",
  "amount": 100.00,
  "description": "Gift for new member",
  "requiresApproval": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transferId": "transfer-uuid",
    "fromWalletId": "wallet-uuid-1",
    "toWalletId": "wallet-uuid-2",
    "amount": 100.00,
    "fee": 1.00,
    "status": "completed",
    "description": "Gift for new member",
    "completedAt": "2024-01-15T10:00:00Z"
  }
}
```

### Top-up Operations

#### Request E-cash Top-up
```http
POST /api/ecash/topup
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 500.00,
  "paymentMethod": "bank_transfer",
  "proofOfPayment": "file-uuid"
}
```

#### Get Top-up Requests
```http
GET /api/ecash/topup-requests?page=1&limit=10&status=pending
Authorization: Bearer <token>
```

#### Process Top-up Request (Admin)
```http
PUT /api/ecash/topup-requests/:id/status
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "status": "approved",
  "processedBy": "admin-uuid",
  "notes": "Payment verified via bank statement"
}
```

### Financial Controls

#### Place Financial Hold
```http
POST /api/financial-controls/hold
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "userId": "user-uuid",
  "amount": 500.00,
  "reason": "Suspicious activity investigation",
  "durationDays": 7
}
```

#### Release Financial Hold
```http
POST /api/financial-controls/release
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "userId": "user-uuid",
  "holdId": "hold-uuid",
  "reason": "Investigation completed - activity legitimate"
}
```

---

## Order Service APIs (Port 3005)

### Order Management

#### Create Order
```http
POST /api/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    {
      "productId": "product-uuid",
      "quantity": 2,
      "customizations": {
        "color": "blue",
        "size": "large"
      }
    }
  ],
  "shippingAddress": {
    "street": "123 Main St",
    "city": "Anytown",
    "country": "US",
    "postalCode": "12345"
  },
  "billingAddress": { /* same structure */ },
  "paymentMethod": "ecash",
  "notes": "Please handle with care"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "ORD-2024-001",
    "userId": "user-uuid",
    "status": "confirmed",
    "items": [...],
    "subtotal": 150.00,
    "tax": 12.00,
    "shipping": 10.00,
    "total": 172.00,
    "estimatedDelivery": "2024-01-20T00:00:00Z",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
```

#### Get Orders
```http
GET /api/orders?page=1&limit=10&status=shipped&startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <token>
```

#### Get Order Details
```http
GET /api/orders/:id
Authorization: Bearer <token>
```

#### Update Order Status (Admin)
```http
PUT /api/orders/:id/status
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "status": "shipped",
  "trackingNumber": "1Z999AA1234567890",
  "carrier": "UPS",
  "notes": "Package shipped from warehouse"
}
```

### Product Management

#### Get Products
```http
GET /api/products?page=1&limit=20&category=supplements&minPrice=10&maxPrice=100&inStock=true
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "product-uuid",
        "name": "Premium Protein Powder",
        "description": "High-quality whey protein...",
        "price": 49.99,
        "pv": 25,
        "category": "supplements",
        "imageUrl": "https://cdn.example.com/product.jpg",
        "inStock": true,
        "stockQuantity": 150,
        "rating": 4.5,
        "reviews": 89
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

#### Get Product Details
```http
GET /api/products/:id
Authorization: Bearer <token>
```

### Inventory Management

#### Get Inventory Levels
```http
GET /api/inventory?lowStock=true&category=supplements
Authorization: Bearer <token>
```

#### Request Stock
```http
POST /api/stock-requests
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    {
      "productId": "product-uuid",
      "requestedQuantity": 50,
      "priority": "high"
    }
  ],
  "notes": "Needed for upcoming promotion"
}
```

#### Process Stock Request (Admin)
```http
PUT /api/stock-requests/:id/status
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "status": "approved",
  "approvedItems": [
    {
      "productId": "product-uuid",
      "approvedQuantity": 50
    }
  ],
  "processedBy": "admin-uuid"
}
```

---

## Notification Service APIs (Port 3006)

### Notification Operations

#### Send Notification
```http
POST /api/notifications/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "user-uuid",
  "type": "email",
  "category": "commission",
  "title": "Commission Paid",
  "body": "Your commission of $150.00 has been paid to your account.",
  "data": {
    "commissionId": "commission-uuid",
    "amount": 150.00
  },
  "priority": "medium"
}
```

#### Get Notifications
```http
GET /api/notifications?page=1&limit=20&isRead=false&category=commission&startDate=2024-01-01
Authorization: Bearer <token>
```

#### Mark Notification as Read
```http
PUT /api/notifications/:id/read
Authorization: Bearer <token>
```

### Template Management

#### Create Notification Template
```http
POST /api/notification-templates
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Commission Paid Template",
  "type": "email",
  "category": "commission",
  "subject": "Commission Payment Notification",
  "body": "Dear {{firstName}},\n\nYour commission of ${{amount}} has been paid to your account.\n\nBest regards,\n{{companyName}}",
  "variables": ["firstName", "amount", "companyName"],
  "isActive": true
}
```

#### Get Templates
```http
GET /api/notification-templates?page=1&limit=10&type=email&category=commission
Authorization: Bearer <token>
```

### Preferences

#### Get User Preferences
```http
GET /api/notification-preferences
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "email": {
      "commission": true,
      "order": true,
      "system": true
    },
    "sms": {
      "commission": false,
      "order": true,
      "system": true
    },
    "push": {
      "commission": true,
      "order": true,
      "system": false
    },
    "frequency": "immediate",
    "quietHours": {
      "enabled": true,
      "start": "22:00",
      "end": "08:00"
    }
  }
}
```

#### Update Preferences
```http
PUT /api/notification-preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": {
    "commission": true,
    "order": false
  },
  "quietHours": {
    "enabled": true,
    "start": "23:00",
    "end": "07:00"
  }
}
```

---

## Analytics Service APIs (Port 3007)

### Key Metrics

#### Get Key Business Metrics
```http
GET /api/analytics/key-metrics?period=month&companyId=company-uuid
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "revenue": {
      "total": 125000.00,
      "growth": 15.5,
      "averageOrderValue": 89.50
    },
    "users": {
      "total": 2500,
      "active": 2100,
      "new": 150,
      "retention": 84.2
    },
    "commissions": {
      "totalPaid": 37500.00,
      "averageCommission": 45.75,
      "topEarner": "M001"
    },
    "products": {
      "totalSold": 1400,
      "topProduct": "Premium Protein",
      "inventoryTurnover": 12.5
    }
  }
}
```

#### Get Growth Analytics
```http
GET /api/analytics/growth?period=quarter&startDate=2024-01-01&endDate=2024-03-31
Authorization: Bearer <token>
```

#### Get Business Health Score
```http
GET /api/analytics/health-score?companyId=company-uuid
Authorization: Bearer <token>
```

### Reports

#### Generate Custom Report
```http
POST /api/analytics/reports/custom
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Q1 Performance Report",
  "type": "comprehensive",
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-03-31"
  },
  "metrics": ["revenue", "users", "commissions", "products"],
  "groupBy": "month",
  "format": "pdf"
}
```

#### Get Scheduled Reports
```http
GET /api/analytics/reports/scheduled?page=1&limit=10&status=completed
Authorization: Bearer <token>
```

### Real-time Data

#### Get Real-time Metrics Stream
```http
GET /api/analytics/realtime?metrics=revenue,users,orders
Authorization: Bearer <token>
```

**Response (Server-Sent Events):**
```json
{
  "timestamp": "2024-01-15T10:00:00Z",
  "metrics": {
    "revenue": { "current": 125000.00, "change": 2.5 },
    "users": { "current": 2500, "change": 1.2 },
    "orders": { "current": 1400, "change": -0.5 }
  }
}
```

---

## OTP Service APIs (Port 3008)

### OTP Operations

#### Generate OTP
```http
POST /api/otp/generate
Content-Type: application/json

{
  "identifier": "user@example.com",
  "type": "email",
  "purpose": "password_reset",
  "companyId": "company-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "otpId": "otp-uuid",
    "identifier": "user@example.com",
    "type": "email",
    "purpose": "password_reset",
    "expiresAt": "2024-01-15T10:10:00Z",
    "attemptsRemaining": 3
  }
}
```

#### Verify OTP
```http
POST /api/otp/verify
Content-Type: application/json

{
  "identifier": "user@example.com",
  "otpCode": "123456",
  "purpose": "password_reset",
  "companyId": "company-uuid"
}
```

#### Get Delivery Logs
```http
GET /api/otp/delivery-logs?page=1&limit=20&startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <admin-token>
```

### Configuration

#### Get OTP Settings
```http
GET /api/otp/settings?companyId=company-uuid
Authorization: Bearer <admin-token>
```

#### Update OTP Settings
```http
PUT /api/otp/settings
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "companyId": "company-uuid",
  "emailEnabled": true,
  "smsEnabled": true,
  "codeLength": 6,
  "codeExpiryMinutes": 10,
  "maxAttempts": 3,
  "rateLimitPerHour": 5,
  "rateLimitPerDay": 20
}
```

---

## Admin Service APIs (Port 3009)

### User Management

#### List All Users
```http
GET /api/admin/users?page=1&limit=20&companyId=company-uuid&active=true&rank=Gold
Authorization: Bearer <admin-token>
```

#### Get User Details
```http
GET /api/admin/users/:id?includeGenealogy=true&includeCommissions=true
Authorization: Bearer <admin-token>
```

#### Update User (Admin)
```http
PUT /api/admin/users/:id
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "rank": "Platinum",
  "active": true,
  "isAdmin": false,
  "notes": "Promoted for outstanding performance"
}
```

#### Bulk User Operations
```http
POST /api/admin/users/bulk
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "operation": "update_rank",
  "userIds": ["user-uuid-1", "user-uuid-2"],
  "data": {
    "rank": "Gold",
    "effectiveDate": "2024-02-01"
  }
}
```

### System Management

#### Get System Health
```http
GET /api/admin/system/health
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overall": "healthy",
    "services": {
      "user-service": "healthy",
      "commission-service": "healthy",
      "database": "healthy",
      "redis": "healthy"
    },
    "metrics": {
      "uptime": "15d 4h 30m",
      "cpu": 45.2,
      "memory": 62.8,
      "disk": 78.5
    },
    "alerts": [
      {
        "id": "alert-uuid",
        "severity": "warning",
        "message": "High memory usage on commission-service",
        "createdAt": "2024-01-15T08:30:00Z"
      }
    ]
  }
}
```

#### Get Audit Logs
```http
GET /api/admin/audit-logs?page=1&limit=50&entity=user&action=update&startDate=2024-01-01&userId=user-uuid
Authorization: Bearer <admin-token>
```

---

## Company Service APIs (Port 3010)

### Company Management

#### Create Company
```http
POST /api/companies
Authorization: Bearer <super-admin-token>
Content-Type: application/json

{
  "name": "New MLM Company",
  "domain": "newcompany.mlmdakdam.com",
  "description": "Binary MLM company for health products",
  "primaryColor": "#3B82F6",
  "secondaryColor": "#1F2937",
  "currency": "USD",
  "timezone": "America/New_York",
  "allowEmailLogin": true,
  "allowPhoneLogin": true,
  "requireEmailVerification": true
}
```

#### Get Companies
```http
GET /api/companies?page=1&limit=10&isActive=true&industry=health
Authorization: Bearer <admin-token>
```

#### Get Company Details
```http
GET /api/companies/:id?includeStats=true&includeUsers=true
Authorization: Bearer <token>
```

#### Update Company
```http
PUT /api/companies/:id
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Updated Company Name",
  "logoUrl": "https://cdn.example.com/logo.png",
  "customCss": ".header { background: #000; }",
  "loginPageConfig": {
    "showSlogan": true,
    "slogan": "Build Your Future Today"
  }
}
```

### Company Configuration

#### Get Company Config
```http
GET /api/companies/:id/config
Authorization: Bearer <admin-token>
```

#### Update Company Config
```http
PUT /api/companies/:id/config
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "enabledRuleTypes": ["binary_bonus", "matching_bonus", "leadership_bonus"],
  "maxExecutionTime": 5000,
  "auditEnabled": true,
  "customCalculationTypes": [...],
  "globalOverrides": {
    "defaultCommissionPercentage": 12
  }
}
```

#### Get Company Statistics
```http
GET /api/companies/:id/stats?period=month&includeUsers=true&includeRevenue=true
Authorization: Bearer <token>
```

---

## Upload Service APIs (Port 3011)

### File Operations

#### Upload File
```http
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

# Form data:
# file: <binary file data>
# type: profile_image
# metadata: {"alt": "Profile picture"}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fileId": "file-uuid",
    "filename": "profile.jpg",
    "originalName": "my-photo.jpg",
    "mimeType": "image/jpeg",
    "size": 245760,
    "url": "https://cdn.example.com/files/file-uuid.jpg",
    "thumbnailUrl": "https://cdn.example.com/files/file-uuid_thumb.jpg",
    "uploadedBy": "user-uuid",
    "uploadedAt": "2024-01-15T10:00:00Z"
  }
}
```

#### Get File Info
```http
GET /api/upload/:id
Authorization: Bearer <token>
```

#### Download File
```http
GET /api/upload/:id/download
Authorization: Bearer <token>
```

#### Delete File
```http
DELETE /api/upload/:id
Authorization: Bearer <token>
```

### Batch Operations

#### Batch Upload
```http
POST /api/upload/batch
Authorization: Bearer <token>
Content-Type: multipart/form-data

# Multiple files with same field name: files[]
```

#### Batch Delete
```http
DELETE /api/upload/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "fileIds": ["file-uuid-1", "file-uuid-2", "file-uuid-3"]
}
```

---

## Migration Service APIs (Port 3012)

### Migration Operations

#### Start Migration
```http
POST /api/migrations
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Firebase to PostgreSQL Migration",
  "type": "data_import",
  "source": "firebase",
  "target": "postgresql",
  "config": {
    "firebaseProjectId": "old-mlm-project",
    "batchSize": 1000,
    "validateData": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "migrationId": "migration-uuid",
    "status": "running",
    "progress": {
      "current": 0,
      "total": 50000,
      "percentage": 0
    },
    "startedAt": "2024-01-15T10:00:00Z",
    "estimatedCompletion": "2024-01-15T12:00:00Z"
  }
}
```

#### Get Migration Status
```http
GET /api/migrations/:id
Authorization: Bearer <admin-token>
```

#### List Migrations
```http
GET /api/migrations?page=1&limit=10&status=completed&type=data_import
Authorization: Bearer <admin-token>
```

#### Cancel Migration
```http
PUT /api/migrations/:id/cancel
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "reason": "User requested cancellation"
}
```

### Data Operations

#### Validate Migration Data
```http
POST /api/migrations/validate
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "data": [...], // Sample data to validate
  "rules": {
    "requiredFields": ["email", "firstName"],
    "fieldTypes": { "email": "string", "pv": "number" },
    "customValidations": [...]
  }
}
```

#### Transform Data
```http
POST /api/migrations/transform
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "data": [...], // Raw data
  "transformations": [
    {
      "field": "fullName",
      "operation": "split",
      "config": { "separator": " ", "targetFields": ["firstName", "lastName"] }
    }
  ]
}
```

#### Import Data
```http
POST /api/migrations/import
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "migrationId": "migration-uuid",
  "data": [...], // Transformed data ready for import
  "options": {
    "skipDuplicates": true,
    "updateExisting": false,
    "batchSize": 100
  }
}
```

---

## API Gateway Endpoints

The API Gateway (Next.js) provides unified access to all microservices and serves the frontend.

### Authentication Routes
```typescript
POST   /api/auth/login                 // User login
POST   /api/auth/register              // User registration
POST   /api/auth/refresh               // Token refresh
POST   /api/auth/logout                // User logout
GET    /api/auth/me                    // Get current user
```

### Dashboard Routes
```typescript
GET    /api/dashboard                  // User dashboard data
GET    /api/dashboard/stats            // Dashboard statistics
GET    /api/dashboard/recent-activity  // Recent user activity
```

### Business Rules Routes
```typescript
GET    /api/business-rules             // List business rules
POST   /api/business-rules             // Create rule
GET    /api/business-rules/:id         // Get rule
PUT    /api/business-rules/:id         // Update rule
DELETE /api/business-rules/:id         // Delete rule
POST   /api/business-rules/simulate    // Simulate rule execution
```

### E-commerce Routes
```typescript
GET    /api/products                   // List products
GET    /api/products/:id               // Get product
GET    /api/cart                       // Get cart
POST   /api/cart/items                 // Add to cart
PUT    /api/cart/items/:id             // Update cart item
DELETE /api/cart/items/:id             // Remove from cart
POST   /api/checkout                   // Process checkout
```

### Genealogy Routes
```typescript
GET    /api/genealogy/tree             // Get user's tree
GET    /api/genealogy/stats            // Get genealogy stats
POST   /api/genealogy/move             // Move member (with approval)
```

### Commission Routes
```typescript
GET    /api/commissions                // List commissions
GET    /api/commissions/:id            // Get commission
GET    /api/commissions/stats          // Commission statistics
```

### Wallet Routes
```typescript
GET    /api/ecash-balance              // Get e-cash balance
POST   /api/ecash-transfer             // Transfer e-cash
GET    /api/ecash-transactions         // Transaction history
```

### Admin Routes
```typescript
GET    /api/admin/dashboard            // Admin dashboard
GET    /api/admin/users                // User management
GET    /api/admin/companies            // Company management
GET    /api/admin/reports              // System reports
GET    /api/admin/audit-logs           // Audit logs
```

---

## Common Patterns

### Pagination
All list endpoints support pagination:
```http
GET /api/resource?page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Filtering
Most list endpoints support filtering:
```http
GET /api/commissions?status=paid&type=binary_bonus&startDate=2024-01-01&endDate=2024-01-31
```

### Sorting
List endpoints support sorting:
```http
GET /api/users?sortBy=createdAt&sortOrder=desc
```

### Error Responses
All endpoints return consistent error format:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { /* optional */ },
  "timestamp": "2024-01-15T10:00:00Z",
  "requestId": "req-uuid"
}
```

### Rate Limiting
All endpoints include rate limit headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640995200
```

### Request IDs
All responses include request tracking:
```json
{
  "success": true,
  "data": { /* ... */ },
  "requestId": "req-uuid",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

### Data Validation
All endpoints validate input data using Zod schemas with detailed error messages.

### Caching
GET endpoints may include cache headers:
```http
Cache-Control: public, max-age=300
ETag: "etag-value"
```

This