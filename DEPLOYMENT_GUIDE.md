# 🚀 **Business Rules System - Deployment Guide**

## 📋 **Pre-Deployment Checklist**

### **Environment Requirements**
- [ ] Node.js 18.0 or higher
- [ ] PostgreSQL 13+ database
- [ ] Redis 6+ (optional, for enhanced caching)
- [ ] 2GB RAM minimum (4GB recommended)
- [ ] 10GB storage for database and logs

### **Database Setup**
- [ ] PostgreSQL server running
- [ ] Database user with full permissions
- [ ] Connection string configured
- [ ] Database migrations ready

### **Application Configuration**
- [ ] Environment variables set
- [ ] Database connection tested
- [ ] Admin user credentials prepared
- [ ] SSL certificates configured (production)

## 🛠️ **Step-by-Step Deployment**

### **1. Environment Setup**

#### **Development Environment**
```bash
# Clone repository
git clone <repository-url>
cd business-rules-system

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Configure environment variables
nano .env.local
```

#### **Environment Variables**
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/business_rules_db"

# Redis (optional)
REDIS_URL="redis://localhost:6379"

# Authentication
NEXTAUTH_SECRET="your-super-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Application
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Email (optional)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

### **2. Database Setup**

#### **Create Database**
```sql
-- Create database
CREATE DATABASE business_rules_db;

-- Create user (optional)
CREATE USER br_user WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE business_rules_db TO br_user;
```

#### **Run Migrations**
```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# (Optional) Seed initial data
npx prisma db seed
```

#### **Verify Database Connection**
```bash
# Test connection
npx prisma db push --preview-feature
```

### **3. Application Build**

#### **Development Mode**
```bash
# Start development server
npm run dev

# Server will be available at http://localhost:3000
```

#### **Production Build**
```bash
# Build for production
npm run build

# Start production server
npm start

# Or use PM2 for process management
npm install -g pm2
pm2 start npm --name "business-rules" -- start
pm2 save
pm2 startup
```

### **4. Admin Setup**

#### **Create Admin User**
1. Navigate to `/admin` in your browser
2. Register as the first user (automatically becomes admin)
3. Or use the admin registration endpoint

#### **Initial Configuration**
1. Access Business Rules dashboard at `/admin/business-rules`
2. Create your first compensation plan using templates
3. Test rules with the simulation tool
4. Deploy rules to production

## 🔧 **Configuration Options**

### **Rule Engine Configuration**
```typescript
// src/lib/config/rule-engine.ts
export const ruleEngineConfig = {
  // Performance settings
  maxExecutionTime: 5000, // 5 seconds
  cacheSize: 10000, // 10k rules in cache
  enableRedisCache: true,

  // Validation settings
  strictValidation: true,
  conflictDetection: true,
  performanceMonitoring: true,

  // Logging settings
  logLevel: 'info',
  auditTrail: true,
  performanceMetrics: true
};
```

### **Database Optimization**
```sql
-- Create indexes for performance
CREATE INDEX idx_business_rules_active ON business_rules(is_active);
CREATE INDEX idx_business_rules_type ON business_rules(type);
CREATE INDEX idx_business_rules_priority ON business_rules(priority);
CREATE INDEX idx_rule_execution_logs_member ON rule_execution_logs(member_id);
CREATE INDEX idx_rule_execution_logs_period ON rule_execution_logs(period_start, period_end);
```

### **Redis Configuration (Optional)**
```javascript
// redis-config.js
module.exports = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: 0,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
};
```

## 🧪 **Testing & Validation**

### **Pre-Production Testing**

#### **1. Unit Tests**
```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --testPathPattern=rule-engine
npm test -- --testPathPattern=api
```

#### **2. Integration Tests**
```bash
# Test API endpoints
npm run test:integration

# Test database operations
npm run test:database
```

#### **3. Performance Tests**
```bash
# Load testing
npm run test:load

# Stress testing
npm run test:stress
```

### **Rule Validation Checklist**
- [ ] All rule types working correctly
- [ ] Condition evaluation accurate
- [ ] Calculation methods functioning
- [ ] Priority system working
- [ ] Conflict detection operational
- [ ] Version control functional
- [ ] Simulation tools accurate

### **System Validation**
- [ ] Database connections stable
- [ ] API endpoints responding
- [ ] Admin dashboard accessible
- [ ] Rule creation/editing working
- [ ] Simulation tools functional
- [ ] Performance metrics collecting

## 🚀 **Production Deployment**

### **Server Requirements**
- **CPU**: 2+ cores (4+ recommended)
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 20GB SSD minimum
- **Network**: 100Mbps minimum

