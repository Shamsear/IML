# Note Terminology Update Plan

## Overview
Update "Delivery Note" terminology to be context-specific based on transaction type.

---

## Terminology Mapping

| Transaction Type | Note Name | Example Code |
|-----------------|-----------|--------------|
| RECEIVE | **Receive Note** | `REC-SAM-200826-001` |
| RETURN | **Return Note** | `RTN-APP-200826-003` |
| ISSUE (to store) | **Delivery Note** | `DEL-LGE-200826-005` |
| LOST | **Loss Note** | `LOS-SON-200826-002` |
| DAMAGE | **Damage Note** | `DAM-HUA-200826-001` |
| USED | **Usage Note** | `USE-SAM-200826-004` |
| UNIFORM | **Uniform Note** | `UNI-GEN-200826-015` |

---

## Implementation Strategy

### Phase 1: Create Helper Function ✅
- [x] Created `/lib/transactionHelpers.js`
- [x] Function: `getTransactionNoteName(type, code)`
- [x] Function: `parseTransactionCode(code)`
- [x] Function: `getTransactionTypeColor(type)`

### Phase 2: Update UI Components
Update all components to use dynamic note names based on transaction type.

---

## Files to Update

### 1. Column Headers (Dynamic Labels)

#### Transactions Page
**File:** `/app/dashboard/transactions/TransactionsClient.js`
- Current: Static "Delivery Note" column header
- Update: Keep as "Note #" or "Reference" (generic for all types)
- Cell content: Use `getTransactionNoteName()` in tooltip

#### Inbound Page
**File:** `/app/dashboard/inbound/InboundLedgerClient.js`
- Current: "Delivery Note" column
- Update: "Receive Note" (since all inbound are RECEIVE type)

#### Outbound Page
**File:** `/app/dashboard/outbound/OutboundLedgerClient.js`
- Current: "Delivery Note" column
- Update: "Delivery Note" (correct - outbound to stores)

#### Returns Page
**File:** `/app/dashboard/returns/ReturnsClient.js`
- Current: "Delivery Note" references
- Update: "Return Note"

#### Loss Page
**File:** `/app/dashboard/loss/page.js`
- Update: "Loss Note" where applicable

#### Used Page
**File:** `/app/dashboard/used/UsedClient.js`
- Current: "By Delivery Note" tab, "Disposable delivery notes"
- Update: "By Usage Note", "Disposable usage notes"

---

### 2. Buttons and Actions

#### CopyDeliveryNoteButton Component
**File:** `/components/CopyDeliveryNoteButton.js`
- Props needed: Add `noteType` prop
- Update prompt text dynamically
- Keep component name (internal), change display text

**Updates:**
```javascript
// Inbound usage
<CopyDeliveryNoteButton type="inbound" noteType="Receive" />
// Display: "Copy by Receive Note"

// Outbound usage  
<CopyDeliveryNoteButton type="outbound" noteType="Delivery" />
// Display: "Copy by Delivery Note"
```

#### TransactionActions Component
**File:** `/components/TransactionActions.js`
- Add `transactionType` prop
- Use `getTransactionNoteName()` for tooltips
- Update "Edit entire Delivery Note" → "Edit entire {Note Type}"

---

### 3. Form Labels

#### Products Page (Inbound Entry)
**File:** `/app/dashboard/products/ProductsClient.js`
- Line ~1002: "Delivery Note (Optional)"
- Update: "Receive Note (Optional)"

#### Inbound New/Edit Pages
- Labels: "Delivery Note" → "Receive Note"

#### Outbound New/Edit Pages
- Keep: "Delivery Note" (correct)

---

### 4. Search Placeholders

#### Used Page
**File:** `/app/dashboard/used/UsedClient.js`
- "Search Delivery Note..." → "Search Usage Note..."

#### Returns Page
**File:** `/app/dashboard/returns/ReturnsClient.js`
- "Search Delivery Note..." → "Search Return Note..."

