# Transaction Code Format Guide

## Standard Format
All transaction codes follow this pattern:
```
{TYPE}-{BBB}-{DDMMYY}-{NNN}
```

### Components:
1. **TYPE** - Transaction type code (3 letters)
2. **BBB** - Brand code (3 letters, uppercase)
3. **DDMMYY** - Date in day-month-year format
4. **NNN** - Sequential number (3 digits, zero-padded, resets daily per brand)

---

## Transaction Type Codes

### Inbound Operations
- **`REC`** - Received (items coming into inventory from suppliers)
- **`RTN`** - Return (items returned by stores/customers)
- **`INB`** - Inbound Transfer (items transferred in from other locations)

### Outbound Operations
- **`DN`** - Delivery Note (outbound dispatches, items delivered to stores/customers)
- **`ISU`** - Issue (items issued to departments)

### Internal Operations
- **`USE`** - Used (items consumed internally)
- **`LOS`** - Loss (items lost/missing)
- **`DAM`** - Damage (items damaged/broken)
- **`UNI`** - Uniform Assignment (uniforms assigned to employees)
- **`ADJ`** - Adjustment (inventory corrections)

### Special Operations
- **`TRN`** - Transfer (between warehouses)
- **`REL`** - Release (from quarantine/holding)
- **`QTN`** - Quarantine (items set aside for inspection)

---

## Brand Codes

### Electronics Brands
- **`SAM`** - Samsung
- **`APP`** - Apple
- **`LGE`** - LG Electronics
- **`SON`** - Sony
- **`HUA`** - Huawei
- **`XIE`** - Xiaomi
- **`OPO`** - Oppo
- **`VVO`** - Vivo
- **`ONE`** - OnePlus

### Home Appliances
- **`WHR`** - Whirlpool
- **`BOH`** - Bosch
- **`ELX`** - Electrolux
- **`HAR`** - Haier

### Other Brands
- **`GEN`** - Generic/Unbranded
- **`MIX`** - Mixed Brands
- **`OTH`** - Other

*(Add your actual brand codes as needed)*

---

## Code Examples

### Inbound Examples
```
REC-SAM-200826-001  → First Samsung item received on Aug 20, 2026
REC-APP-200826-012  → 12th Apple item received on Aug 20, 2026
RTN-LGE-200826-003  → 3rd LG return on Aug 20, 2026
INB-SON-200826-007  → 7th Sony inbound transfer on Aug 20, 2026
```

### Outbound Examples
```
DN-SAM-200826-004   → 4th Samsung delivery on Aug 20, 2026
ISU-APP-200826-015  → 15th Apple issue on Aug 20, 2026
DN-HUA-200826-002   → 2nd Huawei delivery on Aug 20, 2026
```

### Internal Examples
```
USE-SAM-200826-001  → First Samsung item used internally today
LOS-APP-200826-001  → First Apple loss reported today
DAM-LGE-200826-002  → 2nd LG damage report today
UNI-GEN-200826-008  → 8th uniform assignment today
ADJ-SON-200826-003  → 3rd Sony inventory adjustment today
```

### Special Examples
```
TRN-SAM-200826-005  → 5th Samsung transfer today
REL-APP-200826-001  → First Apple release from quarantine today
QTN-LGE-200826-002  → 2nd LG item quarantined today
```

---

## Implementation Rules

### Code Generation
1. **TYPE**: Select from predefined list based on transaction
2. **BBB**: Use brand's 3-letter code (uppercase)
3. **DDMMYY**: Auto-generate from current date
4. **NNN**: Auto-increment per brand per day (001, 002, 003...)

### Sequential Number Reset
- Resets to `001` every day at midnight
- Independent counters for each brand
- Independent counters for each transaction type

Example: On Aug 20, 2026:
- `REC-SAM-200826-001` (first Samsung received)
- `DN-SAM-200826-001` (first Samsung delivery - different counter)
- `REC-APP-200826-001` (first Apple received - different brand)

### Code Uniqueness
Each code is guaranteed unique by combining:
- Transaction type
- Brand code
- Date
- Sequential number

---

## Admin Benefits

### Easy Identification
```
REC-SAM-200826-015  →  "Received Samsung item #15 on Aug 20"
DAM-APP-200826-003  →  "3rd Apple damage report on Aug 20"
UNI-GEN-200826-042  →  "42nd uniform assigned on Aug 20"
```

### Searchable & Filterable
- Search by type: `REC-*` → All received items
- Search by brand: `*-SAM-*` → All Samsung transactions
- Search by date: `*-200826-*` → All transactions on Aug 20
- Combined: `REC-SAM-*` → All Samsung received items

### Sortable
- Sorts chronologically by date
- Groups by brand when sorted alphabetically
- Easy to track daily volumes per brand

### Reportable
- Count daily transactions by type
- Track brand-specific movements
- Identify patterns (frequent losses, damages)
- Monitor uniform assignments

---

## Database Implementation

### Schema Suggestion
```javascript
{
  transactionCode: "REC-SAM-200826-001",
  type: "REC",
  brandCode: "SAM",
  date: "2026-08-20",
  sequenceNumber: 1,
  // ... other fields
}
```

### Index Recommendations
- Index on `transactionCode` (unique)
- Compound index on `type + brandCode + date`
- Index on `date` for date range queries

### Code Generation Function
```javascript
async function generateTransactionCode(type, brandCode) {
  const today = new Date();
  const dateStr = format(today, 'ddMMyy');
  
  // Get last sequence number for this type + brand + date
  const lastTransaction = await db.transaction.findFirst({
    where: {
      type: type,
      brandCode: brandCode,
      date: startOfDay(today)
    },
    orderBy: { sequenceNumber: 'desc' }
  });
  
  const nextSeq = (lastTransaction?.sequenceNumber || 0) + 1;
  const seqStr = String(nextSeq).padStart(3, '0');
  
  return `${type}-${brandCode}-${dateStr}-${seqStr}`;
}
```

---

## Migration Strategy

### For Existing Data
1. **Keep old codes** - Don't change historical data
2. **Add new field** - `legacyCode` for old format
3. **Use new format** - For all new transactions going forward
4. **Display both** - Show old code if exists, otherwise new code

### Transition Period
- **Week 1**: System generates new codes alongside old
- **Week 2**: Train staff on new format
- **Week 3**: Switch to new format exclusively
- **Ongoing**: Old codes remain searchable

---

## Future Extensions

### Easy to Add New Types
Need a new transaction type? Just add to the list:
```
SHP - Shipment
RFB - Refurbishment  
RPR - Repair
MNT - Maintenance
```

### Easy to Add New Brands
New brand? Just define the 3-letter code:
```
REA - Realme
TEL - Telekom
MOT - Motorola
```

### Flexible for Growth
- Can extend to 4-letter type codes if needed
- Can use longer sequence numbers (NNNN) if volume increases
- Format remains consistent and recognizable

---

## Summary

✅ **Consistent format** across all transaction types  
✅ **Human-readable** codes that make sense at a glance  
✅ **Brand-based tracking** for inventory by brand  
✅ **Auto-generated** sequential numbers prevent duplicates  
✅ **Easy to search** and filter in admin panels  
✅ **Scalable** for future growth  
✅ **Professional** appearance on documents  

**Format:** `{TYPE}-{BBB}-{DDMMYY}-{NNN}`  
**Example:** `REC-SAM-200826-001` = "First Samsung item received on Aug 20, 2026"