### **Production Configuration**
```env
# Production environment
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://your-domain.com"

# Security
NEXTAUTH_SECRET="production-secret-key"
ENCRYPTION_KEY="256-bit-encryption-key"

# Database
DATABASE_URL="postgresql://user:pass@prod-db-host:5432/prod_db"

# Redis
REDIS_URL="redis://prod-redis-host:6379"

# Monitoring
SENTRY_DSN="your-sentry-dsn"
LOG_LEVEL="warn"
```

### **SSL Configuration**
```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### **Process Management**
```bash
# Using PM2
pm2 start ecosystem.config.js --env production

# Using Docker
docker build -t business-rules .
docker run -d -p 3000:3000 --env-file .env.production business-rules
```

## 📊 **Monitoring & Maintenance**

### **Health Checks**
```bash
# Application health
curl https://your-domain.com/api/health

# Database health
curl https://your-domain.com/api/health/database

# Rule engine health
curl https://your-domain.com/api/health/rules
```

### **Log Monitoring**
```bash
# View application logs
pm2 logs business-rules

# View database logs
tail -f /var/log/postgresql/postgresql-*.log

# View Redis logs (if applicable)
tail -f /var/log/redis/redis-server.log
```

### **Performance Monitoring**
- Monitor rule execution times
- Track cache hit rates
- Watch database query performance
- Monitor memory usage
- Alert on error rates

### **Backup Strategy**
```bash
# Database backup
pg_dump business_rules_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Application backup
tar -czf app_backup_$(date +%Y%m%d).tar.gz /path/to/app

# Automated backups (crontab)
0 2 * * * pg_dump business_rules_db > /backups/db_$(date +%Y%m%d).sql
```

## 🔧 **Troubleshooting**

### **Common Issues**

#### **Database Connection Issues**
```bash
# Test connection
psql "postgresql://user:pass@host:port/db"

# Check PostgreSQL status
sudo systemctl status postgresql

# Restart database
sudo systemctl restart postgresql
```

#### **Application Not Starting**
```bash
# Check Node.js version
node --version

# Check environment variables
cat .env.local

# Check application logs
pm2 logs business-rules --lines 100

# Restart application
pm2 restart business-rules
```

#### **Rule Engine Performance**
```bash
# Clear rule cache
curl -X POST https://your-domain.com/api/admin/clear-cache

# Check cache statistics
curl https://your-domain.com/api/admin/cache-stats

# Restart rule engine
pm2 restart business-rules
```

#### **Memory Issues**
```bash
# Check memory usage
pm2 monit

# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
pm2 restart business-rules
```

### **Performance Optimization**

#### **Database Optimization**
```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM business_rules WHERE is_active = true;

-- Update statistics
ANALYZE business_rules;

-- Create composite indexes
CREATE INDEX idx_rules_complex ON business_rules(type, category, is_active, priority);
```

#### **Application Optimization**
```javascript
// Enable gzip compression
// next.config.js
module.exports = {
  compress: true,
  experimental: {
    optimizeCss: true,
  },
}
```

## 📞 **Support & Resources**

### **Documentation**
- [System README](./BUSINESS_RULES_SYSTEM_README.md)
- [API Reference](./docs/api-reference.md)
- [Troubleshooting Guide](./docs/troubleshooting.md)

### **Community Support**
- GitHub Issues: Report bugs and request features
- GitHub Discussions: Ask questions and share knowledge
- Documentation Wiki: Community-contributed guides

### **Professional Support**
- Enterprise support available
- Custom development services
- Training and consultation
- Migration assistance

---

## 🎯 **Post-Deployment Checklist**

### **System Health**
- [ ] Application accessible via HTTPS
- [ ] Database connections working
- [ ] Admin dashboard functional
- [ ] Rule creation/editing working
- [ ] Simulation tools operational

### **Security**
- [ ] SSL certificate valid
- [ ] Admin authentication working
- [ ] API endpoints secured
- [ ] Database encrypted (if required)

### **Performance**
- [ ] Page load times < 3 seconds
- [ ] Rule execution < 100ms
- [ ] Database queries optimized
- [ ] Caching operational

### **Monitoring**
- [ ] Error logging configured
- [ ] Performance metrics collecting
- [ ] Backup system operational
- [ ] Health checks passing

### **Business Rules**
- [ ] Compensation plan configured
- [ ] Rules tested with real data
- [ ] Conflict detection working
- [ ] Version control operational

---

**🎉 Your Business Rules Management System is now live and ready to revolutionize your MLM compensation management!**