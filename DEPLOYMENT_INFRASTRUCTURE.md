
# DakDam MLM Deployment & Infrastructure Guide

This comprehensive guide covers the deployment and infrastructure setup for the DakDam MLM platform, including local development, staging, and production environments.

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Docker Containerization](#docker-containerization)
3. [Kubernetes Orchestration](#kubernetes-orchestration)
4. [Cloud Deployment Options](#cloud-deployment-options)
5. [Infrastructure as Code](#infrastructure-as-code)
6. [Monitoring & Observability](#monitoring--observability)
7. [Security & Compliance](#security--compliance)
8. [Backup & Disaster Recovery](#backup--disaster-recovery)
9. [Performance Optimization](#performance-optimization)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## Development Environment Setup

### Prerequisites

#### System Requirements
- **OS**: Linux, macOS, or Windows 10/11 with WSL2
- **CPU**: 4+ cores recommended
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 50GB free space
- **Network**: Stable internet connection

#### Required Software
```bash
# Node.js 18+ with npm
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x

# Docker Desktop
docker --version  # Should show Docker version 24.x.x
docker-compose --version  # Should show Docker Compose version 2.x.x

# Git
git --version  # Should show 2.x.x

# Optional: kubectl for Kubernetes development
kubectl version --client
```

### Local Development Setup

#### 1. Clone Repository
```bash
git clone https://github.com/your-org/dakdam-mlm.git
cd dakdam-mlm
```

#### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env.local

# Edit environment variables
nano .env.local
```

**Required Environment Variables:**
```env
# Database
DATABASE_URL="postgresql://dakdam_user:dakdam_password@localhost:5432/dakdam_db?schema=public"

# JWT Security
JWT_SECRET="your-super-secure-jwt-secret-change-in-production"
JWT_REFRESH_SECRET="your-refresh-secret-change-in-production"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"

# Email (optional for development)
SMTP_HOST="localhost"
SMTP_PORT="1025"  # Use MailHog for development

# Redis (optional)
REDIS_URL="redis://localhost:6379"
```

#### 3. Start Development Environment
```bash
# Start all services with Docker Compose
docker-compose up -d

# Or start individual services
docker-compose up postgres redis -d

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed development data (optional)
npx prisma db seed

# Start development server
npm run dev
```

#### 4. Verify Setup
```bash
# Check services are running
docker-compose ps

# Test database connection
npx prisma studio

# Test API endpoints
curl http://localhost:3000/api/health

# Test microservices
curl http://localhost:3001/api/health  # User service
curl http://localhost:3002/api/health  # Commission service
curl http://localhost:3003/api/health  # Genealogy service
```

### Development Tools Setup

#### Database Management
```bash
# Prisma Studio (GUI)
npx prisma studio

# Database migrations
npx prisma migrate dev
npx prisma migrate reset

# Database seeding
npx prisma db seed
```

#### Testing
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm run test

# Test coverage
npm run test:coverage
```

#### Code Quality
```bash
# Linting
npm run lint

# Type checking
npm run type-check

# Format code
npm run format
```

---

## Docker Containerization

### Docker Architecture

#### Multi-Stage Builds
```dockerfile
# Example: API Gateway Dockerfile
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Build application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
```

#### Microservice Dockerfiles
```dockerfile
# Example: User Service Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production

COPY . .
RUN npm run build

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["npm", "run", "start:prod"]
```

### Docker Compose Configuration

#### Development Stack
```yaml
# docker-compose.yml
version: '3.8'

services:
  # Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: dakdam_db
      POSTGRES_USER: dakdam_user
      POSTGRES_PASSWORD: dakdam_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dakdam_user -d dakdam_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Cache
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  # API Gateway
  api-gateway:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://dakdam_user:dakdam_password@postgres:5432/dakdam_db
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - .:/app
      - /app/node_modules

  # Microservices
  user-service:
    build:
      context: ./services/user-service
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://dakdam_user:dakdam_password@postgres:5432/dakdam_db
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
```

#### Production Stack
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # Load Balancer
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl/certs:ro
    depends_on:
      - api-gateway

  # API Gateway
  api-gateway:
    image: dakdam/api-gateway:latest
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Database
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=${DB_NAME}
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    deploy:
      placement:
        constraints:
          - node.role == manager

  # Redis
  redis:
    image: redis:7-alpine
    deploy:
      replicas: 1

volumes:
  postgres_data:
    driver: local
```

### Docker Commands Reference

#### Building Images
```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build api-gateway

# Build with no cache
docker-compose build --no-cache

# Build for production
docker build -t dakdam/api-gateway:latest .
```

#### Running Containers
```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d api-gateway

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api-gateway

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

#### Debugging
```bash
# Execute commands in running container
docker-compose exec api-gateway sh

# View container resource usage
docker stats

# Inspect container
docker inspect dakdam_api-gateway_1
```

---

## Kubernetes Orchestration

### Kubernetes Architecture

#### Cluster Structure
```
Kubernetes Cluster
├── Control Plane
│   ├── API Server
│   ├── etcd
│   ├── Controller Manager
│   └── Scheduler
├── Worker Nodes
│   ├── Kubelet
│   ├── Kube Proxy
│   └── Container Runtime (Docker)
└── Add-ons
    ├── Ingress Controller (NGINX)
    ├── Metrics Server
    ├── Dashboard
    └── Monitoring Stack
```

#### Namespace Strategy
```yaml
# Create namespaces
apiVersion: v1
kind: Namespace
metadata:
  name: dakdam-production
  labels:
    name: dakdam-production
    environment: production

---
apiVersion: v1
kind: Namespace
metadata:
  name: dakdam-staging
  labels:
    name: dakdam-staging
    environment: staging
```

### Kubernetes Manifests

#### Deployment Manifest
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: dakdam-production
  labels:
    app: api-gateway
    version: v1.0.0
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
        version: v1.0.0
    spec:
      containers:
      - name: api-gateway
        image: dakdam/api-gateway:v1.0.0
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: dakdam-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: dakdam-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 30
```

#### Service Manifest
```yaml
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
  namespace: dakdam-production
  labels:
    app: api-gateway
spec:
  selector:
    app: api-gateway
  ports:
  - name: http
    port: 80
    targetPort: 3000
    protocol: TCP
  type: ClusterIP
```

#### Ingress Configuration
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: dakdam-ingress
  namespace: dakdam-production
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.dakdam.com
    - app.dakdam.com
    secretName: dakdam-tls
  rules:
  - host: api.dakdam.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-gateway
            port:
              number: 80
  - host: app.dakdam.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-gateway
            port:
              number: 80
```

#### ConfigMap for Configuration
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dakdam-config
  namespace: dakdam-production
data:
  APP_ENV: "production"
  LOG_LEVEL: "info"
  RATE_LIMIT_WINDOW: "15"
  RATE_LIMIT_MAX: "100"
  CACHE_TTL: "3600"
  SESSION_TIMEOUT: "7200"
  MAX_FILE_SIZE: "10485760"
```

#### Secret Management
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: dakdam-secrets
  namespace: dakdam-production
type: Opaque
data:
  # Base64 encoded secrets
  database-url: <base64-encoded-database-url>
  jwt-secret: <base64-encoded-jwt-secret>
  redis-password: <base64-encoded-redis-password>
  smtp-password: <base64-encoded-smtp-password>
  stripe-secret-key: <base64-encoded-stripe-key>
```

### StatefulSets for Databases

#### PostgreSQL StatefulSet
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: dakdam-production
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: database-name
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 100Gi
      storageClassName: fast-ssd
```

### Kubernetes Operations

#### Deployment Commands
```bash
# Apply manifests
kubectl apply -f k8s/

# Check pod status
kubectl get pods -n dakdam-production

# View logs
kubectl logs -f deployment/api-gateway -n dakdam-production

# Scale deployment
kubectl scale deployment api-gateway --replicas=5 -n dakdam-production

# Rolling update
kubectl set image deployment/api-gateway api-gateway=dakdam/api-gateway:v1.1.0 -n dakdam-production

# Rollback deployment
kubectl rollout undo deployment/api-gateway -n dakdam-production
```

#### Monitoring Kubernetes
```bash
# Cluster info
kubectl cluster-info

# Node status
kubectl get nodes

# Pod resource usage
kubectl top pods -n dakdam-production

# Events
kubectl get events -n dakdam-production --sort-by='.lastTimestamp'

# Describe pod for debugging
kubectl describe pod api-gateway-12345-abcde -n dakdam-production
```

---

## Cloud Deployment Options

### AWS Deployment

#### ECS Fargate
```yaml
# Task Definition
{
  "family": "dakdam-api-gateway",
  "taskRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "api-gateway",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/dakdam/api-gateway:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "DATABASE_URL", "value": "${DATABASE_URL}"}
      ],
      "secrets": [
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:dakdam/jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/dakdam-api-gateway",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

#### AWS Infrastructure Setup
```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16

# Create subnets
aws ec2 create-subnet --vpc-id vpc-12345 --cidr-block 10.0.1.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-12345 --cidr-block 10.0.2.0/24 --availability-zone us-east-1b

# Create RDS PostgreSQL
aws rds create-db-instance \
  --db-instance-identifier dakdam-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username dakdam_user \
  --master-user-password ${DB_PASSWORD} \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-12345 \
  --db-subnet-group-name dakdam-db-subnet

# Create ElastiCache Redis
aws elasticache create-cache-cluster \
  --cache-cluster-id dakdam-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --vpc-security-group-ids sg-12345 \
  --cache-subnet-group-name dakdam-redis-subnet
```

### Google Cloud Platform

#### Cloud Run Deployment
```yaml
# Cloud Run service
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: api-gateway
  namespace: default
spec:
  template:
    spec:
      containers:
      - image: gcr.io/dakdam-project/api-gateway:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-url
              key: latest
        resources:
          limits:
            cpu: 1000m
            memory: 512Mi
        startupProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 18
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
```

#### GKE Cluster Setup
```bash
# Create GKE cluster
gcloud container clusters create dakdam-cluster \
  --num-nodes=3 \
  --machine-type=e2-medium \
  --zone=us-central1-a

# Get credentials
gcloud container clusters get-credentials dakdam-cluster --zone=us-central1-a

# Deploy application
kubectl apply -f k8s/

# Create load balancer
kubectl apply -f k8s/ingress.yml
```

### Azure Deployment

#### AKS Cluster
```bash
# Create resource group
az group create --name dakdam-rg --location eastus

# Create AKS cluster
az aks create \
  --resource-group dakdam-rg \
  --name dakdam-cluster \
  --node-count 3 \
  --node-vm-size Standard_B2s \
  --enable-addons monitoring \
  --generate-ssh-keys

# Get credentials
az aks get-credentials --resource-group dakdam-rg --name dakdam-cluster

# Deploy application
kubectl apply -f k8s/
```

---

## Infrastructure as Code

### Terraform Configuration

#### Main Configuration
```hcl
# main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "dakdam-terraform-state"
    key    = "production/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  name = "dakdam"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = true
}

# ECS Module
module "ecs" {
  source = "./modules/ecs"

  name = "dakdam"

  vpc_id = module.vpc.vpc_id
  subnets = module.vpc.private_subnets

  container_insights = true

  depends_on = [module.vpc]
}

# RDS Module
module "rds" {
  source = "./modules/rds"

  identifier = "dakdam-db"

  engine            = "postgres"
  engine_version    = "15.4"
  instance_class    = "db.t3.micro"
  allocated_storage = 20

  db_name  = "dakdam_db"
  username = "dakdam_user"
  port     = "5432"

  vpc_security_group_ids = [aws_security_group.rds.id]
  subnet_ids             = module.vpc.private_subnets

  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  depends_on = [module.vpc]
}

# ElastiCache Module
module "redis" {
  source = "./modules/redis"

  cluster_id      = "dakdam-redis"
  engine_version  = "7.0"
  node_type       = "cache.t3.micro"
  num_cache_nodes = 1

  subnet_ids             = module.vpc.private_subnets
  vpc_security_group_ids = [aws_security_group.redis.id]

  depends_on = [module.vpc]
}
```

#### Variables
```hcl
# variables.tf
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "dakdam"
}
```

#### Deployment
```bash
# Initialize Terraform
terraform init

# Plan deployment
terraform plan -var-file=production.tfvars

# Apply changes
terraform apply -var-file=production.tfvars

# Destroy infrastructure
terraform destroy -var-file=production.tfvars
```

### Ansible Automation

#### Inventory Configuration
```ini
# inventory/production
[api_gateway]
api-gateway-01 ansible_host=10.0.1.10
api-gateway-02 ansible_host=10.0.1.11
api-gateway-03 ansible_host=10.0.1.12

[user_service]
user-service-01 ansible_host=10.0.2.10
user-service-02 ansible_host=10.0.2.11

[commission_service]
commission-service-01 ansible_host=10.0.2.12
commission-service-02 ansible_host=10.0.2.13

[database]
db-01 ansible_host=10.0.3.10

[load_balancer]
lb-01 ansible_host=10.0.1.5

[all:vars]
ansible_user=ubuntu
ansible_ssh_private_key_file=~/.ssh/dakdam-prod.pem
ansible_python_interpreter=/usr/bin/python3
```

#### Playbook Example
```yaml
# playbooks/deploy.yml
---
- name: Deploy DakDam MLM Platform
  hosts: all
  become: yes
  vars:
    app_version: "v1.0.0"
    docker_registry: "123456789012.dkr.ecr.us-east-1.amazonaws.com"

  pre_tasks:
    - name: Update package cache
      apt:
        update_cache: yes
        cache_valid_time: 3600

    - name: Install required packages
      apt:
        name:
          - docker.io
          - docker-compose
          - nginx
          - certbot
          - python3-certbot-nginx
        state: present

  roles:
    - docker
    - nginx
    - monitoring
    - security

  tasks:
    - name: Pull latest images
      docker_image:
        name: "{{ docker_registry }}/dakdam/{{ item }}:{{ app_version }}"
        source: pull
      loop:
        - api-gateway
        - user-service
        - commission-service
        - genealogy-service

    - name: Start services
      docker_compose:
        project_src: /opt/dakdam
        files:
          - docker-compose.yml
        state: present
        restarted: yes

    - name: Wait for services to be healthy
      uri:
        url: "http://localhost:{{ item.port }}/api/health"
        status_code: 200
      register: health_check
      until: health_check.status == 200
      retries: 30
      delay: 10
      loop:
        - { service: api-gateway, port: 3000 }
        - { service: user-service, port: 3001 }
        - { service: commission-service, port: 3002 }

    - name: Update load balancer
      template:
        src: templates/nginx.conf.j2
        dest: /etc/nginx/sites-available/dakdam
      notify: reload nginx

  handlers:
    - name: reload nginx
      service:
        name: nginx
        state: reloaded
```

---

## Monitoring & Observability

### Application Metrics

#### Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['api-gateway:3000']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'user-service'
    static_configs:
      - targets: ['user-service:3001']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'commission-service'
    static_configs:
      - targets: ['commission-service:3002']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'genealogy-service'
    static_configs:
      - targets: ['genealogy-service:3003']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'node-exporter'
    static_configs:
      - targets:
        - 'api-gateway:9100'
        - 'user-service:9100'
        - 'commission-service:9100'
        - 'genealogy-service:9100'
```

#### Grafana Dashboards
```json
{
  "dashboard": {
    "title": "DakDam MLM Platform",
    "tags": ["mlm", "production"],
    "timezone": "UTC",
    "panels": [
      {
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=\"api-gateway\"}[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Commission Calculations",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(commission_calculated_total[5m])",
            "legendFormat": "Commissions/min"
          }
        ]
      },
      {
        "title": "Database Connections",
        "type": "gauge",
        "targets": [
          {
            "expr": "pg_stat_activity_count{datname=\"dakdam_db\"}",
            "legendFormat": "Active connections"
          }
        ]
      }
    ]
  }
}
```

### Centralized Logging

#### ELK Stack Configuration
```yaml
# logstash.conf
input {
  beats {
    port => 5044
  }
}

filter {
  if [fields][service] == "api-gateway" {
    grok {
      match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{DATA:requestId} %{DATA:method} %{DATA:path} %{NUMBER:statusCode} %{NUMBER:duration} %{DATA:ip} %{DATA:userAgent}" }
    }
  }

  if [fields][service] == "commission-service" {
    grok {
      match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{DATA:userId} %{DATA:commissionId} %{DATA:type} %{NUMBER:amount} %{DATA:description}" }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "dakdam-%{+YYYY.MM.dd}"
  }
}
```

### Alerting Rules

#### Prometheus Alert Rules
```yaml
# alert_rules.yml
groups:
  - name: dakdam_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }}% which is above 5%"

      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL database is down"
          description: "PostgreSQL has been down for more than 1 minute"

      - alert: CommissionCalculationFailure
        expr: increase(commission_calculation_errors_total[5m]) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Commission calculation failures"
          description: "{{ $value }} commission calculation errors in the last 5 minutes"

      - alert: HighMemoryUsage
        expr: (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is above 90%"
```

---

## Security & Compliance

### SSL/TLS Configuration

#### Nginx SSL Configuration
```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name api.dakdam.com;

    ssl_certificate /etc/ssl/certs/dakdam.crt;
    ssl_certificate_key /etc/ssl/private/dakdam.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    location / {
        proxy_pass http://api-gateway:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Web Application Firewall

#### ModSecurity Configuration
```apache
# modsecurity.conf
SecRuleEngine On
SecRequestBodyAccess On
SecResponseBodyAccess On
SecResponseBodyMimeType text/plain text/html text/xml application/json

# Custom rules for MLM platform
SecRule ARGS "@contains SELECT" "id:1001,phase:2,t:lowercase,deny,status:403,msg:'SQL Injection Attack'"

SecRule ARGS "@contains <script>" "id:1002,phase:2,t:lowercase,deny,status:403,msg:'XSS Attack'"

# Rate limiting for financial operations
SecRule REQUEST_URI "@streq /api/commissions/calculate" "id:2001,phase:1,t:none,nolog,pass,ctl:ruleEngine=DetectionOnly"

SecRule REQUEST_URI "@streq /api/wallet/transfer" "id:2002,phase:1,t:none,nolog,pass,ctl:ruleEngine=DetectionOnly"
```

### Secrets Management

#### HashiCorp Vault Integration
```typescript
// Vault client configuration
import Vault from 'node-vault';

const vault = Vault({
  apiVersion: 'v1',
  endpoint: process.env.VAULT_ENDPOINT,
  token: process.env.VAULT_TOKEN
});

// Retrieve secrets
async function getDatabaseCredentials() {
  const result = await vault.read('secret/data/dakdam/database');
  return {
    host: result.data.host,
    port: result.data.port,
    username: result.data.username,
    password: result.data.password,
    database: result.data.database
  };
}

// JWT secret rotation
async function rotateJWTSecret() {
  const newSecret = crypto.randomBytes(64).toString('hex');
  await vault.write('secret/data/dakdam/jwt', {
    secret: newSecret
  });

  // Update application configuration
  await updateAppConfig('JWT_SECRET', newSecret);

  return newSecret;
}
```

### Compliance Automation

#### GDPR Compliance
```typescript
// Data Subject Access Request (DSAR)
async function processDSAR(userId: string, requestType: 'access' | 'rectification' | 'erasure') {
  const user = await getUserById(userId);

  switch (requestType) {
    case 'access':
      // Collect all user data
      const userData = await collectUserData(userId);
      await sendDataToUser(user.email, userData);
      break;

    case 'rectification':
      // Update user data
      await updateUserData(userId, rectificationData);
      break;

    case 'erasure':
      // Anonymize or delete user data
      await anonymizeUserData(userId);
      await logDataErasure(userId);
      break;
  }

  // Log compliance action
  await logComplianceAction(userId, requestType, 'completed');
}

// Automated data retention
async function enforceDataRetention() {
  const retentionPolicies = {
    user_activity: 2555, // 7 years
    financial_records: 2555,
    audit_logs: 2555,
    commission_history: 2555
  };

  for (const [table, days] of Object.entries(retentionPolicies)) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    await deleteOldRecords(table, cutoffDate);
    await logRetentionAction(table, days);
  }
}
```

---

## Backup & Disaster Recovery

### Database Backup Strategy

#### Automated Backups
```bash
# PostgreSQL backup script
#!/bin/bash

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="dakdam_db_$DATE.sql"

# Create backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -f $BACKUP_DIR/$BACKUP_NAME

# Compress backup
gzip $BACKUP_DIR/$BACKUP_NAME

# Upload to cloud storage
aws s3 cp $BACKUP_DIR/$BACKUP_NAME.gz s3://dakdam-backups/database/

# Clean old backups (keep last 30 days)
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

# Log backup completion
echo "$(date): Database backup completed - $BACKUP_NAME.gz" >> /var/log/dakdam/backup.log
```

#### Point-in-Time Recovery
```sql
-- Create recovery point
SELECT pg_create_restore_point('before_major_update');

-- Restore to specific point
-- In postgresql.conf:
# recovery_target_time = '2024-01-15 14:30:00'
# recovery_target_action = 'promote'
```

### Application Backup

#### Configuration Backup
```bash
# Backup application configuration
tar -czf /backups/config_$(date +%Y%m%d).tar.gz \
  /opt/dakdam/.env \
  /opt/dakdam/config/ \
  /etc/nginx/sites-available/dakdam

# Backup SSL certificates
tar -czf /backups/ssl_$(date +%Y%m%d).tar.gz \
  /etc/ssl/certs/dakdam.* \
  /etc/ssl/private/dakdam.*
```

### Disaster Recovery Plan

#### Recovery Time Objective (RTO)
- **Critical Services**: 1 hour
- **Database**: 4 hours
- **Full Application**: 8 hours

#### Recovery Point Objective (RPO)
- **Database**: 5 minutes
- **Application Data**: 1 hour
- **User Files**: 24 hours

#### Recovery Procedures

##### Database Recovery
```bash
# Stop application services
docker-compose stop api-gateway user-service commission-service genealogy-service

# Restore database from backup
gunzip < /backups/dakdam_db_20240115.sql.gz | psql -h localhost -U dakdam_user -d dakdam_db

# Verify data integrity
psql -h localhost -U dakdam_user -d dakdam_db -c "SELECT COUNT(*) FROM users;"

# Restart services
docker-compose start api-gateway user-service commission-service genealogy-service
```

##### Application Recovery
```bash
# Pull latest images
docker-compose pull

# Restore configuration
tar -xzf /backups/config_20240115.tar.gz -C /

# Restore SSL certificates
tar -xzf /backups/ssl_20240115.tar.gz -C /

# Start services
docker-compose up -d

# Run health checks
curl -f https://api.dakdam.com/api/health
```

### Multi-Region Deployment

#### Cross-Region Replication
```yaml
# AWS RDS Global Database
resource "aws_rds_global_cluster" "dakdam" {
  global_cluster_identifier = "dakdam-global"
  engine                    = "aurora-postgresql"
  engine_version           = "15.4"
  database_name            = "dakdam_db"
}

# Primary region
resource "aws_rds_cluster" "primary" {
  cluster_identifier      = "dakdam-primary"
  global_cluster_identifier = aws_rds_global_cluster.dakdam.id
  engine                  = "aurora-postgresql"
  master_username         = "dakdam_user"
  master_password         = var.db_password
}

# Secondary region
resource "aws_rds_cluster" "secondary" {
  cluster_identifier      = "dakdam-secondary"
  global_cluster_identifier = aws_rds_global_cluster.dakdam.id
  engine                  = "aurora-postgresql"
}
```

---

## Performance Optimization

### Database Optimization

#### Indexing Strategy
```sql
-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY idx_users_company_active ON users(company_id, active);
CREATE INDEX CONCURRENTLY idx_commissions_user_date ON commissions(user_id, date);
CREATE INDEX CONCURRENTLY idx_orders_user_status ON orders(user_id, status);

-- Partial indexes for active records
CREATE INDEX CONCURRENTLY idx_active_users ON users(id) WHERE active = true;
CREATE INDEX CONCURRENTLY idx_pending_commissions ON commissions(id) WHERE status = 'Pending';

-- Expression indexes
CREATE INDEX CONCURRENTLY idx_users_email_lower ON users(LOWER(email));
CREATE INDEX CONCURRENTLY idx_users_full_name ON users(COALESCE(first_name, '') || ' ' || COALESCE(surname, ''));
```

#### Query Optimization
```sql
-- Use CTEs for complex genealogy queries
WITH RECURSIVE genealogy_tree AS (
  SELECT id, sponsor_id, first_name, surname, 0 as level
  FROM users
  WHERE id = $1

  UNION ALL

  SELECT u.id, u.sponsor_id, u.first_name, u.surname, gt.level + 1
  FROM users u
  JOIN genealogy_tree gt ON u.sponsor_id = gt.id
  WHERE gt.level < 10
)
SELECT * FROM genealogy_tree ORDER BY level, id;
```

### Application Optimization

#### Caching Strategy
```typescript
// Multi-level caching
class CacheManager {
  private redis: Redis;
  private localCache: Map<string, any>;

  async get(key: string): Promise<any> {
    // Check local cache first
    if (this.localCache.has(key)) {
      return this.localCache.get(key);
    }

    // Check Redis
    const redisData = await this.redis.get(key);
    if (redisData) {
      const parsed = JSON.parse(redisData);
      this.localCache.set(key, parsed); // Populate local cache
      return parsed;
    }

    return null;
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    const serialized = JSON.stringify(value);

    // Set in Redis with TTL
    await this.redis.setex(key, ttlSeconds, serialized);

    // Set in local cache
    this.localCache.set(key, value);
  }
}
```

#### Connection Pooling
```typescript
// Database connection pooling
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum connections
  min: 5,  // Minimum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Redis connection pooling
const redisConfig = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxIdle: 10,
  maxActive: 20,
};
```

### CDN & Static Asset Optimization

#### CloudFront Distribution
```yaml
# AWS CloudFront configuration
Resources:
  CloudFrontDistribution:
    Type