# Headless Browser Automated Audit Report

**Run ID**: `run_1790839744606`  
**Timestamp**: 2026-10-01T07:29:04.607Z  
**Base URL**: `http://localhost:3000`  

---

## 📊 Summary

| Metric | Value |
| :--- | :--- |
| **Total Test Steps** | **19** |
| **Passed Steps** | ✅ **16** |
| **Failed Steps** | ❌ **3** |
| **Console Errors** | ⚠️ **2** |
| **Network Errors (4xx/5xx)** | 🌐 **0** |
| **Page JS Exceptions** | 💥 **0** |

---

## 📋 Detailed Test Steps

| Step | Action Name | Duration | Status | Screenshot |
| :---: | :--- | :---: | :---: | :--- |
| 1 | **01_Visit_Login_Page** | 0.94s | ✅ PASSED | [`00_01_Visit_Login_Page.png`](./screenshots/00_01_Visit_Login_Page.png) |
| 2 | **02_Invalid_Login_Validation** | 1.82s | ✅ PASSED | [`01_02_Invalid_Login_Validation.png`](./screenshots/01_02_Invalid_Login_Validation.png) |
| 3 | **03_Valid_Admin_Login** | 14.36s | ✅ PASSED | [`02_03_Valid_Admin_Login.png`](./screenshots/02_03_Valid_Admin_Login.png) |
| 4 | **04_Dashboard_Overview_Cards** | 1.93s | ✅ PASSED | [`03_04_Dashboard_Overview_Cards.png`](./screenshots/03_04_Dashboard_Overview_Cards.png) |
| 5 | **05_Navigate_Brands_List** | 5.77s | ✅ PASSED | [`04_05_Navigate_Brands_List.png`](./screenshots/04_05_Navigate_Brands_List.png) |
| 6 | **06_Create_New_Brand** | 27.56s | ❌ FAILED | [`05_06_Create_New_Brand.png`](./screenshots/05_06_Create_New_Brand.png) |
| 7 | **07_Inspect_Brand_Detail_And_Portal** | 2.58s | ✅ PASSED | [`06_07_Inspect_Brand_Detail_And_Portal.png`](./screenshots/06_07_Inspect_Brand_Detail_And_Portal.png) |
| 8 | **08_Navigate_Stores_List** | 5.26s | ✅ PASSED | [`07_08_Navigate_Stores_List.png`](./screenshots/07_08_Navigate_Stores_List.png) |
| 9 | **09_Create_New_Store** | 22.72s | ❌ FAILED | [`08_09_Create_New_Store.png`](./screenshots/08_09_Create_New_Store.png) |
| 10 | **10_Create_New_Supervisor** | 20.70s | ❌ FAILED | [`09_10_Create_New_Supervisor.png`](./screenshots/09_10_Create_New_Supervisor.png) |
| 11 | **11_Create_New_Product** | 47.35s | ✅ PASSED | [`10_11_Create_New_Product.png`](./screenshots/10_11_Create_New_Product.png) |
| 12 | **12_Staff_Management_And_Assign** | 25.14s | ✅ PASSED | [`11_12_Staff_Management_And_Assign.png`](./screenshots/11_12_Staff_Management_And_Assign.png) |
| 13 | **13_Inbound_Deliveries_Ledger_And_New** | 20.95s | ✅ PASSED | [`12_13_Inbound_Deliveries_Ledger_And_New.png`](./screenshots/12_13_Inbound_Deliveries_Ledger_And_New.png) |
| 14 | **14_Outbound_Deliveries_Ledger_And_New** | 16.55s | ✅ PASSED | [`13_14_Outbound_Deliveries_Ledger_And_New.png`](./screenshots/13_14_Outbound_Deliveries_Ledger_And_New.png) |
| 15 | **15_Client_Returns_And_Balances** | 38.31s | ✅ PASSED | [`14_15_Client_Returns_And_Balances.png`](./screenshots/14_15_Client_Returns_And_Balances.png) |
| 16 | **16_Damage_And_Loss_Flow** | 44.33s | ✅ PASSED | [`15_16_Damage_And_Loss_Flow.png`](./screenshots/15_16_Damage_And_Loss_Flow.png) |
| 17 | **17_Rebrand_And_Repurpose_Flow** | 27.21s | ✅ PASSED | [`16_17_Rebrand_And_Repurpose_Flow.png`](./screenshots/16_17_Rebrand_And_Repurpose_Flow.png) |
| 18 | **18_Ledgers_Transactions_Expiry_Used_Reports_Settings** | 123.84s | ✅ PASSED | [`17_18_Ledgers_Transactions_Expiry_Used_Reports_Settings.png`](./screenshots/17_18_Ledgers_Transactions_Expiry_Used_Reports_Settings.png) |
| 19 | **19_Global_Search_Feature** | 40.94s | ✅ PASSED | [`18_19_Global_Search_Feature.png`](./screenshots/18_19_Global_Search_Feature.png) |


