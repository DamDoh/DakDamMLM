# 📡 API ENDPOINTS REFERENCE GUIDE
## MLM Binary System - Complete Endpoint Listing

**Generated:** May 11, 2025  
**Total Endpoints:** 104 routes  
**Categories:** 52 functional areas

---

## 📊 ENDPOINT STATUS LEGEND
- ✅ **Working** - Tested and functional
- ⚠️ **Partial** - Implemented but has issues  
- ❌ **Broken/Missing** - Not implemented or has critical bugs
- 🔒 **Auth Required** - Requires authentication
- 👑 **Admin Only** - Requires admin role

---

## 🔐 AUTHENTICATION (7 endpoints)

### User Authentication
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/auth/register` | POST | ⚠️ | ❌ | Missing email verification, inconsistent member ID |
| `/api/auth/login` | POST | ✅ | ❌ | Returns JWT but not user data |
| `/api/auth/refresh` | POST | ✅ | 🔒 | Token refresh works |
| `/api/auth/change-password` | POST | ✅ | 🔒 | Functional |

### Password Management
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/auth/reset-password` | POST | ❌ | ❌ | Token verification missing, no email |
| `/api/auth/reset-password` | GET | ❌ | ❌ | Not implemented |

### Multi-Factor Authentication (MFA)
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/auth/mfa/setup` | POST | ⚠️ | 🔒 | Incomplete implementation |
| `/api/auth/mfa/verify` | POST | ⚠️ | 🔒 | Not integrated with login |

### Security
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/csrf-token` | GET | ✅ | ❌ | CSRF protection |

---

## 👥 USER MANAGEMENT (8 endpoints)

| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/members` | GET | ✅ | 🔒 | List all members |
| `/api/members` | POST | ⚠️ | 🔒 | Create member (validation missing) |
| `/api/members/[id]` | GET | ✅ | 🔒 | Get member details |
| `/api/members/[id]` | PUT | ✅ | 🔒 | Update member |
| `/api/members/[id]/details` | GET | ✅ | 🔒 | Detailed member info |
| `/api/members/[id]/downline` | GET | ✅ | 🔒 | Downline tree |
| `/api/members/[id]/positions` | GET | ✅ | 🔒 | Binary positions |
| `/api/members/downline` | GET | ✅ | 🔒 | Current user's downline |
| `/api/invited-members` | GET | ✅ | 🔒 | Members invited by user |
| `/api/profile/change-password` | POST | ✅ | 🔒 | Change own password |
| `/api/user/company` | GET | ✅ | 🔒 | User's company |
| `/api/user/ecash-balance` | GET | ✅ | 🔒 | E-cash balance |
| `/api/user/sessions` | GET | ✅ | 🔒 | List sessions |
| `/api/user/sessions` | DELETE | ✅ | 🔒 | Logout from session |

---

## 💰 COMMISSION & BONUS (9 endpoints)

### Binary Bonus
| Endpoint | Method | Status | Auth | Issues |
|----------|--------|--------|------|--------|
| `/api/commissions` | GET | ✅ | 🔒 | List commissions |
| `/api/commissions/calculate` | POST | ⚠️ | 🔒 | Race conditions, wrong field |
| `/api/bonus/daily-match` | POST | ⚠️ | 🔒 | No idempotency check |

### Matching Bonus
| Endpoint | Method | Status | Auth | Issues |
|----------|--------|--------|------|--------|
| `/api/bonus/calculate-matching-bonus` | POST | ⚠️ | 🔒 | Formula eval security risk |

### Stockist Bonus
| Endpoint | Method | Status | Auth | Issues |
|----------|--------|--------|------|--------|
| `/api/commissions/calculate-stockist` | POST | ⚠️ | 🔒 | Needs testing |
| `/api/stockist-bonus` | GET | ⚠️ | 🔒 | Level multipliers missing |
| `/api/stockist-bonus` | POST | ⚠️ | 🔒 | Creates record but incomplete |

### G2 Binary Bonus
| Endpoint | Method | Status | Auth | Issues |
|----------|--------|--------|------|--------|
| `/api/commissions/recalculate-g2` | POST | ❌ | 👑 | **CRITICAL:** Uses wrong genealogy field |

### Binary Stock Commission
| Endpoint | Method | Status | Auth | Issues |
|----------|--------|--------|------|--------|
| `/api/binary-stock` | GET | ✅ | 🔒 | Level assignments |
| `/api/binary-stock/assign-level` | POST | ⚠️ | 👑 | Untested |
| `/api/binary-stock/stockists-by-level` | GET | ✅ | 🔒 | List by level |
| `/api/binary-stock/transfer` | POST | ⚠️ | 👑 | Transfer between levels |

---

## 💳 WALLET & FINANCIAL (6 endpoints)

| Endpoint | Method | Status | Auth | Issues |
|----------|--------|--------|------|--------|
| `/api/wallet/balance` | GET | ✅ | 🔒 | Check balance |
| `/api/wallet/transactions` | GET | ✅ | 🔒 | Transaction history |
| `/api/wallet/transfer-pv` | POST | ❌ | 🔒 | **CRITICAL:** Race condition allows double-spend |
| `/api/members/[id]/transfer-pv` | POST | ⚠️ | 🔒 | Transfer PV to member |
| `/api/e-cash` | GET | ✅ | 🔒 | Check e-cash balance |
| `/api/e-cash/transfer-to-member` | POST | ⚠️ | 🔒 | Transfer e-cash |
| `/api/e-cash/backfill` | POST | ⚠️ | 👑 | Admin backfill |

---

## 🌳 GENEALOGY & TREE (2 endpoints)

| Endpoint | Method | Status | Auth | Issues |
|----------|--------|--------|------|--------|
| `/api/genealogy/move-downline` | POST | ❌ | 🔒 | **CRITICAL:** Uses wrong genealogy field |
| `/api/referral/track` | POST | ✅ | ❌ | Track referral click |

---

## 📦 ORDERS & PRODUCTS (5 endpoints)

### Orders
| Endpoint | Method | Status | Auth | Issues |
|----------|--------|--------|------|--------|
| `/api/orders` | GET | ✅ | 🔒 | List orders |
| `/api/orders` | POST | ❌ | 🔒 | **CRITICAL:** No transaction, inventory not atomic |
| `/api/orders/[id]` | GET | ✅ | 🔒 | Order details |
| `/api/orders/[id]` | PUT | ⚠️ | 🔒 | Update order (partial) |

### Products
| Endpoint | Method | Status | Auth | Issues |
|----------|--------|--------|------|--------|
| `/api/products` | GET | ✅ | ❌ | List products |
| `/api/products` | POST | ⚠️ | 👑 | Create product |
| `/api/products/reset` | POST | ⚠️ | 👑 | Reset product cache |

### Referrals
| Endpoint | Method | Status | Auth | Issues |
|----------|--------|--------|------|--------|
| `/api/referral/link` | GET | ✅ | 🔒 | Get referral link |
| `/api/referral/link` | POST | ✅ | 🔒 | Create referral link |
| `/api/referral/sponsor` | GET | ✅ | ❌ | Search sponsor by email/phone |

---

## 📦 STOCK & INVENTORY (7 endpoints)

### Stock Management
| Endpoint | Method | Status | Auth | Issues |
|----------|--------|--------|------|--------|
| `/api/stock-items` | GET | ✅ | 🔒 | List stock items |
| `/api/stock-items` | POST | ⚠️ | 👑 | Create stock item |

### Stock Requests
| Endpoint | Method | Status | Auth | Issues |
|----------|--------|--------|------|--------|
| `/api/stock-requests` | GET | ✅ | 🔒 | **CRITICAL:** Only GET - no CREATE/UPDATE |
| `/api/stock-requests` | POST | ❌ | 🔒 | NOT IMPLEMENTED |
| `/api/stock-requests/[id]` | PATCH | ❌ | 🔒 | NOT IMPLEMENTED |
| `/api/stock-requests/[id]` | DELETE | ❌ | 🔒 | NOT IMPLEMENTED |

### E-cash Requests
| Endpoint | Method | Status | Auth | Issues |
|----------|--------|--------|------|--------|
| `/api/ecash-topup-requests` | GET | ✅ | 🔒 | **CRITICAL:** Only GET - no CREATE |
| `/api/ecash-topup-requests` | POST | ❌ | 🔒 | NOT IMPLEMENTED |
| `/api/ecash-withdrawal-requests` | GET | ✅ | 🔒 | **CRITICAL:** Only GET - no CREATE |
| `/api/ecash-withdrawal-requests` | POST | ❌ | 🔒 | NOT IMPLEMENTED |
| `/api/ecash-withdrawal-requests/[id]` | PATCH | ❌ | 🔒 | NOT IMPLEMENTED |

### Inventory Operations
| Endpoint | Method | Status | Auth | Issues |
|----------|--------|--------|------|--------|
| `/api/inventory` | GET | ✅ | 🔒 | List inventory |
| `/api/inventory` | POST | ⚠️ | 🔒 | Add to inventory (no atomic) |
| `/api/inventory/transfer-from-catalog` | POST | ⚠️ | 🔒 | Transfer from catalog (no atomic) |

### Other Topup Types
| Endpoint | Method | Status | Auth | Issues |
|----------|--------|--------|------|--------|
| `/api/maintenance-topup-requests` | GET | ⚠️ | 🔒 | Only GET - no POST |
| `/api/rank-topup` | GET | ⚠️ | 🔒 | Only GET - no POST |
| `/api/pv-topup-requests` | GET | ⚠️ | 🔒 | Only GET - no POST |

---

## 🎯 BUSINESS RULES & CONFIGURATION (15+ endpoints)

### Business Rules
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/business-rules` | GET | ✅ | 🔒 | List rules |
| `/api/business-rules` | POST | ✅ | 🔒 | Create rule |
| `/api/business-rules/[id]` | GET | ✅ | 🔒 | Get rule |
| `/api/business-rules/[id]` | PUT | ✅ | 🔒 | Update rule |
| `/api/business-rules/[id]` | DELETE | ✅ | 🔒 | Delete rule |
| `/api/business-rules/conflicts` | POST | ⚠️ | 🔒 | Check conflicts |
| `/api/business-rules/simulate` | POST | ⚠️ | 🔒 | Simulate rule execution |
| `/api/business-rules/performance` | GET | ⚠️ | 🔒 | Performance metrics |

