# Headless Browser Automated Audit Report

**Run ID**: `run_1790838628764`  
**Timestamp**: 2026-10-01T07:10:28.766Z  
**Base URL**: `http://localhost:3000`  

---

## 📊 Summary

| Metric | Value |
| :--- | :--- |
| **Total Test Steps** | **19** |
| **Passed Steps** | ✅ **14** |
| **Failed Steps** | ❌ **5** |
| **Console Errors** | ⚠️ **2** |
| **Network Errors (4xx/5xx)** | 🌐 **0** |
| **Page JS Exceptions** | 💥 **1** |

---

## 📋 Detailed Test Steps

| Step | Action Name | Duration | Status | Screenshot |
| :---: | :--- | :---: | :---: | :--- |
| 1 | **01_Visit_Login_Page** | 1.34s | ✅ PASSED | [`00_01_Visit_Login_Page.png`](./screenshots/00_01_Visit_Login_Page.png) |
| 2 | **02_Invalid_Login_Validation** | 1.81s | ✅ PASSED | [`01_02_Invalid_Login_Validation.png`](./screenshots/01_02_Invalid_Login_Validation.png) |
| 3 | **03_Valid_Admin_Login** | 10.91s | ✅ PASSED | [`02_03_Valid_Admin_Login.png`](./screenshots/02_03_Valid_Admin_Login.png) |
| 4 | **04_Dashboard_Overview_Cards** | 2.32s | ✅ PASSED | [`03_04_Dashboard_Overview_Cards.png`](./screenshots/03_04_Dashboard_Overview_Cards.png) |
| 5 | **05_Navigate_Brands_List** | 30.04s | ❌ FAILED | [`04_05_Navigate_Brands_List.png`](./screenshots/04_05_Navigate_Brands_List.png) |
| 6 | **06_Create_New_Brand** | 30.97s | ✅ PASSED | [`05_06_Create_New_Brand.png`](./screenshots/05_06_Create_New_Brand.png) |
| 7 | **07_Inspect_Brand_Detail_And_Portal** | 2.90s | ✅ PASSED | [`06_07_Inspect_Brand_Detail_And_Portal.png`](./screenshots/06_07_Inspect_Brand_Detail_And_Portal.png) |
| 8 | **08_Navigate_Stores_List** | 13.91s | ✅ PASSED | [`07_08_Navigate_Stores_List.png`](./screenshots/07_08_Navigate_Stores_List.png) |
| 9 | **09_Create_New_Store** | 25.12s | ✅ PASSED | [`08_09_Create_New_Store.png`](./screenshots/08_09_Create_New_Store.png) |
| 10 | **10_Create_New_Supervisor** | 21.89s | ✅ PASSED | [`09_10_Create_New_Supervisor.png`](./screenshots/09_10_Create_New_Supervisor.png) |
| 11 | **11_Create_New_Product** | 41.80s | ❌ FAILED | [`10_11_Create_New_Product.png`](./screenshots/10_11_Create_New_Product.png) |
| 12 | **12_Staff_Management_And_Assign** | 27.37s | ✅ PASSED | [`11_12_Staff_Management_And_Assign.png`](./screenshots/11_12_Staff_Management_And_Assign.png) |
| 13 | **13_Inbound_Deliveries_Ledger_And_New** | 41.84s | ✅ PASSED | [`12_13_Inbound_Deliveries_Ledger_And_New.png`](./screenshots/12_13_Inbound_Deliveries_Ledger_And_New.png) |
| 14 | **14_Outbound_Deliveries_Ledger_And_New** | 22.27s | ❌ FAILED | [`13_14_Outbound_Deliveries_Ledger_And_New.png`](./screenshots/13_14_Outbound_Deliveries_Ledger_And_New.png) |
| 15 | **15_Client_Returns_And_Balances** | 47.82s | ✅ PASSED | [`14_15_Client_Returns_And_Balances.png`](./screenshots/14_15_Client_Returns_And_Balances.png) |
| 16 | **16_Damage_And_Loss_Flow** | 71.43s | ❌ FAILED | [`15_16_Damage_And_Loss_Flow.png`](./screenshots/15_16_Damage_And_Loss_Flow.png) |
| 17 | **17_Rebrand_And_Repurpose_Flow** | 40.56s | ✅ PASSED | [`16_17_Rebrand_And_Repurpose_Flow.png`](./screenshots/16_17_Rebrand_And_Repurpose_Flow.png) |
| 18 | **18_Ledgers_Transactions_Expiry_Used_Reports_Settings** | 30.09s | ❌ FAILED | [`17_18_Ledgers_Transactions_Expiry_Used_Reports_Settings.png`](./screenshots/17_18_Ledgers_Transactions_Expiry_Used_Reports_Settings.png) |
| 19 | **19_Global_Search_Feature** | 34.17s | ✅ PASSED | [`18_19_Global_Search_Feature.png`](./screenshots/18_19_Global_Search_Feature.png) |


---

## ❌ Step Failures & Errors

### Step 5: 05_Navigate_Brands_List
- **Error**: `page.goto: Timeout 30000ms exceeded.
Call log:
[2m  - navigating to "http://localhost:3000/dashboard/brands", waiting until "domcontentloaded"[22m
`
- **Duration**: 30042ms

