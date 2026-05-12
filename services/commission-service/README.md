# Commission Service

A microservice for managing commission calculations, payments, and analytics in the MLM platform.

## Features

- Commission calculation based on business rules
- Multi-level residual commission processing
- Commission analytics and reporting
- Batch commission processing
- Top earners identification
- Comprehensive pagination and filtering

## API Endpoints

### Authentication Required
All endpoints require a valid JWT token in the Authorization header.
Users can only access their own data or admin can access any user's data.

### POST /api/commissions/calculate
Calculate commission for a user based on an order.

**Request Body:**
```json
{
  "userId": "user-123",
  "orderId": "order-456",
  "amount": 1000.00
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "commission-789",
    "userId": "user-123",
    "orderId": "order-456",
    "amount": 50.00,
    "type": "direct",
    "status": "Pending",
    "date": "2023-12-01T10:00:00.000Z"
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-123"
}
```

### GET /api/commissions/user/:userId
Get paginated commissions for a specific user with filtering and sorting.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `status` (optional): Filter by status ('Pending', 'Paid', 'Failed')
- `type` (optional): Filter by type ('direct', 'residual_level_1', etc.)
- `sortBy` (optional): Sort field ('date', 'amount', 'status', default: 'date')
- `sortOrder` (optional): Sort order ('asc', 'desc', default: 'desc')

**Response:**
```json
{
  "success": true,
  "data": {
    "commissions": [
      {
        "id": "commission-789",
        "userId": "user-123",
        "orderId": "order-456",
        "amount": 50.00,
        "type": "direct",
        "status": "Paid",
        "date": "2023-12-01T10:00:00.000Z",
        "user": {
          "id": "user-123",
          "fullName": "John Doe",
          "memberId": "M001",
          "rank": "Bronze"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    },
    "summary": {
      "totalAmount": 1250.00,
      "averageAmount": 50.00
    }
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-124"
}
```

### GET /api/commissions/period
Get commissions within a date range. (Admin only)

**Query Parameters:**
- `startDate`: Start date (ISO format)
- `endDate`: End date (ISO format)
- `status` (optional): Filter by status
- `type` (optional): Filter by type

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "commission-789",
      "userId": "user-123",
      "orderId": "order-456",
      "amount": 50.00,
      "type": "direct",
      "status": "Paid",
      "date": "2023-12-01T10:00:00.000Z",
      "user": {
        "id": "user-123",
        "fullName": "John Doe",
        "memberId": "M001"
      }
    }
  ],
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-125"
}
```

### POST /api/commissions/process-batch
Process commissions for multiple orders. (Admin only)

**Request Body:**
```json
{
  "orders": [
    {
      "userId": "user-123",
      "id": "order-456",
      "amount": 1000.00
    },
    {
      "userId": "user-789",
      "id": "order-101",
      "amount": 1500.00
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "processed": 2,
    "failed": 0
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-126"
}
```

### GET /api/commissions/summary/:userId
Get commission summary for a user within a time period.

**Query Parameters:**
- `period` (optional): Time period ('week', 'month', 'year', default: 'month')

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "totalAmount": 1250.00,
    "count": 25,
    "averageAmount": 50.00,
    "startDate": "2023-12-01T00:00:00.000Z",
    "endDate": "2023-12-31T23:59:59.999Z"
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-127"
}
```

### GET /api/commissions/analytics/:userId
Get comprehensive commission analytics for a user.

**Query Parameters:**
- `period` (optional): Time period ('week', 'month', 'year', default: 'month')

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "totalAmount": 1250.00,
    "count": 25,
    "averageAmount": 50.00,
    "startDate": "2023-12-01T00:00:00.000Z",
    "endDate": "2023-12-31T23:59:59.999Z",
    "typeDistribution": {
      "direct": 500.00,
      "residual_level_1": 375.00,
      "residual_level_2": 250.00,
      "residual_level_3": 125.00
    },
    "monthlyTrends": [
      {
        "month": "2023-10",
        "amount": 800.00,
        "count": 16
      },
      {
        "month": "2023-11",
        "amount": 950.00,
        "count": 19
      },
      {
        "month": "2023-12",
        "amount": 1250.00,
        "count": 25
      }
    ],
    "growthRate": 31.58,
    "projectedEarnings": 15000.00
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-128"
}
```

### GET /api/commissions/top-earners
Get top commission earners for a period. (Admin only)

**Query Parameters:**
- `limit` (optional): Number of results (default: 10, max: 100)
- `period` (optional): Time period ('week', 'month', 'quarter', 'year', default: 'month')

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "startDate": "2023-12-01T00:00:00.000Z",
    "endDate": "2023-12-31T23:59:59.999Z",
    "topEarners": [
      {
        "user": {
          "id": "user-123",
          "fullName": "John Doe",
          "memberId": "M001",
          "rank": "Diamond"
        },
        "totalEarnings": 5000.00,
        "commissionCount": 100,
        "averageCommission": 50.00
      },
      {
        "user": {
          "id": "user-456",
          "fullName": "Jane Smith",
          "memberId": "M002",
          "rank": "Gold"
        },
        "totalEarnings": 3750.00,
        "commissionCount": 75,
        "averageCommission": 50.00
      }
    ]
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-129"
}
```

### GET /api/health
Health check endpoint (no authentication required).

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2023-12-01T10:00:00.000Z"
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-130"
}
```

## Commission Calculation Rules

### Direct Commissions
- Base rate: 5% of order amount
- Rank multipliers:
  - Member: 1.0x
  - Bronze: 1.1x
  - Silver: 1.2x
  - Gold: 1.3x
  - Diamond: 1.5x

### Residual Commissions
- Level 1: 3% of order amount
- Level 2: 2% of order amount
- Level 3: 1% of order amount
- Level 4: 0.5% of order amount
- Level 5: 0.2% of order amount

## Development

### Prerequisites
- Node.js 18+
- PostgreSQL
- Redis (optional)

### Installation
```bash
npm install
```

### Environment Setup
Create a `.env` file with the following variables:
```env
PORT=3002
NODE_ENV=development
DATABASE_URL=postgresql://username:password@localhost:5432/database
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672
JWT_SECRET=your-super-secure-jwt-secret
```

### Running Tests
```bash
npm test
npm run test:coverage
npm run test:watch
```

### Running Development Server
```bash
npm run dev
```

### Building for Production
```bash
npm run build
npm start
```

## Docker

### Build Image
```bash
docker build -t commission-service .
```

### Run Container
```bash
docker run -p 3002:3002 commission-service
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3002` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | Optional |
| `JWT_SECRET` | JWT signing secret | Required |

## Error Handling

The service uses structured error responses with appropriate HTTP status codes:

- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server errors

## Performance Considerations

- Pagination for large result sets
- Database query optimization
- Connection pooling
- Caching for frequently accessed data
- Batch processing for bulk operations

## Monitoring

- Health check endpoints
- Structured logging
- Performance metrics
- Error tracking