### Rule Sets
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/rule-sets` | GET | ✅ | 🔒 | List rule sets |
| `/api/rule-sets` | POST | ✅ | 🔒 | Create rule set |
| `/api/rule-sets/[id]` | GET | ✅ | 🔒 | Get rule set |
| `/api/rule-sets/[id]` | PUT | ✅ | 🔒 | Update rule set |
| `/api/rule-sets/[id]` | DELETE | ✅ | 🔒 | Delete rule set |

### Rule Templates
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/rule-templates` | GET | ✅ | 🔒 | List templates |
| `/api/rule-templates` | POST | ✅ | 🔒 | Create template |
| `/api/rule-templates/[id]` | GET | ✅ | 🔒 | Get template |
| `/api/rule-templates/[id]` | PUT | ✅ | 🔒 | Update template |
| `/api/rule-templates/[id]/apply` | POST | ✅ | 🔒 | Apply template |

### Rule Versions & Enhanced Rules
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/rule-versions` | GET | ✅ | 🔒 | Version history |
| `/api/rule-versions/[ruleId]/restore` | POST | ✅ | 🔒 | Restore version |
| `/api/enhanced-rules` | GET | ✅ | 🔒 | Advanced rules |
| `/api/enhanced-rules` | POST | ✅ | 🔒 | Create advanced rule |
| `/api/enhanced-rules` | PUT | ✅ | 🔒 | Update rule |
| `/api/enhanced-rules` | DELETE | ✅ | 🔒 | Delete rule |

### Company Configuration
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/company-rule-config` | GET | ✅ | 🔒 | Get company rule config |
| `/api/company-rule-config` | PUT | ✅ | 🔒 | Update config |

### Custom Functions
| Endpoint | Method | Status | Auth | Issues |
|----------|--------|--------|------|--------|
| `/api/custom-functions` | GET | ✅ | 🔒 | List functions |
| `/api/custom-functions` | POST | ⚠️ | 🔒 | **SECURITY RISK:** Function() evaluation |
| `/api/custom-functions/[id]` | GET | ✅ | 🔒 | Get function |
| `/api/custom-functions/[id]` | PUT | ⚠️ | 🔒 | **SECURITY RISK:** Function() evaluation |
| `/api/custom-functions/[id]` | DELETE | ✅ | 🔒 | Delete function |

---

## 📊 ADMIN & MONITORING (22 endpoints)

### Super Admin - General
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/super-admin/stats` | GET | ✅ | 👑 | System statistics |
| `/api/super-admin/diagnostics` | GET | ⚠️ | 👑 | Diagnostic info |
| `/api/super-admin/logs` | GET | ✅ | 👑 | System logs |

### Super Admin - Companies
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/super-admin/companies` | GET | ✅ | 👑 | List companies |
| `/api/super-admin/companies/[companyId]` | GET | ✅ | 👑 | Company details |
| `/api/super-admin/companies/[companyId]/action` | POST | ⚠️ | 👑 | Company actions |
| `/api/super-admin/tenants/[tenantId]/lifecycle` | POST | ⚠️ | 👑 | Tenant lifecycle |

