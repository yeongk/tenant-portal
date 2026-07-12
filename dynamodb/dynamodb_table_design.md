# DynamoDB Table Definitions

This folder contains the target schema for all DynamoDB tables used by the
`dmsystemsinc.net` multi-tenant auto-restoration SaaS platform.

Files are reference definitions (not live `describe-table` output). Use the
CLI commands below to create or recreate tables.

---

## Tables

| File | Table | Purpose |
|---|---|---|
| `Tenant.json` | Tenant | One record per registered shop (tenant admin profile) |
| `Staff.json` | Staff | Shop employees scoped per tenant |
| `Role.json` | Role | Tenant-scoped business roles (supervisor, mechanic, master engine builder, advisor, etc.) assigned to staff |
| `Customer.json` | Customer | End-user car owners scoped per tenant |
| `WorkOrder.json` | WorkOrder | Jobs linking customers to work, scoped per tenant |
| `StaffWorkOrder.json` | StaffWorkOrder | Junction table: staff ↔ work order many-to-many |

---

## Relationships

```
Tenant   ──1:many──►  Staff
Tenant   ──1:many──►  Role
Staff    ──many:1──►  Role        (via Staff.role_id)
Staff    ──many:many─  WorkOrder   (via StaffWorkOrder junction table)
Customer ──1:many──►  WorkOrder
```

### Tenant → Staff (1-to-many)
- Staff `PK = TENANT#<tenantId>`, `SK = STAFF#<staffId>`
- Query all staff for a tenant (preferred): main table `PK = TENANT#x AND begins_with(SK, "STAFF#")`
- Query all staff for a tenant (cross-tenant/admin): `Staff.GSI-StaffByTenant` with `PK = TenantId`
- Reverse lookup by Cognito sub: `Staff.GSI-StaffByUser` with `PK = UserId`

### Staff → Role (many-to-1)
Role is a separate construct from Cognito group. Cognito groups are limited to
SHOP_ADMIN (shop owner), MECHANIC (shop staff resource — all internal
workforce), and CLIENT (end customer). Within MECHANIC, each staff member is
assigned a business role (title, description, billing rate) from the Role
table:
- Role `PK = TENANT#<tenantId>`, `SK = ROLE#<roleId>`
- Staff item carries a `role_id` attribute pointing at the Role item
- All roles for a tenant: main table `PK = TENANT#x AND begins_with(SK, "ROLE#")`
- Resolving a staff row's role name: direct `GetItem` on `PK = TENANT#x, SK = ROLE#<roleId>`
- No GSI — deleting a Role leaves a dangling `role_id` on any Staff rows that
  referenced it; the API resolves that to no role name rather than erroring

### Staff ↔ WorkOrder (many-to-many)
All staff are equal participants — no lead mechanic. Resolved via `StaffWorkOrder`:
- `PK = TENANT#<tenantId>`, `SK = WO#<woId>#STAFF#<staffId>`
- All staff on a WO (main table): `PK = TENANT#x AND begins_with(SK, "WO#<woId>#STAFF#")`
- All staff on a WO (GSI): `StaffWorkOrder.GSI-AssignmentByWO` with `PK = WO#<woId>`
- All WOs for a mechanic: `StaffWorkOrder.GSI-AssignmentByStaff` with `PK = STAFF#<staffId>`
- WorkOrder items carry **no StaffId attribute**

### Customer → WorkOrder (1-to-many)
- WorkOrder item carries `CustomerId` attribute
- All WOs for a customer: `WorkOrder.GSI-WOByCustomer` with `PK = CustomerId`

---

## CLI: Create / recreate all tables

### Staff (recreate to add GSI-StaffByTenant)

```bash
aws dynamodb delete-table --table-name Staff --region us-east-1
aws dynamodb wait table-not-exists --table-name Staff --region us-east-1

aws dynamodb create-table \
  --table-name Staff \
  --region us-east-1 \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
      AttributeName=PK,AttributeType=S \
      AttributeName=SK,AttributeType=S \
      AttributeName=TenantId,AttributeType=S \
      AttributeName=UserId,AttributeType=S \
  --key-schema \
      AttributeName=PK,KeyType=HASH \
      AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes '[
    {
      "IndexName": "GSI-StaffByUser",
      "KeySchema": [{"AttributeName": "UserId", "KeyType": "HASH"}],
      "Projection": {"ProjectionType": "ALL"}
    },
    {
      "IndexName": "GSI-StaffByTenant",
      "KeySchema": [
        {"AttributeName": "TenantId", "KeyType": "HASH"},
        {"AttributeName": "SK",       "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]'

aws dynamodb wait table-exists --table-name Staff --region us-east-1
```

### Role (new — business roles, separate from Cognito group)

```bash
aws dynamodb create-table \
  --table-name Role \
  --region us-east-1 \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
      AttributeName=PK,AttributeType=S \
      AttributeName=SK,AttributeType=S \
  --key-schema \
      AttributeName=PK,KeyType=HASH \
      AttributeName=SK,KeyType=RANGE

aws dynamodb wait table-exists --table-name Role --region us-east-1
```

### WorkOrder (recreate to drop StaffId / LeadStaffId)

```bash
aws dynamodb delete-table --table-name WorkOrder --region us-east-1
aws dynamodb wait table-not-exists --table-name WorkOrder --region us-east-1

aws dynamodb create-table \
  --table-name WorkOrder \
  --region us-east-1 \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
      AttributeName=PK,AttributeType=S \
      AttributeName=SK,AttributeType=S \
      AttributeName=CustomerId,AttributeType=S \
      AttributeName=StatusSK,AttributeType=S \
  --key-schema \
      AttributeName=PK,KeyType=HASH \
      AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes '[
    {
      "IndexName": "GSI-WOByCustomer",
      "KeySchema": [
        {"AttributeName": "CustomerId", "KeyType": "HASH"},
        {"AttributeName": "SK",         "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    },
    {
      "IndexName": "GSI-WOByStatus",
      "KeySchema": [
        {"AttributeName": "PK",       "KeyType": "HASH"},
        {"AttributeName": "StatusSK", "KeyType": "RANGE"}
      ],
      "Projection": {
        "ProjectionType": "INCLUDE",
        "NonKeyAttributes": ["CustomerId","VehicleId","CreatedAt","UpdatedAt"]
      }
    }
  ]'

aws dynamodb wait table-exists --table-name WorkOrder --region us-east-1
```

### StaffWorkOrder (new junction table)

```bash
aws dynamodb create-table \
  --table-name StaffWorkOrder \
  --region us-east-1 \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
      AttributeName=PK,AttributeType=S \
      AttributeName=SK,AttributeType=S \
      AttributeName=StaffId,AttributeType=S \
      AttributeName=WOId,AttributeType=S \
  --key-schema \
      AttributeName=PK,KeyType=HASH \
      AttributeName=SK,KeyType=RANGE \
  --global-secondary-indexes '[
    {
      "IndexName": "GSI-AssignmentByStaff",
      "KeySchema": [
        {"AttributeName": "StaffId", "KeyType": "HASH"},
        {"AttributeName": "SK",      "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    },
    {
      "IndexName": "GSI-AssignmentByWO",
      "KeySchema": [
        {"AttributeName": "WOId", "KeyType": "HASH"},
        {"AttributeName": "SK",   "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]'

aws dynamodb wait table-exists --table-name StaffWorkOrder --region us-east-1
```
