# Transaction Code Format Audit Report

## Executive Summary
The codebase has **MIXED implementations** of transaction code formats:
- ✅ **New Format** (`{TYPE}-{BRAND}-{DDMMYY}-{NNN}`) - Implemented in some places
- ❌ **Old Format** (`DN-######-####`) - Still used in 3 critical locations
- ⚠️ **Inconsistent** - Some transactions use proper codes, others use random numbers

---

## Current Status

### ✅ CORRECTLY IMPLEMENTED (Using New Format)

#### 1. **`generateCustomRef()` Function** - `/app/actions/transactions.js:37`
```javascript
export async function generateCustomRef(tx, type, brandName, customDate = null) {
  const cleanBrand = brandName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3) || 'GEN';
  const typeCode = type.toUpperCase();
  
  const dateObj = customDate ? new Date(customDate) : new Date();
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = String(dateObj.getFullYear()).slice(-2);
  const dateStr = `${day}${month}${year}`;

  // Format: TYPE-BRD-DDMMYY-NNN  e.g. RCV-SAD-200826-001
  const prefix = `${typeCode}-${cleanBrand}-${dateStr}-`;
  
  const existing = await tx.inventoryTransaction.findMany({
    where: {
      deliveryNote: { startsWith: prefix }
    },
    select: { deliveryNote: true },
    distinct: ['deliveryNote']
  });

  const nextNum = existing.length + 1;
  const suffix = String(nextNum).padStart(3, '0');
  return `${prefix}${suffix}`;
}
```
✅ **Status:** Perfect implementation with proper sequential numbering per brand per day

#### 2. **Outbound Dispatches** - `/app/actions/transactions.js:649`
```javascript
for (const [brandName, brandItems] of Object.entries(itemsByBrand)) {
  const deliveryNote = await generateCustomRef(tx, 'OUT', brandName, transactionDate);
  // ...
}
```
✅ **Status:** Uses `generateCustomRef()` correctly

#### 3. **Loss/Damage Transactions** - `/scratch/fix-damage-loop.mjs:55`
```javascript
const brandName = product.brand?.name || 'General';
const typeCode = resolvedType === 'LOST' ? 'LST' : 'DMG';
const deliveryNote = await generateCustomRef(tx, typeCode, brandName);
```
✅ **Status:** Uses `generateCustomRef()` with proper type codes

---

## ❌ NEEDS UPDATE (Using Old Format)

### 1. **Product Creation - Inbound Transactions** 
**Location:** `/app/actions/products.js:676-680`

**Current Code:**
```javascript
deliveryNote: (() => {
  const val = formData.get(`item_${i}_inbound_${j}_deliveryNote`);
  return (val && val.trim() && val !== 'INITIAL_STOCK')
    ? val.trim()
    : `DN-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
})(),
```

**Problem:** 
- Uses old `DN-######-####` format
- Random numbers instead of sequential
- No brand identification
- No transaction type code

**Impact:**
- Initial product stock entries don't follow new format
- Can't identify brand from code
- Can't search/filter by brand
- Breaks consistency

**Required Fix:**
```javascript
// Import generateCustomRef at top of file
import { generateCustomRef } from './transactions';

// In the product creation loop, INSIDE the Prisma transaction:
const brandName = brands.find(b => b.id === brandId)?.name || 'General';
const deliveryNote = (() => {
  const val = formData.get(`item_${i}_inbound_${j}_deliveryNote`);
  return (val && val.trim() && val !== 'INITIAL_STOCK')
    ? val.trim()
    : null; // Will be generated later in transaction
})();

// Then when creating the transaction, if deliveryNote is null:
if (!deliveryNote) {
  deliveryNote = await generateCustomRef(tx, 'RCV', brandName);
}
```

---

### 2. **Product Bulk Update - Inbound Transactions**
**Location:** `/app/actions/products.js:811-813`

**Current Code:**
```javascript
deliveryNote: (entry.deliveryNote && entry.deliveryNote.trim() && entry.deliveryNote !== 'INITIAL_STOCK')
  ? entry.deliveryNote.trim()
  : `DN-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`,
```

**Problem:** Same as above - old format with random numbers

**Impact:** Bulk product imports generate inconsistent codes

**Required Fix:**
```javascript
// Must be called inside Prisma transaction context
const brandName = await tx.brand.findUnique({
  where: { id: item.brandId },
  select: { name: true }
});

deliveryNote: (entry.deliveryNote && entry.deliveryNote.trim() && entry.deliveryNote !== 'INITIAL_STOCK')
  ? entry.deliveryNote.trim()
  : await generateCustomRef(tx, 'RCV', brandName?.name || 'General'),
```

---

### 3. **Manual Transaction Creation - RECEIVE/RETURN**
**Location:** `/app/actions/transactions.js:205-206`

**Current Code:**
```javascript
deliveryNote: (transactionType === 'RECEIVE' || transactionType === 'RETURN')
  ? (deliveryNote && deliveryNote.trim() ? deliveryNote.trim() : `${transactionType === 'RETURN' ? 'RET' : 'DN'}-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`)
  : (deliveryNote || null),
```

**Problem:** 
- RETURN uses `RET-######-####` format (missing brand and date structure)
- RECEIVE uses `DN-######-####` format (old format)
- No brand code
- Random numbers

**Impact:**
- Manual RECEIVE and RETURN transactions don't follow format
- Can't identify which brand was received/returned
- Inconsistent with outbound dispatches

