# Headless Browser Automated Audit Report

**Run ID**: `run_1790837688979`  
**Timestamp**: 2026-10-01T06:54:48.980Z  
**Base URL**: `http://localhost:3000`  

---

## 📊 Summary

| Metric | Value |
| :--- | :--- |
| **Total Test Steps** | **19** |
| **Passed Steps** | ✅ **8** |
| **Failed Steps** | ❌ **11** |
| **Console Errors** | ⚠️ **4** |
| **Network Errors (4xx/5xx)** | 🌐 **0** |
| **Page JS Exceptions** | 💥 **0** |

---

## 📋 Detailed Test Steps

| Step | Action Name | Duration | Status | Screenshot |
| :---: | :--- | :---: | :---: | :--- |
| 1 | **01_Visit_Login_Page** | 2.46s | ✅ PASSED | [`00_01_Visit_Login_Page.png`](./screenshots/00_01_Visit_Login_Page.png) |
| 2 | **02_Invalid_Login_Validation** | 1.37s | ✅ PASSED | [`01_02_Invalid_Login_Validation.png`](./screenshots/01_02_Invalid_Login_Validation.png) |
| 3 | **03_Valid_Admin_Login** | 15.84s | ❌ FAILED | [`02_03_Valid_Admin_Login.png`](./screenshots/02_03_Valid_Admin_Login.png) |
| 4 | **04_Dashboard_Overview_Cards** | 3.53s | ✅ PASSED | [`03_04_Dashboard_Overview_Cards.png`](./screenshots/03_04_Dashboard_Overview_Cards.png) |
| 5 | **05_Navigate_Brands_List** | 2.08s | ❌ FAILED | [`04_05_Navigate_Brands_List.png`](./screenshots/04_05_Navigate_Brands_List.png) |
| 6 | **06_Create_New_Brand** | 38.08s | ❌ FAILED | [`05_06_Create_New_Brand.png`](./screenshots/05_06_Create_New_Brand.png) |
| 7 | **07_Inspect_Brand_Detail_And_Portal** | 0.68s | ✅ PASSED | [`06_07_Inspect_Brand_Detail_And_Portal.png`](./screenshots/06_07_Inspect_Brand_Detail_And_Portal.png) |
| 8 | **08_Navigate_Stores_List** | 1.80s | ❌ FAILED | [`07_08_Navigate_Stores_List.png`](./screenshots/07_08_Navigate_Stores_List.png) |
| 9 | **09_Create_New_Store** | 31.95s | ❌ FAILED | [`08_09_Create_New_Store.png`](./screenshots/08_09_Create_New_Store.png) |
| 10 | **10_Create_New_Supervisor** | 32.15s | ❌ FAILED | [`09_10_Create_New_Supervisor.png`](./screenshots/09_10_Create_New_Supervisor.png) |
| 11 | **11_Create_New_Product** | 37.70s | ❌ FAILED | [`10_11_Create_New_Product.png`](./screenshots/10_11_Create_New_Product.png) |
| 12 | **12_Staff_Management_And_Assign** | 2.48s | ✅ PASSED | [`11_12_Staff_Management_And_Assign.png`](./screenshots/11_12_Staff_Management_And_Assign.png) |
| 13 | **13_Inbound_Deliveries_Ledger_And_New** | 4.54s | ✅ PASSED | [`12_13_Inbound_Deliveries_Ledger_And_New.png`](./screenshots/12_13_Inbound_Deliveries_Ledger_And_New.png) |
| 14 | **14_Outbound_Deliveries_Ledger_And_New** | 3.33s | ✅ PASSED | [`13_14_Outbound_Deliveries_Ledger_And_New.png`](./screenshots/13_14_Outbound_Deliveries_Ledger_And_New.png) |
| 15 | **15_Client_Returns_And_Balances** | 7.78s | ❌ FAILED | [`14_15_Client_Returns_And_Balances.png`](./screenshots/14_15_Client_Returns_And_Balances.png) |
| 16 | **16_Damage_And_Loss_Flow** | 6.13s | ❌ FAILED | [`15_16_Damage_And_Loss_Flow.png`](./screenshots/15_16_Damage_And_Loss_Flow.png) |
| 17 | **17_Rebrand_And_Repurpose_Flow** | 5.98s | ❌ FAILED | [`16_17_Rebrand_And_Repurpose_Flow.png`](./screenshots/16_17_Rebrand_And_Repurpose_Flow.png) |
| 18 | **18_Ledgers_Transactions_Expiry_Used_Reports_Settings** | 49.54s | ❌ FAILED | [`17_18_Ledgers_Transactions_Expiry_Used_Reports_Settings.png`](./screenshots/17_18_Ledgers_Transactions_Expiry_Used_Reports_Settings.png) |
| 19 | **19_Global_Search_Feature** | 1.43s | ✅ PASSED | [`18_19_Global_Search_Feature.png`](./screenshots/18_19_Global_Search_Feature.png) |