### Step 11: 11_Create_New_Product
- **Error**: `locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('[role="option"], li, div:has-text("Brand_629979")').first()[22m
[2m    - locator resolved to <div class="h-[100dvh] overflow-hidden flex bg-background text-text-primary relative">…</div>[22m
[2m  - attempting click action[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is visible, enabled and stable[22m
[2m      - scrolling into view if needed[22m
[2m      - done scrolling[22m
[2m      - <div class="p-2 border-b border-border bg-surface-elevated/20 flex items-center gap-1.5 flex-shrink-0">…</div> from <div role="listbox" class="bg-surface border border-border rounded-xl shadow-xl flex flex-col overflow-hidden animate-slide-down max-h-[240px]">…</div> subtree intercepts pointer events[22m
[2m    - retrying click action[22m
[2m    - waiting 20ms[22m
[2m    2 × waiting for element to be visible, enabled and stable[22m
[2m      - element is visible, enabled and stable[22m
[2m      - scrolling into view if needed[22m
[2m      - done scrolling[22m
[2m      - <div class="p-2 border-b border-border bg-surface-elevated/20 flex items-center gap-1.5 flex-shrink-0">…</div> from <div role="listbox" class="bg-surface border border-border rounded-xl shadow-xl flex flex-col overflow-hidden animate-slide-down max-h-[240px]">…</div> subtree intercepts pointer events[22m
[2m    - retrying click action[22m
[2m      - waiting 100ms[22m
[2m    57 × waiting for element to be visible, enabled and stable[22m
[2m       - element is visible, enabled and stable[22m
[2m       - scrolling into view if needed[22m
[2m       - done scrolling[22m
[2m       - <div class="p-2 border-b border-border bg-surface-elevated/20 flex items-center gap-1.5 flex-shrink-0">…</div> from <div role="listbox" class="bg-surface border border-border rounded-xl shadow-xl flex flex-col overflow-hidden animate-slide-down max-h-[240px]">…</div> subtree intercepts pointer events[22m
[2m     - retrying click action[22m
[2m       - waiting 500ms[22m
`
- **Duration**: 41799ms

### Step 14: 14_Outbound_Deliveries_Ledger_And_New
- **Error**: `Outbound form not loaded`
- **Duration**: 22271ms

### Step 16: 16_Damage_And_Loss_Flow
- **Error**: `page.goto: Timeout 30000ms exceeded.
Call log:
[2m  - navigating to "http://localhost:3000/dashboard/loss", waiting until "domcontentloaded"[22m
`
- **Duration**: 71431ms

### Step 18: 18_Ledgers_Transactions_Expiry_Used_Reports_Settings
- **Error**: `page.goto: Timeout 30000ms exceeded.
Call log:
[2m  - navigating to "http://localhost:3000/dashboard/transactions", waiting until "domcontentloaded"[22m
`
- **Duration**: 30091ms




---

## ⚠️ Browser Console Errors Detected

| URL | Error Message | Time |
| :--- | :--- | :--- |
| `http://localhost:3000/dashboard/supervisors` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <LoadingBoundary name="supervisors/" loading={null}>       <HTTPAccessFallbackBoundary notFound={undefined} forbidden={undefined} unauthorized={undefined}>         <RedirectBoundary>           <RedirectErrorBoundary router={{...}}>             <InnerLayoutRouter url="/dashboard..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} ...>               <SegmentViewNode type="page" pagePath="dashboard/...">                 <SegmentTrieNode>                 <SupervisorsPage>                   <Suspense fallback={<div>}>                     <SupervisorsClient initialSupervisors={[...]}>                       <div className="flex flex-...">                         <header>                         <div className="flex flex-...">                           <div className="w-full fle...">                             <div className="relative">                               <Search>                               <input                                 type="text"                                 placeholder="Search supervisors by name, email or phone..."                                 value=""                                 onChange={function onChange}                                 className="w-full bg-surface text-text-primary border border-border rounded-lg pl-9 pr..." -                               style={{caret-color:"transparent"}}                               >                             ...                         ...               ...             ... ` | 2026-10-01T07:12:56.410Z |
| `http://localhost:3000/dashboard/staff/assign` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <RedirectBoundary>       <RedirectErrorBoundary router={{...}}>         <InnerLayoutRouter url="/dashboard..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} segmentPath={[...]} ...>           <SegmentViewNode type="page" pagePath="dashboard/...">             <SegmentTrieNode>             <AssignPage>               <AssignClient staffList={[...]} stores={[...]} initialAllocation={null} editStaffObj={null}>                 <div className="flex flex-...">                   <header>                   <form onSubmit={function handleBulkSubmit} className="flex flex-...">                     <div className="flex flex-...">                       <div className={"bg-surfa..."}>                         <div className="p-6 sm:p-8...">                           <div>                           <div className="flex flex-...">                             <div className="flex items...">                               <label className="flex items...">                                 <input                                   type="radio" +                                 name="promoterType-item-1790838845290-0-xd0qz2qff" -                                 name="promoterType-item-1790838844685-0-uft6ft0b0"                                   checked={true}                                   onChange={function onChange}                                   className="accent-primary"                                 >                                 ...                               <label className="flex items...">                                 <input                                   type="radio" +                                 name="promoterType-item-1790838845290-0-xd0qz2qff" -                                 name="promoterType-item-1790838844685-0-uft6ft0b0"                                   checked={false}                                   onChange={function onChange}                                   className="accent-primary"                                 >                                 ...                             ...                           ...                     ...           ...         ... ` | 2026-10-01T07:14:05.341Z |





---
*Generated automatically by Antigravity Headless Audit Agent.*
