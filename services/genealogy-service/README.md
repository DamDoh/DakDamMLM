# Genealogy Service

A microservice for managing MLM network structures, genealogy trees, and downline operations.

## Features

- **Genealogy Tree Management**: Build and traverse hierarchical network structures
- **Downline Analytics**: Comprehensive statistics and reporting
- **Placement Operations**: Move users within the network hierarchy
- **Upline Tracking**: Navigate sponsor chains and ancestry
- **Security**: JWT-based authentication with role-based access control

## API Endpoints

### Authentication Required
All endpoints require a valid JWT token in the Authorization header.
Users can only access their own data or admin can access any user's data.

### GET /api/genealogy/tree/:userId
Get the genealogy tree for a specific user.

**Query Parameters:**
- `depth` (optional): Maximum tree depth (1-10, default: 3)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-123",
    "memberId": "M001",
    "fullName": "John Doe",
    "rank": "Bronze",
    "pv": 100,
    "joinDate": "2023-01-01T00:00:00.000Z",
    "position": null,
    "children": [
      {
        "id": "user-456",
        "memberId": "M002",
        "fullName": "Jane Smith",
        "rank": "Silver",
        "pv": 150,
        "joinDate": "2023-02-01T00:00:00.000Z",
        "position": "left",
        "children": [],
        "level": 1,
        "active": true
      }
    ],
    "level": 0,
    "active": true
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-123"
}
```

**Error Responses:**
- `403 Forbidden`: Access denied (not owner or admin)
- `404 Not Found`: User not found

### GET /api/genealogy/downline/:userId
Get downline members for a user.

**Query Parameters:**
- `maxLevel` (optional): Maximum levels to traverse
- `includeStats` (optional): Include statistics in response (true/false)
- `includeInactive` (optional): Include inactive members (true/false, default: false)

**Response:**
```json
{
  "success": true,
  "data": {
    "downline": [
      {
        "id": "user-456",
        "memberId": "M002",
        "fullName": "Jane Smith",
        "rank": "Silver",
        "pv": 150,
        "joinDate": "2023-02-01T00:00:00.000Z",
        "active": true,
        "level": 1,
        "position": "left"
      }
    ],
    "stats": {
      "totalMembers": 1,
      "activeMembers": 1,
      "totalPV": 150,
      "activePV": 150,
      "averagePV": 150,
      "levels": [{"level": 1, "count": 1, "activeCount": 1}],
      "leftLeg": 1,
      "rightLeg": 0,
      "legBalance": 0,
      "inactiveMembers": 0
    }
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-124"
}
```

### GET /api/genealogy/upline/:userId
Get the upline (sponsor chain) for a user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user-123",
      "memberId": "M001",
      "fullName": "John Doe",
      "rank": "Bronze",
      "pv": 100,
      "joinDate": "2023-01-01T00:00:00.000Z",
      "sponsorId": "user-789"
    },
    {
      "id": "user-789",
      "memberId": "M003",
      "fullName": "Bob Johnson",
      "rank": "Gold",
      "pv": 500,
      "joinDate": "2022-01-01T00:00:00.000Z",
      "sponsorId": null
    }
  ],
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-125"
}
```

### POST /api/genealogy/move
Move a user to a new position in the network. (Admin only)

**Request Body:**
```json
{
  "userId": "user-456",
  "newParentId": "user-789",
  "position": "left"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Downline moved successfully",
    "oldParent": "user-123",
    "newParent": "user-789",
    "position": "left"
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-126"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid move (position occupied, circular reference)
- `403 Forbidden`: Not admin user
- `404 Not Found`: User or new parent not found

### GET /api/genealogy/stats/:userId
Get comprehensive genealogy statistics for a user.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalDownline": 15,
    "activeDownline": 12,
    "levels": 4,
    "leftLeg": 8,
    "rightLeg": 7,
    "totalPV": 2500,
    "activePV": 2100,
    "averagePV": 166.67,
    "growthRate": 80
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-127"
}
```

### GET /api/genealogy/placement/:userId
Get placement information for a user.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user-456",
    "sponsor": {
      "id": "user-123",
      "fullName": "John Doe",
      "memberId": "M001"
    },
    "placementParent": {
      "id": "user-789",
      "fullName": "Bob Johnson",
      "memberId": "M003"
    },
    "position": "left",
    "children": {
      "left": null,
      "right": "user-999"
    }
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-128"
}
```

### GET /api/genealogy/binary-tree/:userId
Get binary tree structure for a user (focused on direct left/right children).

**Query Parameters:**
- `depth` (optional): Maximum tree depth (1-10, default: 3)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-123",
    "memberId": "M001",
    "fullName": "John Doe",
    "rank": "Bronze",
    "pv": 100,
    "joinDate": "2023-01-01T00:00:00.000Z",
    "position": null,
    "children": [
      {
        "id": "user-456",
        "memberId": "M002",
        "fullName": "Jane Smith",
        "rank": "Silver",
        "pv": 150,
        "joinDate": "2023-02-01T00:00:00.000Z",
        "position": "left",
        "children": [],
        "level": 1,
        "active": true
      }
    ],
    "level": 0,
    "active": true
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-130"
}
```

### GET /api/genealogy/downline-paginated/:userId
Get paginated downline members with sorting and filtering.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)
- `includeInactive` (optional): Include inactive members (true/false, default: false)
- `sortBy` (optional): Sort field ('joinDate', 'pv', 'rank', default: 'joinDate')
- `sortOrder` (optional): Sort order ('asc', 'desc', default: 'desc')

