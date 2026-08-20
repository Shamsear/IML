# PDF Generation Routes Summary

## Overview
All transaction types now have dedicated PDF generation routes with appropriate note titles.

---

## ✅ Available PDF Routes

### 1. Receive Note PDF
**Route:** `/api/dashboard/inbound/delivery-note`  
**Title:** "RECEIVE NOTE"  
**Transaction Type:** RECEIVE  
**Query Parameters:**
- `date` - YYYY-MM-DD format
- `brandId` - Brand UUID
- `dn` - Delivery note code or "UNASSIGNED"

**Example:**
```
GET /api/dashboard/inbound/delivery-note?date=2026-08-20&brandId=xxx&dn=REC-SAM-200826-001
```

---

### 2. Delivery Note PDF
**Route:** `/api/dashboard/stores/[id]/delivery-note`  
**Title:** "DELIVERY NOTE"  
**Transaction Type:** ISSUE (Outbound)  
**Query Parameters:**
- `date` - YYYY-MM-DD format
- `brandId` - Brand UUID
- `dn` - Delivery note code or "UNASSIGNED"

**Example:**
```
GET /api/dashboard/stores/STORE-123/delivery-note?date=2026-08-20&brandId=xxx&dn=DN-SAM-200826-001
```

---

### 3. Return Note PDF ✨ NEW
**Route:** `/api/dashboard/returns/delivery-note`  
**Title:** "RETURN NOTE"  
**Transaction Type:** RETURN  
**Query Parameters:**
- `date` - YYYY-MM-DD format
- `brandId` - Brand UUID
- `dn` - Delivery note code or "UNASSIGNED"

**Example:**
```
GET /api/dashboard/returns/delivery-note?date=2026-08-20&brandId=xxx&dn=RTN-SAM-200826-001
```

**Signature Labels:**
- PREPARED BY
- CHECKED BY
- AUTHORIZED BY

---

### 4. Damage Note PDF ✨ NEW
**Route:** `/api/dashboard/damage/delivery-note`  
**Title:** "DAMAGE NOTE"  
**Transaction Type:** DAMAGE  
**Query Parameters:**
- `date` - YYYY-MM-DD format
- `brandId` - Brand UUID
- `dn` - Delivery note code or "UNASSIGNED"

**Example:**
```
GET /api/dashboard/damage/delivery-note?date=2026-08-20&brandId=xxx&dn=DAM-SAM-200826-001
```

**Signature Labels:**
- REPORTED BY
- VERIFIED BY
- AUTHORIZED BY

---

### 5. Loss Note PDF ✨ NEW
**Route:** `/api/dashboard/loss/delivery-note`  
**Title:** "LOSS NOTE"  
**Transaction Type:** LOST  
**Query Parameters:**
- `date` - YYYY-MM-DD format
- `brandId` - Brand UUID
- `dn` - Delivery note code or "UNASSIGNED"

**Example:**
```
GET /api/dashboard/loss/delivery-note?date=2026-08-20&brandId=xxx&dn=LOS-SAM-200826-001
```

**Signature Labels:**
- REPORTED BY
- VERIFIED BY
- AUTHORIZED BY

---

## 📋 Common Features

All PDFs include:
- ✅ IML Company branding
- ✅ Company logo
- ✅ Warehouse information
- ✅ Brand name
- ✅ Date and Document number
- ✅ 28-row items table
- ✅ Product descriptions and quantities
- ✅ Serial numbers (for serialized items)
- ✅ Remarks/Notes field
- ✅ Signature footer with 3 signatures
- ✅ Professional border and layout

---

## 🎨 PDF Layout Structure

