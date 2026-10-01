# Headless Browser Automated Audit Report

**Run ID**: `run_1790842089843`  
**Timestamp**: 2026-10-01T08:08:09.844Z  
**Base URL**: `http://localhost:3000`  

---

## 📊 Summary

| Metric | Value |
| :--- | :--- |
| **Total Test Steps** | **19** |
| **Passed Steps** | ✅ **9** |
| **Failed Steps** | ❌ **10** |
| **Console Errors** | ⚠️ **4** |
| **Network Errors (4xx/5xx)** | 🌐 **1** |
| **Page JS Exceptions** | 💥 **0** |

---

## 📋 Detailed Test Steps

| Step | Action Name | Duration | Status | Screenshot |
| :---: | :--- | :---: | :---: | :--- |
| 1 | **01_Visit_Login_Page** | 0.81s | ✅ PASSED | [`00_01_Visit_Login_Page.png`](./screenshots/00_01_Visit_Login_Page.png) |
| 2 | **02_Admin_Authentication_And_Dashboard_Entry** | 36.17s | ❌ FAILED | [`01_02_Admin_Authentication_And_Dashboard_Entry.png`](./screenshots/01_02_Admin_Authentication_And_Dashboard_Entry.png) |
| 3 | **03_Dashboard_Overview_Cards** | 1.72s | ✅ PASSED | [`02_03_Dashboard_Overview_Cards.png`](./screenshots/02_03_Dashboard_Overview_Cards.png) |
| 4 | **04_Navigate_Brands_List** | 30.77s | ❌ FAILED | [`03_04_Navigate_Brands_List.png`](./screenshots/03_04_Navigate_Brands_List.png) |
| 5 | **05_Create_New_Brand** | 30.27s | ❌ FAILED | [`04_05_Create_New_Brand.png`](./screenshots/04_05_Create_New_Brand.png) |
| 6 | **06_Inspect_Brand_Detail_And_Portal** | 1.64s | ✅ PASSED | [`05_06_Inspect_Brand_Detail_And_Portal.png`](./screenshots/05_06_Inspect_Brand_Detail_And_Portal.png) |
| 7 | **07_Navigate_Stores_List** | 30.54s | ❌ FAILED | [`06_07_Navigate_Stores_List.png`](./screenshots/06_07_Navigate_Stores_List.png) |
| 8 | **08_Create_New_Store** | 30.25s | ❌ FAILED | [`07_08_Create_New_Store.png`](./screenshots/07_08_Create_New_Store.png) |
| 9 | **09_Create_New_Supervisor** | 30.28s | ❌ FAILED | [`08_09_Create_New_Supervisor.png`](./screenshots/08_09_Create_New_Supervisor.png) |
| 10 | **10_Create_New_Product** | 30.70s | ❌ FAILED | [`09_10_Create_New_Product.png`](./screenshots/09_10_Create_New_Product.png) |
| 11 | **11_Staff_Management_And_Assign** | 2.29s | ✅ PASSED | [`10_11_Staff_Management_And_Assign.png`](./screenshots/10_11_Staff_Management_And_Assign.png) |
| 12 | **12_Inbound_Deliveries_Ledger_And_New** | 3.36s | ✅ PASSED | [`11_12_Inbound_Deliveries_Ledger_And_New.png`](./screenshots/11_12_Inbound_Deliveries_Ledger_And_New.png) |
| 13 | **13_Outbound_Deliveries_Ledger_And_New** | 1.80s | ✅ PASSED | [`12_13_Outbound_Deliveries_Ledger_And_New.png`](./screenshots/12_13_Outbound_Deliveries_Ledger_And_New.png) |
| 14 | **14_Client_Returns_And_Balances** | 3.57s | ❌ FAILED | [`13_14_Client_Returns_And_Balances.png`](./screenshots/13_14_Client_Returns_And_Balances.png) |
| 15 | **15_Damage_And_Loss_Flow** | 5.09s | ❌ FAILED | [`14_15_Damage_And_Loss_Flow.png`](./screenshots/14_15_Damage_And_Loss_Flow.png) |
| 16 | **16_Rebrand_And_Repurpose_Flow** | 2.72s | ❌ FAILED | [`15_16_Rebrand_And_Repurpose_Flow.png`](./screenshots/15_16_Rebrand_And_Repurpose_Flow.png) |
| 17 | **17_Ledgers_Transactions_Expiry_Used_Reports_Settings** | 13.19s | ✅ PASSED | [`16_17_Ledgers_Transactions_Expiry_Used_Reports_Settings.png`](./screenshots/16_17_Ledgers_Transactions_Expiry_Used_Reports_Settings.png) |
| 18 | **18_Global_Search_Feature** | 3.73s | ✅ PASSED | [`17_18_Global_Search_Feature.png`](./screenshots/17_18_Global_Search_Feature.png) |
| 19 | **19_Security_Invalid_Credentials_Rejection** | 6.00s | ✅ PASSED | [`18_19_Security_Invalid_Credentials_Rejection.png`](./screenshots/18_19_Security_Invalid_Credentials_Rejection.png) |


---

## ❌ Step Failures & Errors

### Step 2: 02_Admin_Authentication_And_Dashboard_Entry
- **Error**: `page.waitForURL: Timeout 35000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/dashboard" until "load"
  navigated to "http://localhost:3000/login"
============================================================`
- **Duration**: 36173ms

### Step 4: 04_Navigate_Brands_List
- **Error**: `page.waitForSelector: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('a[href*="/dashboard/brands/new"], a:has-text("Add Brand")') to be visible[22m
`
- **Duration**: 30775ms

