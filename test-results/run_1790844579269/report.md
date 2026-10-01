# Headless Browser Automated Audit Report

**Run ID**: `run_1790844579269`  
**Timestamp**: 2026-10-01T08:49:39.270Z  
**Base URL**: `http://localhost:3000`  

---

## 📊 Summary

| Metric | Value |
| :--- | :--- |
| **Total Test Steps** | **19** |
| **Passed Steps** | ✅ **1** |
| **Failed Steps** | ❌ **18** |
| **Console Errors** | ⚠️ **1** |
| **Network Errors (4xx/5xx)** | 🌐 **0** |
| **Page JS Exceptions** | 💥 **0** |

---

## 📋 Detailed Test Steps

| Step | Action Name | Duration | Status | Screenshot |
| :---: | :--- | :---: | :---: | :--- |
| 1 | **01_Visit_Login_Page** | 2.39s | ✅ PASSED | [`00_01_Visit_Login_Page.png`](./screenshots/00_01_Visit_Login_Page.png) |
| 2 | **02_Admin_Authentication_And_Dashboard_Entry** | 54.45s | ❌ FAILED | [`01_02_Admin_Authentication_And_Dashboard_Entry.png`](./screenshots/01_02_Admin_Authentication_And_Dashboard_Entry.png) |
| 3 | **03_Dashboard_Overview_Cards** | 13.53s | ❌ FAILED | [`02_03_Dashboard_Overview_Cards.png`](./screenshots/02_03_Dashboard_Overview_Cards.png) |
| 4 | **04_Navigate_Brands_List** | 0.05s | ❌ FAILED | [`03_04_Navigate_Brands_List.png`](./screenshots/03_04_Navigate_Brands_List.png) |
| 5 | **05_Create_New_Brand** | 0.02s | ❌ FAILED | [`04_05_Create_New_Brand.png`](./screenshots/04_05_Create_New_Brand.png) |
| 6 | **06_Inspect_Brand_Detail_And_Portal** | 0.02s | ❌ FAILED | [`05_06_Inspect_Brand_Detail_And_Portal.png`](./screenshots/05_06_Inspect_Brand_Detail_And_Portal.png) |
| 7 | **07_Navigate_Stores_List** | 0.02s | ❌ FAILED | [`06_07_Navigate_Stores_List.png`](./screenshots/06_07_Navigate_Stores_List.png) |
| 8 | **08_Create_New_Store** | 0.02s | ❌ FAILED | [`07_08_Create_New_Store.png`](./screenshots/07_08_Create_New_Store.png) |
| 9 | **09_Create_New_Supervisor** | 0.02s | ❌ FAILED | [`08_09_Create_New_Supervisor.png`](./screenshots/08_09_Create_New_Supervisor.png) |
| 10 | **10_Create_New_Product** | 0.02s | ❌ FAILED | [`09_10_Create_New_Product.png`](./screenshots/09_10_Create_New_Product.png) |
| 11 | **11_Staff_Management_And_Assign** | 0.02s | ❌ FAILED | [`10_11_Staff_Management_And_Assign.png`](./screenshots/10_11_Staff_Management_And_Assign.png) |
| 12 | **12_Inbound_Deliveries_Ledger_And_New** | 0.04s | ❌ FAILED | [`11_12_Inbound_Deliveries_Ledger_And_New.png`](./screenshots/11_12_Inbound_Deliveries_Ledger_And_New.png) |
| 13 | **13_Outbound_Deliveries_Ledger_And_New** | 0.02s | ❌ FAILED | [`12_13_Outbound_Deliveries_Ledger_And_New.png`](./screenshots/12_13_Outbound_Deliveries_Ledger_And_New.png) |
| 14 | **14_Client_Returns_And_Balances** | 0.02s | ❌ FAILED | [`13_14_Client_Returns_And_Balances.png`](./screenshots/13_14_Client_Returns_And_Balances.png) |
| 15 | **15_Damage_And_Loss_Flow** | 0.02s | ❌ FAILED | [`14_15_Damage_And_Loss_Flow.png`](./screenshots/14_15_Damage_And_Loss_Flow.png) |
| 16 | **16_Rebrand_And_Repurpose_Flow** | 0.02s | ❌ FAILED | [`15_16_Rebrand_And_Repurpose_Flow.png`](./screenshots/15_16_Rebrand_And_Repurpose_Flow.png) |
| 17 | **17_Ledgers_Transactions_Expiry_Used_Reports_Settings** | 0.02s | ❌ FAILED | [`16_17_Ledgers_Transactions_Expiry_Used_Reports_Settings.png`](./screenshots/16_17_Ledgers_Transactions_Expiry_Used_Reports_Settings.png) |
| 18 | **18_Global_Search_Feature** | 0.02s | ❌ FAILED | [`17_18_Global_Search_Feature.png`](./screenshots/17_18_Global_Search_Feature.png) |
| 19 | **19_Security_Invalid_Credentials_Rejection** | 0.03s | ❌ FAILED | [`18_19_Security_Invalid_Credentials_Rejection.png`](./screenshots/18_19_Security_Invalid_Credentials_Rejection.png) |


---

## ❌ Step Failures & Errors

### Step 2: 02_Admin_Authentication_And_Dashboard_Entry
- **Error**: `page.waitForURL: Timeout 50000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/dashboard" until "load"
============================================================`
- **Duration**: 54453ms

### Step 3: 03_Dashboard_Overview_Cards
- **Error**: `page.waitForURL: net::ERR_CONNECTION_REFUSED
=========================== logs ===========================
waiting for navigation to "**/dashboard**" until "load"
============================================================`
- **Duration**: 13531ms