```
┌─────────────────────────────────────────────┐
│                                             │
│          [NOTE TYPE] NOTE TITLE             │
│                                             │
│  THE IML GROUP            [LOGO]            │
│  Address & Contact                          │
│                                             │
│  ┌──────────────┬──────────────┐           │
│  │ Warehouse    │ Date         │           │
│  │ Brand        │ Document No  │           │
│  │ Supplier/    │              │           │
│  │ Store/Notes  │              │           │
│  └──────────────┴──────────────┘           │
│                                             │
│  ┌──────────────────────────────┐          │
│  │ SL │ DESCRIPTION │ QTY │ REM │          │
│  ├────┼─────────────┼─────┼─────┤          │
│  │ 1  │ Product...  │  5  │ ... │          │
│  │ 2  │             │     │     │          │
│  │ ...│             │     │     │          │
│  │ 28 │             │     │     │          │
│  └──────────────────────────────┘          │
│                                             │
│  ┌──────────────────────────────┐          │
│  │  -------    -------    ----   │          │
│  │ PREPARED   CHECKED   RECEIVED │          │
│  └──────────────────────────────┘          │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🔗 Integration with UI

### Frontend Usage Example

```javascript
// Download Return Note PDF
const downloadReturnNote = async (date, brandId, deliveryNote) => {
  const url = `/api/dashboard/returns/delivery-note?date=${date}&brandId=${brandId}&dn=${deliveryNote}`;
  window.open(url, '_blank');
};

// Download Damage Note PDF
const downloadDamageNote = async (date, brandId, deliveryNote) => {
  const url = `/api/dashboard/damage/delivery-note?date=${date}&brandId=${brandId}&dn=${deliveryNote}`;
  window.open(url, '_blank');
};

// Download Loss Note PDF
const downloadLossNote = async (date, brandId, deliveryNote) => {
  const url = `/api/dashboard/loss/delivery-note?date=${date}&brandId=${brandId}&dn=${deliveryNote}`;
  window.open(url, '_blank');
};
```

---

## 📊 Transaction Type → PDF Mapping

| Transaction Type | Code | PDF Route | PDF Title |
|------------------|------|-----------|-----------|
| RECEIVE | `REC` | `/api/dashboard/inbound/delivery-note` | RECEIVE NOTE |
| ISSUE (Outbound) | `DN` | `/api/dashboard/stores/[id]/delivery-note` | DELIVERY NOTE |
| RETURN | `RTN` | `/api/dashboard/returns/delivery-note` | RETURN NOTE |
| DAMAGE | `DAM` | `/api/dashboard/damage/delivery-note` | DAMAGE NOTE |
| LOST | `LOS` | `/api/dashboard/loss/delivery-note` | LOSS NOTE |

---

## ✅ Files Created

1. ✅ `/app/api/dashboard/inbound/delivery-note/route.js` (Updated - "RECEIVE NOTE")
2. ✅ `/app/api/dashboard/stores/[id]/delivery-note/route.js` (Existing - "DELIVERY NOTE")
3. ✅ `/app/api/dashboard/returns/delivery-note/route.js` (NEW - "RETURN NOTE")
4. ✅ `/app/api/dashboard/damage/delivery-note/route.js` (NEW - "DAMAGE NOTE")
5. ✅ `/app/api/dashboard/loss/delivery-note/route.js` (NEW - "LOSS NOTE")

---

## 🚀 Testing

To test each PDF route:

1. **Receive Note:**
   ```
   http://localhost:3000/api/dashboard/inbound/delivery-note?date=2026-08-20&brandId=BRAND-ID&dn=REC-SAM-200826-001
   ```

2. **Delivery Note:**
   ```
   http://localhost:3000/api/dashboard/stores/STORE-ID/delivery-note?date=2026-08-20&brandId=BRAND-ID&dn=DN-SAM-200826-001
   ```

3. **Return Note:**
   ```
   http://localhost:3000/api/dashboard/returns/delivery-note?date=2026-08-20&brandId=BRAND-ID&dn=RTN-SAM-200826-001
   ```

4. **Damage Note:**
   ```
   http://localhost:3000/api/dashboard/damage/delivery-note?date=2026-08-20&brandId=BRAND-ID&dn=DAM-SAM-200826-001
   ```

5. **Loss Note:**
   ```
   http://localhost:3000/api/dashboard/loss/delivery-note?date=2026-08-20&brandId=BRAND-ID&dn=LOS-SAM-200826-001
   ```

---

## 📝 Notes

- All PDFs use A4 page size
- PDFs are displayed inline in browser (can be downloaded from browser)
- Serial numbers are displayed in remarks column for serialized items
- Global notes appear in the metadata box
- Item-specific notes appear in the remarks column
- All signatures have dashed lines above labels
- Professional layout with IML branding maintained across all types

---

**Status:** ✅ Complete  
**Date:** August 20, 2026  
**Total PDF Routes:** 5