### Step 5: 05_Create_New_Brand
- **Error**: `page.waitForSelector: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('input[placeholder="e.g. Virgin Mobile"]') to be visible[22m
`
- **Duration**: 30268ms

### Step 7: 07_Navigate_Stores_List
- **Error**: `page.waitForSelector: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('a[href*="/dashboard/stores/new"], a:has-text("Add Store")') to be visible[22m
`
- **Duration**: 30544ms

### Step 8: 08_Create_New_Store
- **Error**: `page.waitForSelector: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('input[placeholder="e.g. Carrefour Mall of the Emirates"]') to be visible[22m
`
- **Duration**: 30251ms

### Step 9: 09_Create_New_Supervisor
- **Error**: `page.waitForSelector: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('input[placeholder="e.g. Ahmed Al Maktoum"]') to be visible[22m
`
- **Duration**: 30278ms

### Step 10: 10_Create_New_Product
- **Error**: `page.waitForSelector: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('button[aria-haspopup="listbox"]') to be visible[22m
`
- **Duration**: 30700ms

### Step 14: 14_Client_Returns_And_Balances
- **Error**: `Failed to load client returns`
- **Duration**: 3567ms

### Step 15: 15_Damage_And_Loss_Flow
- **Error**: `Failed to load loss management`
- **Duration**: 5094ms

### Step 16: 16_Rebrand_And_Repurpose_Flow
- **Error**: `Failed to load rebrand module`
- **Duration**: 2717ms




---

## ⚠️ Browser Console Errors Detected

| URL | Error Message | Time |
| :--- | :--- | :--- |
| `http://localhost:3000/login?callbackUrl=%2Fdashboard` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <LoadingBoundary name="login/" loading={null}>       <HTTPAccessFallbackBoundary notFound={undefined} forbidden={undefined} unauthorized={undefined}>         <RedirectBoundary>           <RedirectErrorBoundary router={{...}}>             <InnerLayoutRouter url="/login?cal..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} ...>               <SegmentViewNode type="page" pagePath="login/page.js">                 <SegmentTrieNode>                 <LoginPage>                   <LoginForm>                     <div className="relative h...">                       <div>                       <div className="relative w...">                         <div className="relative z...">                           <div>                           <form onSubmit={function handleSubmit} className="flex flex-...">                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <User>                                 <input                                   type="text"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="Enter your username"                                   required={true}                                   disabled={false}                                   autoComplete="username" -                                 style={{caret-color:"transparent"}}                                 >                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <Lock>                                 <input                                   type="password"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="••••••••"                                   required={true}                                   disabled={false}                                   autoComplete="current-password" -                                 style={{caret-color:"transparent"}}                                 >                                 ...                             ...                           ...                         ...               ...             ... ` | 2026-10-01T08:08:49.548Z |
| `http://localhost:3000/login?callbackUrl=%2Fdashboard%2Fbrands` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <LoadingBoundary name="login/" loading={null}>       <HTTPAccessFallbackBoundary notFound={undefined} forbidden={undefined} unauthorized={undefined}>         <RedirectBoundary>           <RedirectErrorBoundary router={{...}}>             <InnerLayoutRouter url="/login?cal..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} ...>               <SegmentViewNode type="page" pagePath="login/page.js">                 <SegmentTrieNode>                 <LoginPage>                   <LoginForm>                     <div className="relative h...">                       <div>                       <div className="relative w...">                         <div className="relative z...">                           <div>                           <form onSubmit={function handleSubmit} className="flex flex-...">                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <User>                                 <input                                   type="text"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="Enter your username"                                   required={true}                                   disabled={false}                                   autoComplete="username" -                                 style={{caret-color:"transparent"}}                                 >                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <Lock>                                 <input                                   type="password"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="••••••••"                                   required={true}                                   disabled={false}                                   autoComplete="current-password" -                                 style={{caret-color:"transparent"}}                                 >                                 ...                             ...                           ...                         ...               ...             ... ` | 2026-10-01T08:09:52.556Z |
| `http://localhost:3000/login?callbackUrl=%2Fdashboard%2Fstaff%2Fassign` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <LoadingBoundary name="login/" loading={null}>       <HTTPAccessFallbackBoundary notFound={undefined} forbidden={undefined} unauthorized={undefined}>         <RedirectBoundary>           <RedirectErrorBoundary router={{...}}>             <InnerLayoutRouter url="/login?cal..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} ...>               <SegmentViewNode type="page" pagePath="login/page.js">                 <SegmentTrieNode>                 <LoginPage>                   <LoginForm>                     <div className="relative h...">                       <div>                       <div className="relative w...">                         <div className="relative z...">                           <div>                           <form onSubmit={function handleSubmit} className="flex flex-...">                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <User>                                 <input                                   type="text"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="Enter your username"                                   required={true}                                   disabled={false}                                   autoComplete="username" -                                 style={{caret-color:"transparent"}}                                 >                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <Lock>                                 <input                                   type="password"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="••••••••"                                   required={true}                                   disabled={false}                                   autoComplete="current-password" -                                 style={{caret-color:"transparent"}}                                 >                                 ...                             ...                           ...                         ...               ...             ... ` | 2026-10-01T08:11:57.252Z |
| `http://localhost:3000/login` | `Failed to load resource: the server responded with a status of 401 (Unauthorized)` | 2026-10-01T08:12:36.890Z |




---

## 🌐 Network Failures (4xx / 5xx)

| Status | URL |
| :---: | :--- |
| **401** | `http://localhost:3000/api/auth/callback/credentials` |


---
*Generated automatically by Antigravity Headless Audit Agent.*
