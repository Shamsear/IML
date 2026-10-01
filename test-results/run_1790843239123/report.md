# Headless Browser Automated Audit Report

**Run ID**: `run_1790843239123`  
**Timestamp**: 2026-10-01T08:27:19.124Z  
**Base URL**: `http://localhost:3000`  

---

## 📊 Summary

| Metric | Value |
| :--- | :--- |
| **Total Test Steps** | **19** |
| **Passed Steps** | ✅ **19** |
| **Failed Steps** | ❌ **0** |
| **Console Errors** | ⚠️ **1** |
| **Network Errors (4xx/5xx)** | 🌐 **0** |
| **Page JS Exceptions** | 💥 **0** |

---

## 📋 Detailed Test Steps

| Step | Action Name | Duration | Status | Screenshot |
| :---: | :--- | :---: | :---: | :--- |
| 1 | **01_Visit_Login_Page** | 1.54s | ✅ PASSED | [`00_01_Visit_Login_Page.png`](./screenshots/00_01_Visit_Login_Page.png) |
| 2 | **02_Admin_Authentication_And_Dashboard_Entry** | 33.27s | ✅ PASSED | [`01_02_Admin_Authentication_And_Dashboard_Entry.png`](./screenshots/01_02_Admin_Authentication_And_Dashboard_Entry.png) |
| 3 | **03_Dashboard_Overview_Cards** | 3.29s | ✅ PASSED | [`02_03_Dashboard_Overview_Cards.png`](./screenshots/02_03_Dashboard_Overview_Cards.png) |
| 4 | **04_Navigate_Brands_List** | 10.13s | ✅ PASSED | [`03_04_Navigate_Brands_List.png`](./screenshots/03_04_Navigate_Brands_List.png) |
| 5 | **05_Create_New_Brand** | 22.28s | ✅ PASSED | [`04_05_Create_New_Brand.png`](./screenshots/04_05_Create_New_Brand.png) |
| 6 | **06_Inspect_Brand_Detail_And_Portal** | 3.15s | ✅ PASSED | [`05_06_Inspect_Brand_Detail_And_Portal.png`](./screenshots/05_06_Inspect_Brand_Detail_And_Portal.png) |
| 7 | **07_Navigate_Stores_List** | 8.95s | ✅ PASSED | [`06_07_Navigate_Stores_List.png`](./screenshots/06_07_Navigate_Stores_List.png) |
| 8 | **08_Create_New_Store** | 25.51s | ✅ PASSED | [`07_08_Create_New_Store.png`](./screenshots/07_08_Create_New_Store.png) |
| 9 | **09_Create_New_Supervisor** | 47.47s | ✅ PASSED | [`08_09_Create_New_Supervisor.png`](./screenshots/08_09_Create_New_Supervisor.png) |
| 10 | **10_Create_New_Product** | 32.57s | ✅ PASSED | [`09_10_Create_New_Product.png`](./screenshots/09_10_Create_New_Product.png) |
| 11 | **11_Staff_Management_And_Assign** | 22.05s | ✅ PASSED | [`10_11_Staff_Management_And_Assign.png`](./screenshots/10_11_Staff_Management_And_Assign.png) |
| 12 | **12_Inbound_Deliveries_Ledger_And_New** | 20.72s | ✅ PASSED | [`11_12_Inbound_Deliveries_Ledger_And_New.png`](./screenshots/11_12_Inbound_Deliveries_Ledger_And_New.png) |
| 13 | **13_Outbound_Deliveries_Ledger_And_New** | 17.21s | ✅ PASSED | [`12_13_Outbound_Deliveries_Ledger_And_New.png`](./screenshots/12_13_Outbound_Deliveries_Ledger_And_New.png) |
| 14 | **14_Client_Returns_And_Balances** | 24.93s | ✅ PASSED | [`13_14_Client_Returns_And_Balances.png`](./screenshots/13_14_Client_Returns_And_Balances.png) |
| 15 | **15_Damage_And_Loss_Flow** | 37.66s | ✅ PASSED | [`14_15_Damage_And_Loss_Flow.png`](./screenshots/14_15_Damage_And_Loss_Flow.png) |
| 16 | **16_Rebrand_And_Repurpose_Flow** | 13.15s | ✅ PASSED | [`15_16_Rebrand_And_Repurpose_Flow.png`](./screenshots/15_16_Rebrand_And_Repurpose_Flow.png) |
| 17 | **17_Ledgers_Transactions_Expiry_Used_Reports_Settings** | 126.08s | ✅ PASSED | [`16_17_Ledgers_Transactions_Expiry_Used_Reports_Settings.png`](./screenshots/16_17_Ledgers_Transactions_Expiry_Used_Reports_Settings.png) |
| 18 | **18_Global_Search_Feature** | 30.45s | ✅ PASSED | [`17_18_Global_Search_Feature.png`](./screenshots/17_18_Global_Search_Feature.png) |
| 19 | **19_Security_Invalid_Credentials_Rejection** | 10.23s | ✅ PASSED | [`18_19_Security_Invalid_Credentials_Rejection.png`](./screenshots/18_19_Security_Invalid_Credentials_Rejection.png) |




---

## ⚠️ Browser Console Errors Detected

| URL | Error Message | Time |
| :--- | :--- | :--- |
| `http://localhost:3000/dashboard/staff/assign` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <RedirectBoundary>       <RedirectErrorBoundary router={{...}}>         <InnerLayoutRouter url="/dashboard..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} segmentPath={[...]} ...>           <SegmentViewNode type="page" pagePath="dashboard/...">             <SegmentTrieNode>             <AssignPage>               <AssignClient staffList={[...]} stores={[...]} initialAllocation={null} editStaffObj={null}>                 <div className="flex flex-...">                   <header>                   <form onSubmit={function handleBulkSubmit} className="flex flex-...">                     <div className="flex flex-...">                       <div className={"bg-surfa..."}>                         <div className="p-6 sm:p-8...">                           <div>                           <div className="flex flex-...">                             <div className="flex items...">                               <label className="flex items...">                                 <input                                   type="radio" +                                 name="promoterType-item-1790843450153-0-n5liho559" -                                 name="promoterType-item-1790843448972-0-1vg24idxl"                                   checked={true}                                   onChange={function onChange}                                   className="accent-primary"                                 >                                 ...                               <label className="flex items...">                                 <input                                   type="radio" +                                 name="promoterType-item-1790843450153-0-n5liho559" -                                 name="promoterType-item-1790843448972-0-1vg24idxl"                                   checked={false}                                   onChange={function onChange}                                   className="accent-primary"                                 >                                 ...                             ...                           ...                     ...           ...         ... ` | 2026-10-01T08:30:50.189Z |





---
*Generated automatically by Antigravity Headless Audit Agent.*