---

## ❌ Step Failures & Errors

### Step 3: 03_Valid_Admin_Login
- **Error**: `Expected /dashboard, got http://localhost:3000/login?callbackUrl=%2Fdashboard`
- **Duration**: 15844ms

### Step 5: 05_Navigate_Brands_List
- **Error**: `Add Brand button/link not found on /dashboard/brands`
- **Duration**: 2080ms

### Step 6: 06_Create_New_Brand
- **Error**: `page.fill: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('input[placeholder="e.g. Virgin Mobile"]')[22m
`
- **Duration**: 38079ms

### Step 8: 08_Navigate_Stores_List
- **Error**: `Add Store button/link not found`
- **Duration**: 1801ms

### Step 9: 09_Create_New_Store
- **Error**: `page.fill: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('input[placeholder="e.g. Carrefour Mall of the Emirates"]')[22m
`
- **Duration**: 31950ms

### Step 10: 10_Create_New_Supervisor
- **Error**: `page.fill: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('input[placeholder="e.g. Ahmed Al Maktoum"]')[22m
`
- **Duration**: 32150ms

### Step 11: 11_Create_New_Product
- **Error**: `locator.waitFor: Timeout 15000ms exceeded.
Call log:
[2m  - waiting for locator('button:has-text("OK")').first() to be visible[22m
`
- **Duration**: 37701ms

### Step 15: 15_Client_Returns_And_Balances
- **Error**: `Failed to load client returns`
- **Duration**: 7783ms

### Step 16: 16_Damage_And_Loss_Flow
- **Error**: `Failed to load loss management`
- **Duration**: 6127ms

### Step 17: 17_Rebrand_And_Repurpose_Flow
- **Error**: `Failed to load rebrand module`
- **Duration**: 5979ms

### Step 18: 18_Ledgers_Transactions_Expiry_Used_Reports_Settings
- **Error**: `page.goto: Timeout 30000ms exceeded.
Call log:
[2m  - navigating to "http://localhost:3000/pdf-preview", waiting until "domcontentloaded"[22m
`
- **Duration**: 49539ms




---

## ⚠️ Browser Console Errors Detected

