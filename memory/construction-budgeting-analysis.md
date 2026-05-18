# Construction Budgeting Analysis

**Tanggal:** 2026-05-18  
**Scope:** Apakah construction budgeting sudah siap diimplementasikan?

---

## Struktur Data Saat Ini

### 1. **Accounting Budgets** (migration 044)
```sql
CREATE TABLE public.budgets (
    id UUID PRIMARY KEY,
    org_id UUID,
    account_id UUID → links to accounts table,
    period DATE (YYYY-MM-01),
    budget_amount DECIMAL,
    ...
)
```
- **Scope:** Per account, per month
- **Use case:** Financial control (Revenue, COGS, Expense budgets)
- **Query:** `getBudgets()` → fetch budgets by org + period + optional branch_id

---

### 2. **Construction Budget Items** (migration 1227)
```sql
CREATE TABLE public.construction_budget_items (
    id UUID PRIMARY KEY,
    org_id UUID,
    project_id UUID → links to construction_projects,
    stage_id UUID → links to construction_project_stages,
    category TEXT (MATERIAL, LABOR, SUBCON, EQUIPMENT, OTHER),
    description TEXT,
    planned_quantity NUMERIC,
    planned_unit_cost NUMERIC,
    planned_total NUMERIC,
    actual_quantity NUMERIC,
    actual_unit_cost NUMERIC,
    actual_total NUMERIC,
    vendor_contact_id UUID,
    ...
)
```
- **Scope:** Per project, per stage, by cost category
- **Use case:** Project RAB/BoQ tracking (planned vs actual at line-item level)
- **Query:** `getConstructionBudgetItems()` → fetch by project

---

## Gap Analysis

### ❌ **Missing Link: Construction ↔ Accounting**

| Aspect | Status | Issue |
|--------|--------|-------|
| **Chart of Accounts** | ❌ | `construction_budget_items` has NO `account_id` field |
| **GL Integration** | ❌ | No journal posting when budget item actual_total changes |
| **Budget vs Actual** | ⚠️ Partial | Budget exists for accounts (AcctModule); Construction has own RAB (separate) |
| **Variance Analysis** | ⚠️ Partial | Construction can calc variance locally (actual_total - planned_total); Acct budgets separate |
| **PO Integration** | ❌ | construction_budget_items NOT linked to purchase_orders table |
| **Expense Posting** | ❌ | No trigger: when GRN received → auto-update construction_budget_items.actual_total |

---

## Current Implementation Status

### ✅ What Construction Module Can Do NOW:
1. **Create project & stages** → OK
2. **Define RAB/BoQ items** → OK (planned_quantity, planned_unit_cost)
3. **Track actual costs** → OK (manual entry of actual_quantity, actual_unit_cost)
4. **Calculate local variance** → OK (actual_total - planned_total)
5. **Show RAB vs actual** → OK (display in ConstructionDetailClient)
6. **Assign vendors** → OK (vendor_contact_id)

### ⚠️ What Needs Linking:
1. **Match RAB line items to GL accounts** → Requires `account_id` in construction_budget_items
2. **Auto-post expenses to GL** → Requires journal trigger on actual_total change
3. **Integrate with PO/GRN** → Requires link to purchase_orders & goods_received
4. **Aggregate budget compliance reports** → Requires unified budgets + construction RAB view

---

## Recommended Approach to Implement Budgeting for Construction

### **Option 1: Lightweight (Recommended for MVP)**
**Keep construction RAB separate from Accounting budgets.**

✅ **Scope for Construction:**
1. ✅ Define RAB/BoQ by project (already works)
2. ✅ Track actual costs per budget item (already works)
3. ✅ Calculate variance (actual - planned) per item
4. ✅ Show RAB vs Actual summary per project
5. ✅ Link to vendors for PO matching

❌ **Skip for now:**
- GL account mapping
- Automatic journal posting
- Integration with Accounting module budgets

**Why:** Construction RAB is detail-level (100+ line items per project); Accounting budgets are account-level (monthly). Forcing link = overcomplication.