---

## ❌ Step Failures & Errors

### Step 6: 06_Create_New_Brand
- **Error**: `locator.waitFor: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('button:has-text("OK")').first() to be visible[22m
`
- **Duration**: 27560ms

### Step 9: 09_Create_New_Store
- **Error**: `locator.waitFor: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('button:has-text("OK")').first() to be visible[22m
`
- **Duration**: 22718ms

### Step 10: 10_Create_New_Supervisor
- **Error**: `locator.waitFor: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('button:has-text("OK")').first() to be visible[22m
`
- **Duration**: 20696ms




---

## ⚠️ Browser Console Errors Detected

| URL | Error Message | Time |
| :--- | :--- | :--- |
| `http://localhost:3000/login?` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <LoadingBoundary name="login/" loading={null}>       <HTTPAccessFallbackBoundary notFound={undefined} forbidden={undefined} unauthorized={undefined}>         <RedirectBoundary>           <RedirectErrorBoundary router={{...}}>             <InnerLayoutRouter url="/login" tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} segmentPath={[...]} ...>               <SegmentViewNode type="page" pagePath="login/page.js">                 <SegmentTrieNode>                 <LoginPage>                   <LoginForm>                     <div className="relative h...">                       <div>                       <div className="relative w...">                         <div className="relative z...">                           <div>                           <form onSubmit={function handleSubmit} className="flex flex-...">                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <User>                                 <input                                   type="text"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="Enter your username"                                   required={true}                                   disabled={false}                                   autoComplete="username" -                                 style={{caret-color:"transparent"}}                                 >                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <Lock>                                 <input                                   type="password"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="••••••••"                                   required={true}                                   disabled={false}                                   autoComplete="current-password" -                                 style={{caret-color:"transparent"}}                                 >                                 ...                             ...                           ...                         ...               ...             ... ` | 2026-10-01T07:29:08.496Z |
| `http://localhost:3000/dashboard/staff/assign` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <RedirectBoundary>       <RedirectErrorBoundary router={{...}}>         <InnerLayoutRouter url="/dashboard..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} segmentPath={[...]} ...>           <SegmentViewNode type="page" pagePath="dashboard/...">             <SegmentTrieNode>             <AssignPage>               <AssignClient staffList={[...]} stores={[...]} initialAllocation={null} editStaffObj={null}>                 <div className="flex flex-...">                   <header>                   <form onSubmit={function handleBulkSubmit} className="flex flex-...">                     <div className="flex flex-...">                       <div className={"bg-surfa..."}>                         <div className="p-6 sm:p-8...">                           <div>                           <div className="flex flex-...">                             <div className="flex items...">                               <label className="flex items...">                                 <input                                   type="radio" +                                 name="promoterType-item-1790839922738-0-88uj0btyf" -                                 name="promoterType-item-1790839921585-0-enn6hqu92"                                   checked={true}                                   onChange={function onChange}                                   className="accent-primary"                                 >                                 ...                               <label className="flex items...">                                 <input                                   type="radio" +                                 name="promoterType-item-1790839922738-0-88uj0btyf" -                                 name="promoterType-item-1790839921585-0-enn6hqu92"                                   checked={false}                                   onChange={function onChange}                                   className="accent-primary"                                 >                                 ...                             ...                           ...                     ...           ...         ... ` | 2026-10-01T07:32:02.828Z |





---
*Generated automatically by Antigravity Headless Audit Agent.*
