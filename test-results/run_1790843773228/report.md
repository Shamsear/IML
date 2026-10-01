# Headless Browser Automated Audit Report

**Run ID**: `run_1790843773228`  
**Timestamp**: 2026-10-01T08:36:13.229Z  
**Base URL**: `http://localhost:3000`  

---

## 📊 Summary

| Metric | Value |
| :--- | :--- |
| **Total Test Steps** | **19** |
| **Passed Steps** | ✅ **16** |
| **Failed Steps** | ❌ **3** |
| **Console Errors** | ⚠️ **2** |
| **Network Errors (4xx/5xx)** | 🌐 **1** |
| **Page JS Exceptions** | 💥 **0** |

---

## 📋 Detailed Test Steps

| Step | Action Name | Duration | Status | Screenshot |
| :---: | :--- | :---: | :---: | :--- |
| 1 | **01_Visit_Login_Page** | 2.59s | ✅ PASSED | [`00_01_Visit_Login_Page.png`](./screenshots/00_01_Visit_Login_Page.png) |
| 2 | **02_Admin_Authentication_And_Dashboard_Entry** | 54.91s | ❌ FAILED | [`01_02_Admin_Authentication_And_Dashboard_Entry.png`](./screenshots/01_02_Admin_Authentication_And_Dashboard_Entry.png) |
| 3 | **03_Dashboard_Overview_Cards** | 14.38s | ✅ PASSED | [`02_03_Dashboard_Overview_Cards.png`](./screenshots/02_03_Dashboard_Overview_Cards.png) |
| 4 | **04_Navigate_Brands_List** | 13.31s | ✅ PASSED | [`03_04_Navigate_Brands_List.png`](./screenshots/03_04_Navigate_Brands_List.png) |
| 5 | **05_Create_New_Brand** | 29.49s | ✅ PASSED | [`04_05_Create_New_Brand.png`](./screenshots/04_05_Create_New_Brand.png) |
| 6 | **06_Inspect_Brand_Detail_And_Portal** | 4.62s | ✅ PASSED | [`05_06_Inspect_Brand_Detail_And_Portal.png`](./screenshots/05_06_Inspect_Brand_Detail_And_Portal.png) |
| 7 | **07_Navigate_Stores_List** | 30.82s | ✅ PASSED | [`06_07_Navigate_Stores_List.png`](./screenshots/06_07_Navigate_Stores_List.png) |
| 8 | **08_Create_New_Store** | 71.62s | ❌ FAILED | [`07_08_Create_New_Store.png`](./screenshots/07_08_Create_New_Store.png) |
| 9 | **09_Create_New_Supervisor** | 64.78s | ❌ FAILED | [`08_09_Create_New_Supervisor.png`](./screenshots/08_09_Create_New_Supervisor.png) |
| 10 | **10_Create_New_Product** | 33.79s | ✅ PASSED | [`09_10_Create_New_Product.png`](./screenshots/09_10_Create_New_Product.png) |
| 11 | **11_Staff_Management_And_Assign** | 28.15s | ✅ PASSED | [`10_11_Staff_Management_And_Assign.png`](./screenshots/10_11_Staff_Management_And_Assign.png) |
| 12 | **12_Inbound_Deliveries_Ledger_And_New** | 23.27s | ✅ PASSED | [`11_12_Inbound_Deliveries_Ledger_And_New.png`](./screenshots/11_12_Inbound_Deliveries_Ledger_And_New.png) |
| 13 | **13_Outbound_Deliveries_Ledger_And_New** | 19.19s | ✅ PASSED | [`12_13_Outbound_Deliveries_Ledger_And_New.png`](./screenshots/12_13_Outbound_Deliveries_Ledger_And_New.png) |
| 14 | **14_Client_Returns_And_Balances** | 40.05s | ✅ PASSED | [`13_14_Client_Returns_And_Balances.png`](./screenshots/13_14_Client_Returns_And_Balances.png) |
| 15 | **15_Damage_And_Loss_Flow** | 37.92s | ✅ PASSED | [`14_15_Damage_And_Loss_Flow.png`](./screenshots/14_15_Damage_And_Loss_Flow.png) |
| 16 | **16_Rebrand_And_Repurpose_Flow** | 19.58s | ✅ PASSED | [`15_16_Rebrand_And_Repurpose_Flow.png`](./screenshots/15_16_Rebrand_And_Repurpose_Flow.png) |
| 17 | **17_Ledgers_Transactions_Expiry_Used_Reports_Settings** | 137.56s | ✅ PASSED | [`16_17_Ledgers_Transactions_Expiry_Used_Reports_Settings.png`](./screenshots/16_17_Ledgers_Transactions_Expiry_Used_Reports_Settings.png) |
| 18 | **18_Global_Search_Feature** | 30.68s | ✅ PASSED | [`17_18_Global_Search_Feature.png`](./screenshots/17_18_Global_Search_Feature.png) |
| 19 | **19_Security_Invalid_Credentials_Rejection** | 14.01s | ✅ PASSED | [`18_19_Security_Invalid_Credentials_Rejection.png`](./screenshots/18_19_Security_Invalid_Credentials_Rejection.png) |


