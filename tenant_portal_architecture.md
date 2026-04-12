**Global layout (all authenticated pages)**
* Top bar: tenant name, user avatar, logout
* Left nav:
  * Dashboard
  * Work Orders
  * Customers
  * Staff
  * Settings
* Main content area
* Toast/notification system

---


# Dashboard
## `/dashboard`

**Goal:** quick operational snapshot

**Components**

* `StatCards`

  * New Workorders
  * In Progress
  * Awaiting Approval

* `WorkordersTable`

  * Columns: Workorder, Staff, Customer, Vehicle, Status
  * Row click → `/workorders/:id`

* `QuickActions`

  * “New Workorder”
  * “Assign Mechanic”

**Data**

•	List work order for a Tenant by workorder id and staff and customer 

---

# Staff (Mechanics / Supervisor / Shop Admin)

## `/staff` (GET /staff)

**Components**

* `Staff Table`

  * Name, Role, Email
  * Actions: Add, Edit, Delete

* `FilterBar`

  * Role filter (SHOP_ADMIN, SUPERVISOR, MECHANIC)

* `PrimaryButton` → “Add Staff”

**Data**

•	List staff for a Tenant order by name and role 

---

## `/staff` (POST staff)

**Components**

* `CreateStaffForm`

  * Full Name
  * Email
  * Role (select from "SHOP_ADMIN", "SUPERVISOR", "MECHANIC")
  * Specialty
  * Phone (optional)

* `SubmitButton`

**On submit**

1. Call backend:

   * add to Cognito user pool ("us-east-1_lHeZnKLHv") 
     * tenant-client Id: "4cjs8df4npomsf9v70tr00foi9"
   * Add to cognito:group with selected Role
2. Insert to DynamoDB `Staff` 
3. Success → toast → redirect `/staff`

**Validation**

* Role required
* Email unique within tenant

---

# Customers

## `/customers` (GET /customers)

**Components**

* `CustomerTable`

  * Name, Email, Phone, Vehicle (could have multiple vehicles per customer)
  * Action: View

* `PrimaryButton` → “Add Customer”



---

## `/customers` (POST /customers)

**Components**

* `CreateCustomerForm`

  * Full Name
  * Email
  * Phone
  * Vehicle (one customer could have multiple vehicles)
     * Year / Make / Model / Engine (select from pull-down list)
     * License plate
     * VIN
     * Nickname

* `Checkbox`

  * “Create portal login for this customer” (default ON)

**On submit**
  * Store in DynamoDB

* If portal login checked:
   * add to Cognito user pool ("us-east-1_lHeZnKLHv") 
     * customer-client Id: "46q3125bvf9sqe8p3ujq5l3qkc"
  * Create Cognito user (userType=CLIENT, group=CLIENT)


---

# Work Orders

## `/workorders` (GET /workorders)

**Components**

* `WorkorderTable`

  * Workorder Name
  * Description
  * Customer
  * Staff
  * Vehicle
  * Status (Unassigned / In Progress / Complete)
  * entry date
  * target date
  * estimated cost
  
* `FilterBar`
  * Customer
  * Staff
  * Status

* `PrimaryButton` → “New Workorder

**Data**

* List workorders for a Tenant order by workorder id and customer id

---

## `/workorders` (POST workorders)

**Components**

* `CreateWorkorderForm`

  1. **Customer Select**

     * `AsyncSelect` (search existing)
     * select Vehicle (in case multiple vehicles)
     * “+ New Customer” inline modal

  2. **Workorder Details**

     * Workorder Name
     * Description
     * entry date
     * target date
     * estimated cost

  3. **Assignment**

     * Multi-select mechanics

  4. **Visibility Defaults**

     * Toggle: “Client can view timeline by default”

* `SubmitButton`

**On submit**

* populate related dynamoDB tables:
* Redirect → `/workorders/:id`

---

## `/workorders/:id` (Workorder detail + timeline)

**Layout**

* Header:

  * Workorder name, staff, status, customer, vehicle

* Tabs:
  * Timeline (default)
  * Details
  * Assignments

---

### Timeline Tab 

**Components**

* `TimelineComposer`

  * Text
  * Upload (image/video/audio)
  * Visibility toggle:

    * INTERNAL / CLIENT_VISIBLE

* `TimelineFeed`

  * Each item:

    * Title, body
    * Media gallery
    * Visibility badge
    * Author + timestamp



---

### Details Tab

**Components**

* `WorkorderMeta`

  * Status dropdown
  * Stage (mechanical / valve adjustment / paint / etc.)
* `VehicleCard`
* `CustomerCard`

---

### Assignments Tab

**Components**

* `AssignedStaffList`
  * Vehicle
  * Staff
  * Status (Unassigned / In Progress / Complete)
  * entry date
  * target date




---

# ⚙️ Settings

## `/settings`

**Components**

* `TenantInfo`

  * Shop name
  * Subdomain
* `InviteLink` 
* `Branding` 



---

# Frontend guards

```ts
// after login
if (claims["custom:userType"] !== "STAFF" or plan == 'trial') {
  redirect("/login") 
}
```

---