---

### **Option 2: Full Integration (Future Phase)**
**Link construction RAB to GL accounts + auto-journal posting.**

**Required changes:**
```sql
-- 1. Add account_id to construction_budget_items
ALTER TABLE construction_budget_items 
ADD COLUMN account_id UUID REFERENCES accounts(id);

-- 2. Create trigger: when actual_total changes → post to journal
CREATE TRIGGER construction_budget_expense_trigger
AFTER UPDATE ON construction_budget_items
FOR EACH ROW
WHEN (NEW.actual_total != OLD.actual_total)
EXECUTE FUNCTION post_construction_expense_to_journal();

-- 3. Create view: unified budget vs actual
CREATE VIEW budget_compliance_all AS
SELECT 'ACCOUNTING' as source, account_id, period, budget_amount, actual_amount ...
UNION ALL
SELECT 'CONSTRUCTION' as source, account_id, project_id, ...;
```

**Cost:** ~2-3 days (migration + triggers + views)

---

## Verdict: Can We Implement Budgeting for Construction?

### **YES, BUT WITH CAVEATS:**

| Scenario | Answer | Notes |
|----------|--------|-------|
| **RAB/BoQ tracking (local)** | ✅ YES | Working now; no accounting link needed |
| **Planned vs Actual variance** | ✅ YES | Local calc works fine |
| **Link to GL accounts** | ⚠️ OPTIONAL | Needs migration 1309; not critical for MVP |
| **Auto-journal posting** | ❌ NOT YET | Needs trigger logic; risky for MVP |
| **Unified budget dashboard** | ❌ NOT YET | Requires view + consolidated reporting |

---

## Minimum Viable Scope (MVP) for Construction Budgeting

**Can implement TODAY without changes:**

1. ✅ **RAB Input & Edit** (already works)
   - Define budget items per stage/project
   - Input planned quantity & unit cost

2. ✅ **Actual Cost Tracking** (already works)
   - Record actual quantity & unit cost
   - UI auto-calculates actual_total

3. ✅ **Variance Analysis** (need small UI enhancement)
   - Show variance = actual - planned (per item)
   - Show variance % = (actual - planned) / planned * 100
   - Highlight over-budget items in red

4. ✅ **Budget Summary** (need small UI enhancement)
   - Total planned (sum of planned_total)
   - Total actual (sum of actual_total)
   - Total variance
   - % utilization per category (MATERIAL, LABOR, SUBCON, etc.)

5. ✅ **Vendor Matching** (already works)
   - Match budget item to vendor_contact_id
   - Link to PO (manual, no auto-creation)

---

## What's Missing to Enable Full Budgeting

To enable **complete budgeting implementation**, need:

### **Database:**
1. Add `account_id` to `construction_budget_items` (link to GL)
2. Add `po_id` to `construction_budget_items` (link to purchase orders)
3. Add `invoice_id` to `construction_budget_items` (link to invoices)

### **Backend:**
1. Create function `linkConstructionBudgetToAccount(budget_item_id, account_id)`
2. Create trigger `post_construction_expense_to_journal()` when actual_total updated
3. Create view `budget_compliance_all` (union accounting + construction budgets)

### **Frontend:**
1. Modal to select GL account for each budget item
2. Auto-calculate account-level budget from construction RAB
3. Unified budget vs actual dashboard

### **Time estimate:** 3-5 days full integration

---

## Recommendation

**For NOW:** 
- ✅ Build out **variance analysis UI** for construction RAB (highlight over-budget items)
- ✅ Build **budget summary per project** (total planned, actual, variance)
- ✅ Build **budget by category** (MATERIAL, LABOR, SUBCON breakdown)

**For LATER (Phase 2):**
- Link to GL accounts
- Auto-journal posting
- Unified accounting + construction budgets dashboard

**Rationale:** Construction RAB is already structured to track budgets locally. Adding GL link is nice-to-have but NOT blocking. Focus on making the local RAB budgeting UX excellent first.