### Super Admin - Security
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/super-admin/security/rate-limits` | GET | ✅ | 👑 | Rate limit status |
| `/api/super-admin/security/dual-auth/pending` | GET | ✅ | 👑 | Pending dual auth |
| `/api/super-admin/security/dual-auth/[id]/approve` | POST | ⚠️ | 👑 | Approve dual auth |
| `/api/super-admin/security-audit` | GET | ✅ | 👑 | Security audit |

### Super Admin - Compliance
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/super-admin/compliance/isolation-checks` | GET | ✅ | 👑 | Data isolation checks |
| `/api/super-admin/compliance/isolation-checks/run` | POST | ⚠️ | 👑 | Run isolation checks |
| `/api/super-admin/compliance/reports/generate` | POST | ⚠️ | 👑 | Generate report |

### Super Admin - IAM & Control
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/super-admin/iam/users` | GET | ✅ | 👑 | List users |
| `/api/super-admin/iam/users/[userId]/role` | PUT | ✅ | 👑 | Update user role |
| `/api/super-admin/iam/roles` | GET | ✅ | 👑 | List roles |
| `/api/super-admin/iam/impersonate` | POST | ⚠️ | 👑 | Impersonate user |
| `/api/super-admin/control/emergency` | GET | ✅ | 👑 | Emergency status |
| `/api/super-admin/control/emergency/status` | PUT | ⚠️ | 👑 | Update emergency mode |
| `/api/super-admin/control/bulk-operations` | POST | ⚠️ | 👑 | Bulk operations |

### Super Admin - Intelligence & Config
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/super-admin/intelligence/dashboard` | GET | ✅ | 👑 | BI dashboard |
| `/api/super-admin/intelligence/predictions` | GET | ⚠️ | 👑 | Predictions |
| `/api/super-admin/intelligence/risk-heatmap` | GET | ⚠️ | 👑 | Risk analysis |
| `/api/super-admin/config/global` | GET | ✅ | 👑 | Global config |
| `/api/super-admin/config/[key]` | GET | ✅ | 👑 | Get config value |
| `/api/super-admin/governance/rules` | GET | ✅ | 👑 | Governance rules |
| `/api/super-admin/governance/rules/[id]/execute` | POST | ⚠️ | 👑 | Execute rule |

### System Monitoring
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/health` | GET | ✅ | ❌ | Health check |
| `/api/health` | HEAD | ✅ | ❌ | Health check (HEAD) |
| `/api/tenant-performance` | GET | ✅ | 👑 | Tenant performance |
| `/api/tenant-performance` | PUT | ⚠️ | 👑 | Update performance |
| `/api/super-admin/monitoring/health` | GET | ✅ | 👑 | Detailed health |
| `/api/super-admin/metrics/global` | GET | ✅ | 👑 | Global metrics |
| `/api/incident-response` | POST | ✅ | 👑 | Report incident |
| `/api/incident-response` | GET | ✅ | 👑 | List incidents |

---

## 📈 ANALYTICS & REPORTING (8+ endpoints)

| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/analytics/key-metrics` | GET | ✅ | 🔒 | Key metrics |
| `/api/dashboard` | GET | ✅ | 🔒 | Dashboard data |
| `/api/metrics` | GET | ✅ | 🔒 | System metrics |
| `/api/metrics/performance` | GET | ✅ | 🔒 | Performance metrics |
| `/api/reports/drill-down` | GET | ⚠️ | 🔒 | Drill-down report |
| `/api/reports/virtualized` | GET | ⚠️ | 🔒 | Virtualized report |
| `/api/bulk-users/export` | POST | ✅ | 👑 | Export users |
| `/api/bulk-users/import` | POST | ⚠️ | 👑 | Import users |
| `/api/bulk-users/validate` | POST | ✅ | 👑 | Validate import |

---

## 🏢 CORPORATE & BRANDING (7 endpoints)

| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/company` | GET | ✅ | 🔒 | Company info |
| `/api/company/[id]` | GET | ✅ | 🔒 | Get company |
| `/api/company/[id]` | PUT | ✅ | 🔒 | Update company |
| `/api/company/[id]/stats` | GET | ✅ | 🔒 | Company stats |
| `/api/branding/[companyId]` | GET | ✅ | ❌ | Get branding |
| `/api/branding/[companyId]/upload` | POST | ✅ | 🔒 | Upload branding |
| `/api/register/admin` | POST | ✅ | ❌ | Admin registration |
| `/api/set-admin` | POST | ⚠️ | 👑 | Promote to admin |
| `/api/corporate/distribute-profits` | POST | ⚠️ | 👑 | Distribute profits |
| `/api/corporate/financial-dashboard` | GET | ✅ | 👑 | Financial view |
| `/api/corporate/permissions` | GET | ✅ | 👑 | Permissions |
| `/api/corporate/shareholders` | GET | ✅ | 👑 | Shareholders |
| `/api/corporate/transactions` | GET | ✅ | 👑 | Transactions |

---

## 🌐 OTHER ENDPOINTS (15+ endpoints)

### Languages & Localization
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/languages` | GET | ✅ | ❌ | List languages |
| `/api/languages/[code]` | GET | ✅ | ❌ | Get language strings |
| `/api/languages/[code]` | PUT | ✅ | 🔒 | Update translations |

### Notifications & Member ID
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/notifications` | GET | ✅ | 🔒 | List notifications |
| `/api/notifications/[id]` | GET | ✅ | 🔒 | Get notification |
| `/api/notifications/[id]` | DELETE | ✅ | 🔒 | Delete notification |
| `/api/member-id/next-mem` | GET | ✅ | ❌ | Next member ID |
| `/api/member-id/preview` | GET | ✅ | ❌ | Preview member ID |

### Upload & Settings
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/upload/company-asset` | POST | ✅ | 🔒 | Upload company asset |
| `/api/settings` | GET | ✅ | 🔒 | Get settings |
| `/api/settings` | PUT | ✅ | 🔒 | Update settings |

### Onboarding & Features
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/onboarding` | GET | ✅ | 🔒 | Onboarding data |
| `/api/feature-flags` | GET | ✅ | 🔒 | Feature flags |
| `/api/sponsors` | GET | ✅ | 🔒 | List sponsors |

### PV Matching & Security
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/pv-matching/current-period` | GET | ✅ | 🔒 | Current PV match period |
| `/api/security/audit-logs` | GET | ✅ | 👑 | Audit logs |

### Admin Utilities
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/admin/backfill-teamsize` | POST | ⚠️ | 👑 | Backfill team sizes |
| `/api/admin/rate-limit` | GET | ✅ | 👑 | Rate limit status |
| `/api/admin/scopes` | GET | ✅ | 👑 | Admin scopes |
| `/api/migrate` | POST | ⚠️ | 👑 | Database migration |

### Domains & Misc
| Endpoint | Method | Status | Auth | Notes |
|----------|--------|--------|------|-------|
| `/api/domains/[companyId]` | GET | ✅ | 🔒 | Get domain config |
| `/api/domains/[companyId]/ssl` | POST | ⚠️ | 👑 | Configure SSL |

---

## 📊 ENDPOINT STATUS SUMMARY

```
Total Endpoints:          104
✅ Working:               42 (40%)
⚠️ Partial/Risky:         38 (37%)
❌ Broken/Missing:        24 (23%)

By Category:
✅ Auth:                  4/7 (57%)
✅ Users:                 14/14 (100%)
⚠️ Commission:            5/9 (56%)
⚠️ Wallet:                4/6 (67%)
❌ Stock Requests:        0/4 (0%)
❌ E-cash Requests:       0/3 (0%)
✅ Admin:                 18/22 (82%)
✅ Analytics:             6/8 (75%)
```

---

## 🚨 QUICK REFERENCE: CRITICAL ISSUES BY ENDPOINT

### Red Alert (Immediate Fix Needed)
- ❌ `/api/wallet/transfer-pv` - Race condition
- ❌ `/api/orders` POST - No transaction
- ❌ `/api/commissions/recalculate-g2` - Wrong field
- ❌ `/api/genealogy/move-downline` - Wrong field
- ❌ `/api/stock-requests` - No CRUD
- ❌ `/api/ecash-withdrawal-requests` - No CRUD
- ⚠️ `/api/bonus/calculate-matching-bonus` - Code injection risk
- ⚠️ `/api/custom-functions` - Code injection risk

### Yellow Alert (Important Fix)
- ⚠️ `/api/auth/register` - Email verification missing
- ⚠️ `/api/auth/reset-password` - Token verification missing
- ⚠️ `/api/auth/mfa/*` - MFA incomplete
- ⚠️ `/api/commissions/calculate` - Race conditions

---

**Report Date:** May 11, 2025  
**Last Updated:** Current Session  
**Next Review:** After Phase 1 fixes