| URL | Error Message | Time |
| :--- | :--- | :--- |
| `http://localhost:3000/login?callbackUrl=%2Fdashboard` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <LoadingBoundary name="login/" loading={null}>       <HTTPAccessFallbackBoundary notFound={undefined} forbidden={undefined} unauthorized={undefined}>         <RedirectBoundary>           <RedirectErrorBoundary router={{...}}>             <InnerLayoutRouter url="/login?cal..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} ...>               <SegmentViewNode type="page" pagePath="login/page.js">                 <SegmentTrieNode>                 <LoginPage>                   <LoginForm>                     <div className="relative h...">                       <div>                       <div className="relative w...">                         <div className="relative z...">                           <div>                           <form onSubmit={function handleSubmit} className="flex flex-...">                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <User>                                 <input                                   type="text"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="Enter your username"                                   required={true}                                   disabled={false}                                   autoFocus={true}                                   autoComplete="username" -                                 style={{caret-color:"transparent"}}                                 >                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <Lock>                                 <input                                   type="password"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="••••••••"                                   required={true}                                   disabled={false}                                   autoComplete="current-password" -                                 style={{caret-color:"transparent"}}                                 >                                 ...                             ...                           ...                         ...               ...             ... ` | 2026-10-01T06:55:11.768Z |
| `http://localhost:3000/login?callbackUrl=%2Fdashboard` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <LoadingBoundary name="login/" loading={null}>       <HTTPAccessFallbackBoundary notFound={undefined} forbidden={undefined} unauthorized={undefined}>         <RedirectBoundary>           <RedirectErrorBoundary router={{...}}>             <InnerLayoutRouter url="/login?cal..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} ...>               <SegmentViewNode type="page" pagePath="login/page.js">                 <SegmentTrieNode>                 <LoginPage>                   <LoginForm>                     <div className="relative h...">                       <div>                       <div className="relative w...">                         <div className="relative z...">                           <div>                           <form onSubmit={function handleSubmit} className="flex flex-...">                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <User>                                 <input                                   type="text"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="Enter your username"                                   required={true}                                   disabled={false}                                   autoFocus={true}                                   autoComplete="username" -                                 style={{caret-color:"transparent"}}                                 >                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <Lock>                                 <input                                   type="password"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="••••••••"                                   required={true}                                   disabled={false}                                   autoComplete="current-password" -                                 style={{caret-color:"transparent"}}                                 >                                 ...                             ...                           ...                         ...               ...             ... ` | 2026-10-01T06:55:15.495Z |
| `http://localhost:3000/login?callbackUrl=%2Fdashboard%2Fstores` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <LoadingBoundary name="login/" loading={null}>       <HTTPAccessFallbackBoundary notFound={undefined} forbidden={undefined} unauthorized={undefined}>         <RedirectBoundary>           <RedirectErrorBoundary router={{...}}>             <InnerLayoutRouter url="/login?cal..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} ...>               <SegmentViewNode type="page" pagePath="login/page.js">                 <SegmentTrieNode>                 <LoginPage>                   <LoginForm>                     <div className="relative h...">                       <div>                       <div className="relative w...">                         <div className="relative z...">                           <div>                           <form onSubmit={function handleSubmit} className="flex flex-...">                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <User>                                 <input                                   type="text"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="Enter your username"                                   required={true}                                   disabled={false}                                   autoFocus={true}                                   autoComplete="username" -                                 style={{caret-color:"transparent"}}                                 >                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <Lock>                                 <input                                   type="password"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="••••••••"                                   required={true}                                   disabled={false}                                   autoComplete="current-password" -                                 style={{caret-color:"transparent"}}                                 >                                 ...                             ...                           ...                         ...               ...             ... ` | 2026-10-01T06:55:58.617Z |
| `http://localhost:3000/login?callbackUrl=%2Fdashboard%2Finbound%2Fnew` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <LoadingBoundary name="login/" loading={null}>       <HTTPAccessFallbackBoundary notFound={undefined} forbidden={undefined} unauthorized={undefined}>         <RedirectBoundary>           <RedirectErrorBoundary router={{...}}>             <InnerLayoutRouter url="/login?cal..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} ...>               <SegmentViewNode type="page" pagePath="login/page.js">                 <SegmentTrieNode>                 <LoginPage>                   <LoginForm>                     <div className="relative h...">                       <div>                       <div className="relative w...">                         <div className="relative z...">                           <div>                           <form onSubmit={function handleSubmit} className="flex flex-...">                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <User>                                 <input                                   type="text"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="Enter your username"                                   required={true}                                   disabled={false}                                   autoFocus={true}                                   autoComplete="username" -                                 style={{caret-color:"transparent"}}                                 >                             <div className="flex flex-...">                               <label>                               <div className="relative f...">                                 <Lock>                                 <input                                   type="password"                                   className="w-full bg-surface-elevated text-text-primary placeholder:text-text-muted ..."                                   value=""                                   onChange={function onChange}                                   placeholder="••••••••"                                   required={true}                                   disabled={false}                                   autoComplete="current-password" -                                 style={{caret-color:"transparent"}}                                 >                                 ...                             ...                           ...                         ...               ...             ... ` | 2026-10-01T06:57:48.578Z |





---
*Generated automatically by Antigravity Headless Audit Agent.*