### Step 4: 04_Navigate_Brands_List
- **Error**: `page.goto: net::ERR_FAILED at http://localhost:3000/dashboard/brands
Call log:
[2m  - navigating to "http://localhost:3000/dashboard/brands", waiting until "domcontentloaded"[22m
`
- **Duration**: 49ms

### Step 5: 05_Create_New_Brand
- **Error**: `page.goto: net::ERR_FAILED at http://localhost:3000/dashboard/brands/new
Call log:
[2m  - navigating to "http://localhost:3000/dashboard/brands/new", waiting until "domcontentloaded"[22m
`
- **Duration**: 19ms

### Step 6: 06_Inspect_Brand_Detail_And_Portal
- **Error**: `page.goto: net::ERR_FAILED at http://localhost:3000/dashboard/brands
Call log:
[2m  - navigating to "http://localhost:3000/dashboard/brands", waiting until "domcontentloaded"[22m
`
- **Duration**: 18ms

### Step 7: 07_Navigate_Stores_List
- **Error**: `page.goto: net::ERR_FAILED at http://localhost:3000/dashboard/stores
Call log:
[2m  - navigating to "http://localhost:3000/dashboard/stores", waiting until "domcontentloaded"[22m
`
- **Duration**: 19ms

### Step 8: 08_Create_New_Store
- **Error**: `page.goto: net::ERR_FAILED at http://localhost:3000/dashboard/stores/new
Call log:
[2m  - navigating to "http://localhost:3000/dashboard/stores/new", waiting until "domcontentloaded"[22m
`
- **Duration**: 21ms

### Step 9: 09_Create_New_Supervisor
- **Error**: `page.goto: net::ERR_FAILED at http://localhost:3000/dashboard/supervisors/new
Call log:
[2m  - navigating to "http://localhost:3000/dashboard/supervisors/new", waiting until "domcontentloaded"[22m
`
- **Duration**: 18ms

### Step 10: 10_Create_New_Product
- **Error**: `page.goto: net::ERR_FAILED at http://localhost:3000/dashboard/products/new
Call log:
[2m  - navigating to "http://localhost:3000/dashboard/products/new", waiting until "domcontentloaded"[22m
`
- **Duration**: 17ms

### Step 11: 11_Staff_Management_And_Assign
- **Error**: `page.goto: net::ERR_FAILED at http://localhost:3000/dashboard/staff
Call log:
[2m  - navigating to "http://localhost:3000/dashboard/staff", waiting until "domcontentloaded"[22m
`
- **Duration**: 23ms

### Step 12: 12_Inbound_Deliveries_Ledger_And_New
- **Error**: `page.goto: net::ERR_FAILED at http://localhost:3000/dashboard/inbound
Call log:
[2m  - navigating to "http://localhost:3000/dashboard/inbound", waiting until "domcontentloaded"[22m
`
- **Duration**: 36ms

### Step 13: 13_Outbound_Deliveries_Ledger_And_New
- **Error**: `page.goto: net::ERR_FAILED at http://localhost:3000/dashboard/outbound
Call log:
[2m  - navigating to "http://localhost:3000/dashboard/outbound", waiting until "domcontentloaded"[22m
`
- **Duration**: 24ms

### Step 14: 14_Client_Returns_And_Balances
- **Error**: `page.goto: net::ERR_FAILED at http://localhost:3000/dashboard/client-returns
Call log:
[2m  - navigating to "http://localhost:3000/dashboard/client-returns", waiting until "domcontentloaded"[22m
`
- **Duration**: 17ms

### Step 15: 15_Damage_And_Loss_Flow
- **Error**: `page.goto: net::ERR_FAILED at http://localhost:3000/dashboard/damage
Call log:
[2m  - navigating to "http://localhost:3000/dashboard/damage", waiting until "domcontentloaded"[22m
`
- **Duration**: 18ms

### Step 16: 16_Rebrand_And_Repurpose_Flow
- **Error**: `page.goto: net::ERR_FAILED at http://localhost:3000/dashboard/rebrand
Call log:
[2m  - navigating to "http://localhost:3000/dashboard/rebrand", waiting until "domcontentloaded"[22m
`
- **Duration**: 19ms

### Step 17: 17_Ledgers_Transactions_Expiry_Used_Reports_Settings
- **Error**: `page.goto: net::ERR_FAILED at http://localhost:3000/dashboard/transactions
Call log:
[2m  - navigating to "http://localhost:3000/dashboard/transactions", waiting until "domcontentloaded"[22m
`
- **Duration**: 18ms

### Step 18: 18_Global_Search_Feature
- **Error**: `page.goto: net::ERR_FAILED at http://localhost:3000/dashboard
Call log:
[2m  - navigating to "http://localhost:3000/dashboard", waiting until "domcontentloaded"[22m
`
- **Duration**: 16ms

### Step 19: 19_Security_Invalid_Credentials_Rejection
- **Error**: `page.goto: net::ERR_FAILED at http://localhost:3000/login
Call log:
[2m  - navigating to "http://localhost:3000/login", waiting until "domcontentloaded"[22m
`
- **Duration**: 31ms




---

## ⚠️ Browser Console Errors Detected

| URL | Error Message | Time |
| :--- | :--- | :--- |
| `http://localhost:3000/login?callbackUrl=%2Fdashboard` | `Failed to load resource: net::ERR_CONNECTION_REFUSED` | 2026-10-01T08:50:50.988Z |





---
*Generated automatically by Antigravity Headless Audit Agent.*