#### Inbound Page
**File:** `/app/dashboard/inbound/InboundLedgerClient.js`
- "Search Delivery Note..." → "Search Receive Note..."

#### Outbound Page
**File:** `/app/dashboard/outbound/OutboundLedgerClient.js`
- Keep: "Search Delivery Note..." (correct)

---

### 5. Tab Labels

#### Used Page
- "By Delivery Note" → "By Usage Note"

#### Returns Page
- "By Delivery Note" → "By Return Note"

---

### 6. PDF/API Endpoints

#### Store Details PDF
**File:** `/app/api/dashboard/stores/[storeId]/delivery-note/route.js`
- Keep endpoint name (for backward compatibility)
- Update PDF title dynamically based on content
- If mixed types, use "Transaction Note"

---

### 7. Documentation

#### DELIVERY_NOTES_GUIDE.md
- Rename to: `TRANSACTION_NOTES_GUIDE.md`
- Update all references to be type-specific
- Add section explaining different note types

---

## Implementation Order

### Step 1: Helper Function (Done ✅)
Created `/lib/transactionHelpers.js`

### Step 2: Update Generic Components
1. Update `CopyDeliveryNoteButton` to accept `noteType` prop
2. Update `TransactionActions` to use `getTransactionNoteName()`

### Step 3: Update Page-Specific Components
1. Inbound pages → "Receive Note"
2. Returns pages → "Return Note"
3. Used pages → "Usage Note"
4. Outbound pages → "Delivery Note" (already correct)
5. Loss pages → "Loss Note"
6. Damage pages → "Damage Note"

### Step 4: Update Forms
1. Product creation forms
2. Transaction creation forms
3. Edit forms

### Step 5: Update Documentation
1. Rename guide
2. Update all references
3. Add note type explanations

---

## Code Examples

### Using Helper in React Component

```javascript
import { getTransactionNoteName, getTransactionNoteShortName } from '@/lib/transactionHelpers';

// In component
const noteName = getTransactionNoteName(transaction.transactionType, transaction.deliveryNote);
// Returns: "Receive Note", "Return Note", "Delivery Note", etc.

const shortName = getTransactionNoteShortName(transaction.transactionType, transaction.deliveryNote);
// Returns: "Receive", "Return", "Delivery", etc.
```

### Dynamic Column Header

```javascript
<th className="py-3 px-5 text-left">
  {transactionType === 'RECEIVE' ? 'Receive Note' : 
   transactionType === 'RETURN' ? 'Return Note' :
   transactionType === 'ISSUE' ? 'Delivery Note' : 'Note #'}
</th>
```

### Dynamic Button Text

```javascript
<button>
  Copy by {noteTypeName}
</button>
```

---

## Testing Checklist

After updates:

- [ ] Inbound page shows "Receive Note"
- [ ] Outbound page shows "Delivery Note"
- [ ] Returns page shows "Return Note"
- [ ] Used page shows "Usage Note"
- [ ] Loss reports show "Loss Note"
- [ ] Damage reports show "Damage Note"
- [ ] Copy buttons use correct terminology
- [ ] Form labels match transaction type
- [ ] Search placeholders match transaction type
- [ ] Tooltips show correct note type
- [ ] PDFs have correct titles

---

## Backward Compatibility

### Database
- Column name stays as `deliveryNote` (no schema change needed)
- Old codes still work in queries
- New codes follow new format

### API Endpoints
- Keep existing endpoint names
- Add aliases if needed
- Document both in API docs

### UI
- Progressive enhancement
- If `transactionType` not available, fallback to "Note" or "Delivery Note"

---

## Summary

**Goal:** Make terminology context-aware and user-friendly

**Before:**
- Everything called "Delivery Note"
- Confusing for non-delivery transactions

**After:**
- Receive Note for RECEIVE
- Return Note for RETURN
- Delivery Note for ISSUE
- Loss Note for LOST
- Damage Note for DAMAGE
- Usage Note for USED
- Uniform Note for UNIFORM

**Benefit:** Clear, context-specific terminology that matches user mental model