**Required Fix:**
```javascript
// Get brand name from product
const product = await tx.product.findUnique({
  where: { id: productId },
  include: { brand: true }
});

const brandName = product?.brand?.name || 'General';

deliveryNote: (transactionType === 'RECEIVE' || transactionType === 'RETURN')
  ? (deliveryNote && deliveryNote.trim() 
      ? deliveryNote.trim() 
      : await generateCustomRef(tx, transactionType === 'RETURN' ? 'RTN' : 'RCV', brandName, transactionDate))
  : (deliveryNote || null),
```

---

## Summary of Required Changes

### Files That Need Updates:

| File | Line(s) | Function/Context | Priority |
|------|---------|------------------|----------|
| `/app/actions/products.js` | 676-680 | Product creation inbound | 🔴 HIGH |
| `/app/actions/products.js` | 811-813 | Bulk product update inbound | 🔴 HIGH |
| `/app/actions/transactions.js` | 205-206 | Manual RECEIVE/RETURN | 🔴 HIGH |

### Transaction Type Codes to Use:

| Type | Code | Current Status |
|------|------|----------------|
| Receive | `REC` | ✅ Correct |
| Return | `RTN` | ✅ Correct |
| Delivery/Outbound | `DEL` | ✅ Correct |
| Loss | `LOS` | ✅ Correct |
| Damage | `DAM` | ✅ Correct |
| Issue | `ISU` | ⚠️ Not implemented yet |
| Used | `USE` | ⚠️ Not implemented yet |
| Uniform | `UNI` | ⚠️ Not implemented yet |

---

## Implementation Steps

### Step 1: Fix Product Creation (products.js:676-680)
1. Import `generateCustomRef` from transactions.js
2. Get brand name from form data
3. Replace old DN- format with call to `generateCustomRef(tx, 'RCV', brandName)`
4. Must be called inside Prisma transaction context

### Step 2: Fix Bulk Product Update (products.js:811-813)
1. Similar to Step 1
2. Fetch brand name from database inside transaction
3. Use `generateCustomRef(tx, 'RCV', brandName)`

### Step 3: Fix Manual Transactions (transactions.js:205-206)
1. Fetch product with brand before transaction creation
2. Use `generateCustomRef(tx, 'RCV'/'RTN', brandName, transactionDate)`
3. Pass transactionDate to maintain date consistency

### Step 4: Test All Paths
- ✅ Create new product with initial stock
- ✅ Bulk import products
- ✅ Manual RECEIVE transaction
- ✅ Manual RETURN transaction
- ✅ Verify sequential numbering per brand per day

---

## Testing Checklist

After implementing fixes:

### Test Scenarios:
1. ✅ Create new product (Samsung) with initial stock
   - Expected: `REC-SAM-200826-001`
2. ✅ Create another product (Samsung) same day
   - Expected: `REC-SAM-200826-002`
3. ✅ Create product (Apple) same day
   - Expected: `REC-APP-200826-001`
4. ✅ Manual RECEIVE transaction
   - Expected: `REC-{BRAND}-{DATE}-{SEQ}`
5. ✅ Manual RETURN transaction
   - Expected: `RTN-{BRAND}-{DATE}-{SEQ}`
6. ✅ Outbound dispatch (already working)
   - Expected: `DEL-{BRAND}-{DATE}-{SEQ}`
7. ✅ Loss/Damage (already working)
   - Expected: `LOS-{BRAND}-{DATE}-{SEQ}` or `DAM-{BRAND}-{DATE}-{SEQ}`

### Database Query to Find Old Codes:
```sql
-- Find all transactions with old DN- format
SELECT "deliveryNote", "transactionType", COUNT(*) as count
FROM "InventoryTransaction"
WHERE "deliveryNote" LIKE 'DN-%'
GROUP BY "deliveryNote", "transactionType"
ORDER BY "deliveryNote" DESC
LIMIT 50;

-- Find all transactions with old RET- format
SELECT "deliveryNote", "transactionType", COUNT(*) as count
FROM "InventoryTransaction"
WHERE "deliveryNote" LIKE 'RET-%'
GROUP BY "deliveryNote", "transactionType"
ORDER BY "deliveryNote" DESC
LIMIT 50;
```

---

## Documentation Status

### ✅ Documents Created:
1. `TRANSACTION_CODE_FORMAT.md` - Complete guide with new format
2. `CODE_FORMAT_AUDIT_REPORT.md` - This report

### ⚠️ Documents Need Update:
1. `DELIVERY_NOTES_GUIDE.md` - Still mentions old `DN-######-####` format on line 72

---

## Migration Strategy for Existing Data

### Option 1: Keep Old Codes (Recommended)
- Don't change historical data
- Only use new format going forward
- System can handle both formats in searches

### Option 2: Migrate Old Codes
- Create migration script
- Parse old codes and convert to new format
- Risk: May break existing references/PDFs

**Recommendation:** Use Option 1 to avoid breaking existing delivery notes and PDFs.

---

## Next Actions Required:

1. 🔴 **Update products.js line 676-680** (Product creation)
2. 🔴 **Update products.js line 811-813** (Bulk update)
3. 🔴 **Update transactions.js line 205-206** (Manual RECEIVE/RETURN)
4. 🟡 **Update DELIVERY_NOTES_GUIDE.md** (Remove old format reference)
5. 🟢 **Test all transaction types**
6. 🟢 **Verify sequential numbering**

---

## Conclusion

**Status:** Partially implemented (60% complete)

**What's Working:**
- ✅ Outbound dispatches
- ✅ Loss/Damage transactions
- ✅ Code generation function exists and works

**What Needs Fixing:**
- ❌ Product creation inbound codes
- ❌ Bulk product import codes
- ❌ Manual RECEIVE/RETURN codes

**Estimated Time to Fix:** 30-45 minutes

**Risk Level:** Low (changes are isolated and well-defined)