**Response:**
```json
{
  "success": true,
  "data": {
    "downline": [
      {
        "id": "user-456",
        "memberId": "M002",
        "fullName": "Jane Smith",
        "rank": "Silver",
        "pv": 150,
        "joinDate": "2023-02-01T00:00:00.000Z",
        "active": true,
        "level": 1,
        "position": "left"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 25,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    },
    "summary": {
      "totalMembers": 25,
      "activeMembers": 20,
      "totalPV": 5000
    }
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-131"
}
```

### POST /api/genealogy/validate-placement
Validate a potential placement move before executing it. (Admin only)

**Request Body:**
```json
{
  "userId": "user-456",
  "newParentId": "user-789",
  "position": "left"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-132"
}
```

**Error Response:**
```json
{
  "success": true,
  "data": {
    "valid": false,
    "reason": "Position left is already occupied"
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-133"
}
```

### GET /api/genealogy/metrics/:userId
Get advanced genealogy metrics and analytics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalDownline": 15,
    "activeDownline": 12,
    "levels": 4,
    "leftLeg": 8,
    "rightLeg": 7,
    "totalPV": 2500,
    "activePV": 2100,
    "averagePV": 166.67,
    "growthRate": 80,
    "recentJoins": 3,
    "topPerformers": [
      {
        "id": "user-456",
        "memberId": "M002",
        "fullName": "Jane Smith",
        "pv": 500,
        "rank": "Gold"
      }
    ],
    "growthVelocity": 2.5,
    "retentionRate": 85.7
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-134"
}
```

### POST /api/genealogy/bulk-update
Perform bulk operations on genealogy data. (Admin only)

**Request Body:**
```json
{
  "operations": [
    {
      "type": "move",
      "userId": "user-456",
      "data": {
        "newParentId": "user-789",
        "position": "left"
      }
    },
    {
      "type": "activate",
      "userId": "user-999"
    },
    {
      "type": "deactivate",
      "userId": "user-888"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": 2,
    "failed": 1,
    "errors": [
      "Operation move for user user-456: Position left is already occupied"
    ]
  },
  "timestamp": "2023-12-01T10:00:00.000Z",
  "requestId": "req-135"
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
  "requestId": "req-136"
}
```

### GET /api/genealogy/downline/:userId
Get downline members for a user.

**Query Parameters:**
- `maxLevel` (optional): Maximum levels to traverse
- `includeStats` (optional): Include statistics in response

### GET /api/genealogy/upline/:userId
Get the upline (sponsor chain) for a user.

### POST /api/genealogy/move
Move a user to a new position in the network. (Admin only)

**Request Body:**
```json
{
  "userId": "user-123",
  "newParentId": "user-456",
  "position": "left"
}
```

### GET /api/genealogy/stats/:userId
Get comprehensive genealogy statistics for a user.

### GET /api/genealogy/placement/:userId
Get placement information for a user.

## Data Models

### GenealogyNode
```typescript
interface GenealogyNode {
  id: string;
  memberId: string;
  fullName: string;
  rank: string;
  pv: number;
  joinDate: string;
  position: 'left' | 'right' | null;
  children: GenealogyNode[];
  level: number;
  active: boolean;
}
```

### GenealogyStats
```typescript
interface GenealogyStats {
  totalDownline: number;
  activeDownline: number;
  levels: number;
  leftLeg: number;
  rightLeg: number;
  totalPV: number;
  activePV: number;
  averagePV: number;
  growthRate: number;
}
```

## Environment Variables

- `PORT`: Service port (default: 3003)
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `RABBITMQ_URL`: RabbitMQ connection string
- `JWT_SECRET`: JWT signing secret
- `NODE_ENV`: Environment (development/production)
- `ALLOWED_ORIGINS`: CORS allowed origins (comma-separated)

## Development

### Prerequisites
- Node.js 18+
- PostgreSQL
- Redis (optional)
- RabbitMQ (optional)

### Installation
```bash
npm install
```

### Running
```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

### Testing
```bash
npm test
npm run test:watch
```

## Docker

### Build
```bash
docker build -t genealogy-service .
```

### Run
```bash
docker run -p 3003:3003 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="your-secret" \
  genealogy-service
```

## Architecture

### Layers
1. **Routes**: HTTP endpoint definitions with middleware
2. **Controllers**: Request/response handling and validation
3. **Services**: Business logic and orchestration
4. **Repositories**: Data access abstraction

### Middleware
- **Authentication**: JWT token validation
- **Authorization**: Role-based access control
- **Validation**: Input sanitization and validation
- **Logging**: Request/response logging
- **Rate Limiting**: DDoS protection

### Error Handling
- Structured error responses
- Request ID tracking
- Development vs production error details
- Comprehensive logging

## Security

- JWT-based authentication
- Role-based access control (User/Admin)
- Input validation and sanitization
- Rate limiting
- CORS configuration
- Helmet security headers
- SQL injection prevention via Prisma ORM

## Performance

- Database query optimization
- Redis caching (planned)
- Pagination for large datasets
- Efficient tree traversal algorithms
- Connection pooling

## Monitoring

- Health check endpoints
- Request logging
- Error tracking
- Performance metrics (planned)

## Future Enhancements

- [ ] Redis caching for frequently accessed trees
- [ ] Bulk operations for large networks
- [ ] Genealogy visualization endpoints
- [ ] Advanced analytics and reporting
- [ ] Event-driven updates via RabbitMQ
- [ ] Genealogy tree compression for large networks