---

## ❌ Step Failures & Errors

### Step 2: 02_Admin_Authentication_And_Dashboard_Entry
- **Error**: `page.waitForURL: Timeout 50000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/dashboard" until "load"
  navigated to "http://localhost:3000/login?callbackUrl=%2Fdashboard"
  navigated to "http://localhost:3000/login?callbackUrl=%2Fdashboard"
============================================================`
- **Duration**: 54909ms

### Step 8: 08_Create_New_Store
- **Error**: `locator.waitFor: Timeout 35000ms exceeded.
Call log:
[2m  - waiting for locator('button:has-text("OK")').first() to be visible[22m
`
- **Duration**: 71621ms

### Step 9: 09_Create_New_Supervisor
- **Error**: `locator.waitFor: Timeout 35000ms exceeded.
Call log:
[2m  - waiting for locator('button:has-text("OK")').first() to be visible[22m
`
- **Duration**: 64775ms




---

## ⚠️ Browser Console Errors Detected

| URL | Error Message | Time |
| :--- | :--- | :--- |
| `http://localhost:3000/dashboard/client-returns/new` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <ErrorBoundary errorComponent={undefined} errorStyles={undefined} errorScripts={undefined}>       <LoadingBoundary name="new/" loading={null}>         <HTTPAccessFallbackBoundary notFound={undefined} forbidden={undefined} unauthorized={undefined}>           <RedirectBoundary>             <RedirectErrorBoundary router={{...}}>               <InnerLayoutRouter url="/dashboard..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} ...>                 <SegmentViewNode type="page" pagePath="dashboard/...">                   <SegmentTrieNode>                   <NewClientReturnPage>                     <ClientReturnsClient brands={[...]} products={[...]}>                       <div className="max-w-4xl ...">                         <header>                         <ConfirmModal>                         <div className="bg-surface...">                           <h3>                           <div className="grid grid-...">                             <div>                             <div className="flex flex-...">                               <label>                               <input                                 type="text"                                 className="w-full bg-surface text-text-primary placeholder:text-text-muted border bord..."                                 value=""                                 onChange={function onChange}                                 placeholder="e.g. John representative"                                 required={true} -                               style={{caret-color:"transparent"}}                               >                           <div className="grid grid-...">                             <div className="flex flex-...">                               <label>                               <input                                 type="datetime-local"                                 className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 py..."                                 value="2026-10-01T12:43"                                 onChange={function onChange} -                               style={{caret-color:"transparent"}}                               >                             <div className="flex flex-...">                               <label>                               <input                                 type="text"                                 className="w-full bg-surface text-text-primary placeholder:text-text-muted border bord..."                                 placeholder="e.g., Campaign expired materials return"                                 value=""                                 onChange={function onChange} -                               style={{caret-color:"transparent"}}                               >                         <form onSubmit={function handleSubmit} className="flex flex-...">                           <div className="flex flex-...">                             <div className={"bg-surfa..."}>                               <div className="p-5 flex f...">                                 <div>                                 <div className="grid grid-...">                                   <div>                                   <div className="flex flex-...">                                     <label>                                     <input                                       type="number"                                       min={1}                                       className="w-full bg-surface text-text-primary border border-border rounded-lg p..."                                       value=""                                       onChange={function onChange}                                       disabled={undefined}                                       placeholder="" -                                     style={{caret-color:"transparent"}}                                     >                                 <div className="flex flex-...">                                   <label>                                   <input                                     type="text"                                     className="w-full bg-surface text-text-primary placeholder:text-text-muted border ..."                                     placeholder="e.g. return details for this specific product line"                                     value=""                                     onChange={function onChange} -                                   style={{caret-color:"transparent"}}                                   >                           ...                 ...               ...     ... ` | 2026-10-01T08:43:29.414Z |
| `http://localhost:3000/login` | `Failed to load resource: the server responded with a status of 401 (Unauthorized)` | 2026-10-01T08:47:29.688Z |




---

## 🌐 Network Failures (4xx / 5xx)

| Status | URL |
| :---: | :--- |
| **401** | `http://localhost:3000/api/auth/callback/credentials` |


---
*Generated automatically by Antigravity Headless Audit Agent.*
