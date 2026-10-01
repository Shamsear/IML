# Headless Browser Automated Audit Report

**Run ID**: `run_1790838165015`  
**Timestamp**: 2026-10-01T07:02:45.017Z  
**Base URL**: `http://localhost:3000`  

---

## 📊 Summary

| Metric | Value |
| :--- | :--- |
| **Total Test Steps** | **19** |
| **Passed Steps** | ✅ **10** |
| **Failed Steps** | ❌ **9** |
| **Console Errors** | ⚠️ **4** |
| **Network Errors (4xx/5xx)** | 🌐 **0** |
| **Page JS Exceptions** | 💥 **0** |

---

## 📋 Detailed Test Steps

| Step | Action Name | Duration | Status | Screenshot |
| :---: | :--- | :---: | :---: | :--- |
| 1 | **01_Visit_Login_Page** | 2.46s | ✅ PASSED | [`00_01_Visit_Login_Page.png`](./screenshots/00_01_Visit_Login_Page.png) |
| 2 | **02_Invalid_Login_Validation** | 2.71s | ✅ PASSED | [`01_02_Invalid_Login_Validation.png`](./screenshots/01_02_Invalid_Login_Validation.png) |
| 3 | **03_Valid_Admin_Login** | 33.84s | ❌ FAILED | [`02_03_Valid_Admin_Login.png`](./screenshots/02_03_Valid_Admin_Login.png) |
| 4 | **04_Dashboard_Overview_Cards** | 1.87s | ✅ PASSED | [`03_04_Dashboard_Overview_Cards.png`](./screenshots/03_04_Dashboard_Overview_Cards.png) |
| 5 | **05_Navigate_Brands_List** | 1.58s | ❌ FAILED | [`04_05_Navigate_Brands_List.png`](./screenshots/04_05_Navigate_Brands_List.png) |
| 6 | **06_Create_New_Brand** | 31.71s | ❌ FAILED | [`05_06_Create_New_Brand.png`](./screenshots/05_06_Create_New_Brand.png) |
| 7 | **07_Inspect_Brand_Detail_And_Portal** | 1.54s | ✅ PASSED | [`06_07_Inspect_Brand_Detail_And_Portal.png`](./screenshots/06_07_Inspect_Brand_Detail_And_Portal.png) |
| 8 | **08_Navigate_Stores_List** | 5.48s | ❌ FAILED | [`07_08_Navigate_Stores_List.png`](./screenshots/07_08_Navigate_Stores_List.png) |
| 9 | **09_Create_New_Store** | 31.45s | ❌ FAILED | [`08_09_Create_New_Store.png`](./screenshots/08_09_Create_New_Store.png) |
| 10 | **10_Create_New_Supervisor** | 31.29s | ❌ FAILED | [`09_10_Create_New_Supervisor.png`](./screenshots/09_10_Create_New_Supervisor.png) |
| 11 | **11_Create_New_Product** | 5.16s | ✅ PASSED | [`10_11_Create_New_Product.png`](./screenshots/10_11_Create_New_Product.png) |
| 12 | **12_Staff_Management_And_Assign** | 2.66s | ✅ PASSED | [`11_12_Staff_Management_And_Assign.png`](./screenshots/11_12_Staff_Management_And_Assign.png) |
| 13 | **13_Inbound_Deliveries_Ledger_And_New** | 4.94s | ✅ PASSED | [`12_13_Inbound_Deliveries_Ledger_And_New.png`](./screenshots/12_13_Inbound_Deliveries_Ledger_And_New.png) |
| 14 | **14_Outbound_Deliveries_Ledger_And_New** | 3.00s | ✅ PASSED | [`13_14_Outbound_Deliveries_Ledger_And_New.png`](./screenshots/13_14_Outbound_Deliveries_Ledger_And_New.png) |
| 15 | **15_Client_Returns_And_Balances** | 3.96s | ❌ FAILED | [`14_15_Client_Returns_And_Balances.png`](./screenshots/14_15_Client_Returns_And_Balances.png) |
| 16 | **16_Damage_And_Loss_Flow** | 5.26s | ❌ FAILED | [`15_16_Damage_And_Loss_Flow.png`](./screenshots/15_16_Damage_And_Loss_Flow.png) |
| 17 | **17_Rebrand_And_Repurpose_Flow** | 2.76s | ❌ FAILED | [`16_17_Rebrand_And_Repurpose_Flow.png`](./screenshots/16_17_Rebrand_And_Repurpose_Flow.png) |
| 18 | **18_Ledgers_Transactions_Expiry_Used_Reports_Settings** | 8.02s | ✅ PASSED | [`17_18_Ledgers_Transactions_Expiry_Used_Reports_Settings.png`](./screenshots/17_18_Ledgers_Transactions_Expiry_Used_Reports_Settings.png) |
| 19 | **19_Global_Search_Feature** | 4.69s | ✅ PASSED | [`18_19_Global_Search_Feature.png`](./screenshots/18_19_Global_Search_Feature.png) |


---

## ❌ Step Failures & Errors

### Step 3: 03_Valid_Admin_Login
- **Error**: `Expected /dashboard, got http://localhost:3000/login?callbackUrl=%2Fdashboard`
- **Duration**: 33836ms

### Step 5: 05_Navigate_Brands_List
- **Error**: `Add Brand button/link not found on /dashboard/brands`
- **Duration**: 1577ms

### Step 6: 06_Create_New_Brand
- **Error**: `page.fill: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('input[placeholder="e.g. Virgin Mobile"]')[22m
`
- **Duration**: 31715ms

### Step 8: 08_Navigate_Stores_List
- **Error**: `Add Store button/link not found`
- **Duration**: 5484ms

