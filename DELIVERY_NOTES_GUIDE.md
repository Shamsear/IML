# Delivery Notes - Complete Guide

## Where to Find Delivery Notes

Delivery notes can be accessed from **3 different locations** in the system:

---

## 1. **Store Details Page** (Primary Location)

**Path:** Dashboard → Stores → Click Store Icon on any store card → Store Details

### Features:
- **Full Store Inventory PDF**: Click "Download Store Stock Statement (PDF)" button at the top
- **Individual Dispatch PDFs**: Scroll to "Delivery Notes (Dispatches)" section, click printer icon on any dispatch

### What's Included:
✅ Company header (THE IML GROUP)
✅ Store name, location, region
✅ Brand name
✅ Date and document number
✅ Receiver name (promoter/staff at store)
✅ Contact details
✅ Product list with quantities
✅ Serial numbers (for serialized items)
✅ Signature fields (Prepared By, Checked By, Received By)

---

## 2. **Transactions Page** (New! ✨)

**Path:** Dashboard → Transactions

### Features:
- View all inventory movements in a ledger
- **Clickable Delivery Note numbers** in the "Delivery Note" column
- Click any delivery note number to download the PDF

### When Available:
- Only for transactions where:
  - ✅ Transaction has a delivery note number
  - ✅ Destination type is "STORE"
  - ✅ Destination store ID exists

### Visual Indicators:
- **Blue, underlined text** = Clickable delivery note (PDF available)
- **Gray text** = Not clickable (no PDF available)

---

## 3. **Outbound Dispatches Page** (New! ✨)

**Path:** Dashboard → Outbound

### Features:
- View all outbound dispatches (ISSUE transactions)
- **Clickable Delivery Note numbers** in the "Delivery Note" column
- Click any delivery note number to download the PDF

### When Available:
- Same conditions as Transactions page:
  - ✅ Transaction has a delivery note number
  - ✅ Destination type is "STORE"
  - ✅ Destination store ID exists

---

## How Delivery Notes Work

### Automatic Generation
When you create an outbound dispatch to a store, the system:
1. Auto-generates a delivery note number (format: `{TYPE}-{BRAND}-{DDMMYY}-{NNN}`)
   - Example: `DN-SAM-200826-001` (First Samsung delivery on Aug 20, 2026)
2. Records it with the transaction
3. Makes it available for PDF download

### PDF Content
Each delivery note PDF includes:

**Header Section:**
- Company branding (IML Group logo and details)
- Document title: "DELIVERY NOTE"
- Warehouse information

**Metadata:**
- Store name
- Brand name
- Date
- Document number
- Receiver name (staff member at store)
- Contact details
- Notes/remarks

**Items Table:**
- 28 rows for products
- Columns: SL NO., DESCRIPTION, Qty, Remarks
- Serial numbers shown in remarks column (for serialized products)

**Footer:**
- Signature fields for:
  - Prepared By
  - Checked By
  - Received By

### Filtering Options

You can generate filtered delivery notes using URL parameters:

```
/api/dashboard/stores/[storeId]/delivery-note?date=YYYY-MM-DD&brandId=xxx&dn=DN-123456
```

**Parameters:**
- `date` - Filter by specific date (YYYY-MM-DD format)
- `brandId` - Filter by brand UUID
- `dn` - Filter by delivery note number (or "UNASSIGNED")

---

## Quick Access Summary

| Location | How to Access | What You Get |
|----------|---------------|--------------|
| **Store Details** | Stores → View Store | Full inventory or individual dispatch PDFs |
| **Transactions** | Transactions → Click DN number | PDF for that specific dispatch |
| **Outbound** | Outbound → Click DN number | PDF for that specific dispatch |

---

## Visual Guide

### 1. From Stores Page
```
Dashboard
  └─ Stores
      └─ [Click Store Icon] 👁️
          └─ Store Details Page
              ├─ "Download Store Stock Statement (PDF)" [Top button]
              └─ Delivery Notes section [Bottom]
                  └─ [Printer icon] per dispatch
```

### 2. From Transactions Page
```
Dashboard
  └─ Transactions
      └─ Delivery Note Column
          └─ [Click blue delivery note number]
              └─ PDF downloads automatically
```

### 3. From Outbound Page
```
Dashboard
  └─ Outbound
      └─ Delivery Note Column
          └─ [Click blue delivery note number]
              └─ PDF downloads automatically
```

---

## Troubleshooting

### Delivery note not clickable?
**Reason:** The transaction might not be a store dispatch.

**Check:**
- Is the destination type "STORE"?
- Does the transaction have a delivery note number?
- Is there a valid store ID?

### PDF shows "No items present"?
**Reason:** The store has no inventory or no matching dispatches.

**Solution:**
- Ensure products have been dispatched to the store
- Check the date and brand filters if using specific dispatch PDF

### Can't find delivery note number?
**Reason:** Older transactions might not have delivery notes.

**Solution:**
- New dispatches automatically get delivery note numbers
- Old transactions show "N/A" or "---" in the delivery note column

---

## API Endpoint

**Direct API Access:**
```
GET /api/dashboard/stores/[storeId]/delivery-note
```

**Optional Query Parameters:**
- `date` - YYYY-MM-DD
- `brandId` - Brand UUID
- `dn` - Delivery note number

**Response:**
- Content-Type: `application/pdf`
- Downloads as: `IML-DeliveryNote-[StoreName].pdf`

**Authentication:**
- Requires active user session
- Must be logged in to access

---

## Use Cases

### Use Case 1: Print All Store Inventory
1. Go to Stores page
2. Click store icon on desired store
3. Click "Download Store Stock Statement (PDF)"
4. PDF downloads with all current inventory

### Use Case 2: Print Specific Dispatch
1. Go to Transactions or Outbound page
2. Find the dispatch transaction
3. Click the blue delivery note number
4. PDF downloads for that specific dispatch

### Use Case 3: Print from Store Page
1. Go to Stores page
2. Click store icon on desired store
3. Scroll to "Delivery Notes (Dispatches)"
4. Click printer icon on specific dispatch
5. PDF downloads

---

## Features Summary

✅ **Multiple Access Points** - 3 different locations to generate PDFs
✅ **Clickable Links** - Blue, underlined delivery note numbers
✅ **Auto-Generation** - Delivery notes created automatically
✅ **Professional Format** - IML Group branding and layout
✅ **Serial Number Tracking** - Shows serial numbers for serialized products
✅ **Signature Fields** - Ready for physical signatures
✅ **Filtered Reports** - Generate PDFs for specific dates/brands
✅ **Full Inventory** - Or filter by specific dispatches

---

## Updates Made

**Recent Improvements:**
1. ✅ Added clickable delivery note links in Transactions page
2. ✅ Added clickable delivery note links in Outbound page
3. ✅ Added View button (store icon) on Stores page cards
4. ✅ Included brandId in transaction queries for PDF generation

All delivery note numbers that link to store dispatches are now clickable and will download the PDF automatically!
