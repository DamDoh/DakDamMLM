# 5-Level Admin Hierarchy System Implementation

## Overview
This document describes the implementation of a 5-level admin hierarchy system for managing organizational entities (Dealer, Center, Mobile, Small Mobile).

## Admin Levels

1. **Super Admin** - Manages everything (existing role, unchanged)
2. **Admin D (Dealer)** - Manages Centers, Mobiles, and Small Mobiles within their Dealer network
3. **Admin C (Center)** - Manages Mobiles and Small Mobiles within their Center
4. **Admin M (Mobile)** - Manages Small Mobiles within their Mobile
5. **Admin S (Small Mobile)** - Manages users within their Small Mobile scope

## Database Schema Changes

### New Models Added

1. **Dealer** - Top-level organizational unit
2. **Center** - Belongs to a Dealer
3. **Mobile** - Belongs to a Center
4. **SmallMobile** - Belongs to a Mobile
5. **AdminEntityScope** - Maps admins to their assigned entities

### Schema Location
`prisma/schema.prisma`

## Implementation Details

### 1. RBAC Service Updates (`src/services/rbac-service.ts`)

#### New Roles Added
- `admin_d` - Dealer-level administration
- `admin_c` - Center-level administration
- `admin_m` - Mobile-level administration
- `admin_s` - Small Mobile-level administration

#### New Functions
- `getUserWithRolesAndScope()` - Get user with roles and admin scopes
- `getAdminScopes()` - Get all admin scopes for a user
- `hasEntityAccess()` - Check if admin has access to a specific entity
- `assignEntityScope()` - Assign entity scope to an admin
- `removeEntityScope()` - Remove entity scope from an admin

### 2. Server Actions (`src/services/server-actions.ts`)

#### New Functions Added
- `createOrganizationalEntity()` - Create Dealer, Center, Mobile, or SmallMobile
- `assignAdminRole()` - Assign admin role and entity scope to a user
- `getAdminScopes()` - Get admin scopes for a user
- `removeAdminScope()` - Remove admin scope
- `getOrganizationalEntities()` - Get all entities of a specific type
- `getAdminUsers()` - Get all users with admin roles
- `checkEntityAccess()` - Check if user has access to entity

## Usage Examples

### Creating Organizational Entities

```typescript
// Create a Dealer
await createOrganizationalEntity('D', {
  name: 'North Region Dealer',
  code: 'DEALER-001',
  description: 'Main dealer for North Region',
  companyId: 'company-id'
});

// Create a Center under a Dealer
await createOrganizationalEntity('C', {
  name: 'City Center',
  code: 'CENTER-001',
  description: 'Main center in the city',
  companyId: 'company-id',
  parentId: 'dealer-id' // Dealer ID
});

// Create a Mobile under a Center
await createOrganizationalEntity('M', {
  name: 'Mobile Unit 1',
  code: 'MOBILE-001',
  parentId: 'center-id' // Center ID
});

// Create a Small Mobile under a Mobile
await createOrganizationalEntity('S', {
  name: 'Small Mobile Unit 1',
  code: 'SMALL-001',
  parentId: 'mobile-id' // Mobile ID
});
```

### Assigning Admin Roles

```typescript
// Assign Dealer Admin role
await assignAdminRole(
  'user-id',
  'admin_d',
  'D',
  'dealer-id',
  'company-id',
  'assigned-by-user-id'
);

// Assign Center Admin role
await assignAdminRole(
  'user-id',
  'admin_c',
  'C',
  'center-id',
  'company-id'
);

// Assign Mobile Admin role
await assignAdminRole(
  'user-id',
  'admin_m',
  'M',
  'mobile-id',
  'company-id'
);

// Assign Small Mobile Admin role
await assignAdminRole(
  'user-id',
  'admin_s',
  'S',
  'small-mobile-id',
  'company-id'
);
```

### Getting Admin Scopes

```typescript
const result = await getAdminScopes('user-id');
if (result.success && result.scopes) {
  result.scopes.forEach(scope => {
    console.log(`${scope.entityType}: ${scope.entityName}`);
  });
}
```

### Checking Entity Access

```typescript
const access = await checkEntityAccess(
  'user-id',
  'C', // Center
  'center-id'
);

if (access.hasAccess) {
  // User can access this entity
}
```

## Permissions

Each admin level has specific permissions:

### Admin D (Dealer)
- Can manage Centers, Mobiles, and Small Mobiles
- Can create/update/read all entities under their Dealer
- Can manage lower-level admins (admin_c, admin_m, admin_s)
- Full access to users, orders, commissions, stock within their scope

### Admin C (Center)
- Can manage Mobiles and Small Mobiles
- Can create/update/read entities under their Center
- Can manage lower-level admins (admin_m, admin_s)
- Access to users, orders, commissions, stock within their scope

### Admin M (Mobile)
- Can manage Small Mobiles
- Can create/update/read Small Mobiles under their Mobile
- Can manage admin_s
- Access to users, orders, commissions, stock within their scope

### Admin S (Small Mobile)
- Can manage users within their Small Mobile
- Read-only access to products, orders, commissions
- Limited to their Small Mobile scope only

## Database Migration

To apply the schema changes, run:

```bash
npx prisma migrate dev --name add_admin_hierarchy_system
```

Or if you want to create the migration without applying it:

```bash
npx prisma migrate dev --name add_admin_hierarchy_system --create-only
```

Then apply it later:

```bash
npx prisma migrate deploy
```

## Initialization

After running the migration, initialize the new system roles:

```typescript
import { RBACService } from '@/services/rbac-service';

// This will create the new admin roles (admin_s, admin_m, admin_c, admin_d)
await RBACService.initializeSystemRoles();
```

## Data Filtering

When querying data, admins should only see data within their scope. Example:

```typescript
// Get users within admin's scope
const adminScopes = await RBACService.getAdminScopes(userId);
const entityIds = adminScopes.map(s => s.entityId);

// Filter users based on their assigned entity
const users = await prisma.user.findMany({
  where: {
    // Add filtering logic based on entity assignment
    // This depends on how users are linked to entities
  }
});
```

## Next Steps

1. **Run Database Migration**
   ```bash
   npx prisma migrate dev --name add_admin_hierarchy_system
   ```

2. **Initialize System Roles**
   - Call `RBACService.initializeSystemRoles()` to create the new admin roles

3. **Create Organizational Entities**
   - Create Dealers, Centers, Mobiles, and Small Mobiles as needed

4. **Assign Admin Roles**
   - Assign appropriate admin roles to users with their entity scopes

5. **Update Data Queries**
   - Modify existing queries to filter by admin scope
   - Use `hasEntityAccess()` to check permissions before data access

6. **Create UI Components**
   - Admin management interface
   - Entity management interface
   - Scope assignment interface

## Notes

- All existing roles and permissions remain unchanged
- Super Admin retains full system access
- The system is backward compatible - existing functionality continues to work
- TypeScript errors about new Prisma models will resolve after TypeScript server restart
- The implementation is additive - no existing code was removed