### Step 9: 09_Create_New_Store
- **Error**: `page.fill: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('input[placeholder="e.g. Carrefour Mall of the Emirates"]')[22m
`
- **Duration**: 31455ms

### Step 10: 10_Create_New_Supervisor
- **Error**: `page.fill: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('input[placeholder="e.g. Ahmed Al Maktoum"]')[22m
`
- **Duration**: 31294ms

### Step 15: 15_Client_Returns_And_Balances
- **Error**: `Failed to load client returns`
- **Duration**: 3965ms

### Step 16: 16_Damage_And_Loss_Flow
- **Error**: `Failed to load loss management`
- **Duration**: 5264ms

### Step 17: 17_Rebrand_And_Repurpose_Flow
- **Error**: `Failed to load rebrand module`
- **Duration**: 2764ms




---

## ⚠️ Browser Console Errors Detected

| URL | Error Message | Time |
| :--- | :--- | :--- |
| `http://localhost:3000/login?callbackUrl=%2Fdashboard` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <LoadingBoundary name="login/" loading={null}>       <HTTPAccessFallbackBoundary notFound={undefined} forbidden={undefined} unauthorized={undefined}>         <RedirectBoundary>           <RedirectErrorBoundary router={{...}}>             <InnerLayoutRouter url="/login?cal..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} ...>               <SegmentViewNode type="page" pagePath="login/page.js">                 <SegmentTrieNode>                 <LoginPage>                   <LoginForm>                     <div className="relative h...">                       <div>                       <div className="relative w...">                         <div className="relative z...">                           <div>                           <form onSubmit={function handleSubmit} className="flex flex-...">                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <User>                                 <input                                   type="text"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="Enter your username"                                   required={true}                                   disabled={false}                                   autoComplete="username" -                                 style={{caret-color:"transparent"}}                                 >                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <Lock>                                 <input                                   type="password"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="••••••••"                                   required={true}                                   disabled={false}                                   autoComplete="current-password" -                                 style={{caret-color:"transparent"}}                                 >                                 ...                             ...                           ...                         ...               ...             ... ` | 2026-10-01T07:03:27.538Z |
| `http://localhost:3000/login?callbackUrl=%2Fdashboard%2Fbrands` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <LoadingBoundary name="login/" loading={null}>       <HTTPAccessFallbackBoundary notFound={undefined} forbidden={undefined} unauthorized={undefined}>         <RedirectBoundary>           <RedirectErrorBoundary router={{...}}>             <InnerLayoutRouter url="/login?cal..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} ...>               <SegmentViewNode type="page" pagePath="login/page.js">                 <SegmentTrieNode>                 <LoginPage>                   <LoginForm>                     <div className="relative h...">                       <div>                       <div className="relative w...">                         <div className="relative z...">                           <div>                           <form onSubmit={function handleSubmit} className="flex flex-...">                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <User>                                 <input                                   type="text"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="Enter your username"                                   required={true}                                   disabled={false}                                   autoComplete="username" -                                 style={{caret-color:"transparent"}}                                 >                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <Lock>                                 <input                                   type="password"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="••••••••"                                   required={true}                                   disabled={false}                                   autoComplete="current-password" -                                 style={{caret-color:"transparent"}}                                 >                                 ...                             ...                           ...                         ...               ...             ... ` | 2026-10-01T07:04:03.280Z |
| `http://localhost:3000/login?callbackUrl=%2Fdashboard%2Fproducts` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <LoadingBoundary name="login/" loading={null}>       <HTTPAccessFallbackBoundary notFound={undefined} forbidden={undefined} unauthorized={undefined}>         <RedirectBoundary>           <RedirectErrorBoundary router={{...}}>             <InnerLayoutRouter url="/login?cal..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} ...>               <SegmentViewNode type="page" pagePath="login/page.js">                 <SegmentTrieNode>                 <LoginPage>                   <LoginForm>                     <div className="relative h...">                       <div>                       <div className="relative w...">                         <div className="relative z...">                           <div>                           <form onSubmit={function handleSubmit} className="flex flex-...">                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <User>                                 <input                                   type="text"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="Enter your username"                                   required={true}                                   disabled={false}                                   autoComplete="username" -                                 style={{caret-color:"transparent"}}                                 >                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <Lock>                                 <input                                   type="password"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="••••••••"                                   required={true}                                   disabled={false}                                   autoComplete="current-password" -                                 style={{caret-color:"transparent"}}                                 >                                 ...                             ...                           ...                         ...               ...             ... ` | 2026-10-01T07:05:17.118Z |
| `http://localhost:3000/login?callbackUrl=%2Fdashboard%2Foutbound%2Fnew` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <LoadingBoundary name="login/" loading={null}>       <HTTPAccessFallbackBoundary notFound={undefined} forbidden={undefined} unauthorized={undefined}>         <RedirectBoundary>           <RedirectErrorBoundary router={{...}}>             <InnerLayoutRouter url="/login?cal..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} ...>               <SegmentViewNode type="page" pagePath="login/page.js">                 <SegmentTrieNode>                 <LoginPage>                   <LoginForm>                     <div className="relative h...">                       <div>                       <div className="relative w...">                         <div className="relative z...">                           <div>                           <form onSubmit={function handleSubmit} className="flex flex-...">                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <User>                                 <input                                   type="text"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="Enter your username"                                   required={true}                                   disabled={false}                                   autoComplete="username" -                                 style={{caret-color:"transparent"}}                                 >                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <Lock>                                 <input                                   type="password"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="••••••••"                                   required={true}                                   disabled={false}                                   autoComplete="current-password" -                                 style={{caret-color:"transparent"}}                                 >                                 ...                             ...                           ...                         ...               ...             ... ` | 2026-10-01T07:05:28.455Z |





---
*Generated automatically by Antigravity Headless Audit Agent.*
