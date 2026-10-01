# Headless Browser Automated Audit Report

**Run ID**: `run_1790840305567`  
**Timestamp**: 2026-10-01T07:38:25.569Z  
**Base URL**: `http://localhost:3000`  

---

## 📊 Summary

| Metric | Value |
| :--- | :--- |
| **Total Test Steps** | **19** |
| **Passed Steps** | ✅ **15** |
| **Failed Steps** | ❌ **4** |
| **Console Errors** | ⚠️ **4** |
| **Network Errors (4xx/5xx)** | 🌐 **0** |
| **Page JS Exceptions** | 💥 **0** |

---

## 📋 Detailed Test Steps

| Step | Action Name | Duration | Status | Screenshot |
| :---: | :--- | :---: | :---: | :--- |
| 1 | **01_Visit_Login_Page** | 1.84s | ✅ PASSED | [`00_01_Visit_Login_Page.png`](./screenshots/00_01_Visit_Login_Page.png) |
| 2 | **02_Invalid_Login_Validation** | 3.06s | ✅ PASSED | [`01_02_Invalid_Login_Validation.png`](./screenshots/01_02_Invalid_Login_Validation.png) |
| 3 | **03_Valid_Admin_Login** | 33.50s | ❌ FAILED | [`02_03_Valid_Admin_Login.png`](./screenshots/02_03_Valid_Admin_Login.png) |
| 4 | **04_Dashboard_Overview_Cards** | 8.82s | ✅ PASSED | [`03_04_Dashboard_Overview_Cards.png`](./screenshots/03_04_Dashboard_Overview_Cards.png) |
| 5 | **05_Navigate_Brands_List** | 8.33s | ✅ PASSED | [`04_05_Navigate_Brands_List.png`](./screenshots/04_05_Navigate_Brands_List.png) |
| 6 | **06_Create_New_Brand** | 42.96s | ❌ FAILED | [`05_06_Create_New_Brand.png`](./screenshots/05_06_Create_New_Brand.png) |
| 7 | **07_Inspect_Brand_Detail_And_Portal** | 3.77s | ✅ PASSED | [`06_07_Inspect_Brand_Detail_And_Portal.png`](./screenshots/06_07_Inspect_Brand_Detail_And_Portal.png) |
| 8 | **08_Navigate_Stores_List** | 11.92s | ✅ PASSED | [`07_08_Navigate_Stores_List.png`](./screenshots/07_08_Navigate_Stores_List.png) |
| 9 | **09_Create_New_Store** | 36.16s | ❌ FAILED | [`08_09_Create_New_Store.png`](./screenshots/08_09_Create_New_Store.png) |
| 10 | **10_Create_New_Supervisor** | 61.19s | ❌ FAILED | [`09_10_Create_New_Supervisor.png`](./screenshots/09_10_Create_New_Supervisor.png) |
| 11 | **11_Create_New_Product** | 21.99s | ✅ PASSED | [`10_11_Create_New_Product.png`](./screenshots/10_11_Create_New_Product.png) |
| 12 | **12_Staff_Management_And_Assign** | 24.81s | ✅ PASSED | [`11_12_Staff_Management_And_Assign.png`](./screenshots/11_12_Staff_Management_And_Assign.png) |
| 13 | **13_Inbound_Deliveries_Ledger_And_New** | 21.77s | ✅ PASSED | [`12_13_Inbound_Deliveries_Ledger_And_New.png`](./screenshots/12_13_Inbound_Deliveries_Ledger_And_New.png) |
| 14 | **14_Outbound_Deliveries_Ledger_And_New** | 28.12s | ✅ PASSED | [`13_14_Outbound_Deliveries_Ledger_And_New.png`](./screenshots/13_14_Outbound_Deliveries_Ledger_And_New.png) |
| 15 | **15_Client_Returns_And_Balances** | 49.81s | ✅ PASSED | [`14_15_Client_Returns_And_Balances.png`](./screenshots/14_15_Client_Returns_And_Balances.png) |
| 16 | **16_Damage_And_Loss_Flow** | 64.73s | ✅ PASSED | [`15_16_Damage_And_Loss_Flow.png`](./screenshots/15_16_Damage_And_Loss_Flow.png) |
| 17 | **17_Rebrand_And_Repurpose_Flow** | 31.32s | ✅ PASSED | [`16_17_Rebrand_And_Repurpose_Flow.png`](./screenshots/16_17_Rebrand_And_Repurpose_Flow.png) |
| 18 | **18_Ledgers_Transactions_Expiry_Used_Reports_Settings** | 108.23s | ✅ PASSED | [`17_18_Ledgers_Transactions_Expiry_Used_Reports_Settings.png`](./screenshots/17_18_Ledgers_Transactions_Expiry_Used_Reports_Settings.png) |
| 19 | **19_Global_Search_Feature** | 58.97s | ✅ PASSED | [`18_19_Global_Search_Feature.png`](./screenshots/18_19_Global_Search_Feature.png) |


---

## ❌ Step Failures & Errors

### Step 3: 03_Valid_Admin_Login
- **Error**: `page.waitForURL: Timeout 30000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/dashboard**" until "load"
  navigated to "http://localhost:3000/login"
============================================================`
- **Duration**: 33497ms

### Step 6: 06_Create_New_Brand
- **Error**: `locator.waitFor: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('button:has-text("OK")').first() to be visible[22m
`
- **Duration**: 42961ms

### Step 9: 09_Create_New_Store
- **Error**: `locator.waitFor: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('button:has-text("OK")').first() to be visible[22m
`
- **Duration**: 36158ms

### Step 10: 10_Create_New_Supervisor
- **Error**: `locator.waitFor: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('button:has-text("OK")').first() to be visible[22m
`
- **Duration**: 61192ms




---

## ⚠️ Browser Console Errors Detected

| URL | Error Message | Time |
| :--- | :--- | :--- |
| `http://localhost:3000/dashboard/stores` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <LoadingBoundary name="stores/" loading={null}>       <HTTPAccessFallbackBoundary notFound={undefined} forbidden={undefined} unauthorized={undefined}>         <RedirectBoundary>           <RedirectErrorBoundary router={{...}}>             <InnerLayoutRouter url="/dashboard..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} ...>               <SegmentViewNode type="page" pagePath="dashboard/...">                 <SegmentTrieNode>                 <StoresPage>                   <Suspense fallback={<div>}>                     <StoresClient initialStores={[...]}>                       <div className="flex flex-...">                         <header>                         <div className="flex flex-...">                           <div className="bg-surface...">                             <div className="relative f...">                               <Search>                               <input                                 type="text"                                 className="w-full bg-surface text-text-primary placeholder:text-text-muted border bord..."                                 placeholder="Search stores by name or address..."                                 value=""                                 onChange={function onChange} -                               style={{caret-color:"transparent"}}                               >                             ...                           ...                         ...               ...             ... ` | 2026-10-01T07:40:21.906Z |
| `http://localhost:3000/dashboard/products/new` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <RedirectBoundary>       <RedirectErrorBoundary router={{...}}>         <InnerLayoutRouter url="/dashboard..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} segmentPath={[...]} ...>           <SegmentViewNode type="page" pagePath="dashboard/...">             <SegmentTrieNode>             <NewProductPage>               <NewProductClient brands={[...]} stores={[...]} supervisors={[...]} staff={[...]} recentReceivers={[...]} ...>                 <div className="max-w-4xl ...">                   <header>                   <ConfirmModal>                   <form onSubmit={function handleBatchSubmit} className="flex flex-...">                     <div className="flex flex-...">                       <div className={"bg-surfa..."}>                         <div className="p-6 sm:p-8...">                           <div>                           <div>                           ...                             <div className="flex flex-...">                               <label>                               <div className="flex items...">                                 <div>                                 <div className="flex-1 fle...">                                   <span>                                   <input                                     type="file"                                     accept="image/*"                                     onChange={function onChange}                                     className="hidden" +                                   id="image-file-temp-1790840531417-0" -                                   id="image-file-temp-1790840530375-0"                                   >                                   <label +                                   htmlFor="image-file-temp-1790840531417-0" -                                   htmlFor="image-file-temp-1790840530375-0"                                     className="px-3.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated..."                                   >                           <div className="flex flex-...">                             <h4>                             <div className="flex items...">                               <label className="flex items...">                                 <input                                   type="radio" +                                 name="includeInbound-temp-1790840531417-0" -                                 name="includeInbound-temp-1790840530375-0"                                   checked={true}                                   onChange={function onChange}                                   className="accent-primary"                                 >                                 ...                               <label className="flex items...">                                 <input                                   type="radio" +                                 name="includeInbound-temp-1790840531417-0" -                                 name="includeInbound-temp-1790840530375-0"                                   checked={false}                                   onChange={function onChange}                                   className="accent-primary"                                 >                                 ...                           ...                     ...                   ...           ...         ... ` | 2026-10-01T07:42:11.464Z |
| `http://localhost:3000/dashboard/staff/assign` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <RedirectBoundary>       <RedirectErrorBoundary router={{...}}>         <InnerLayoutRouter url="/dashboard..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} segmentPath={[...]} ...>           <SegmentViewNode type="page" pagePath="dashboard/...">             <SegmentTrieNode>             <AssignPage>               <AssignClient staffList={[...]} stores={[...]} initialAllocation={null} editStaffObj={null}>                 <div className="flex flex-...">                   <header>                   <form onSubmit={function handleBulkSubmit} className="flex flex-...">                     <div className="flex flex-...">                       <div className={"bg-surfa..."}>                         <div className="p-6 sm:p-8...">                           <div>                           <div className="flex flex-...">                             <div className="flex items...">                               <label className="flex items...">                                 <input                                   type="radio" +                                 name="promoterType-item-1790840567818-0-ybaoe86ys" -                                 name="promoterType-item-1790840566046-0-hxzyb6uhk"                                   checked={true}                                   onChange={function onChange}                                   className="accent-primary"                                 >                                 ...                               <label className="flex items...">                                 <input                                   type="radio" +                                 name="promoterType-item-1790840567818-0-ybaoe86ys" -                                 name="promoterType-item-1790840566046-0-hxzyb6uhk"                                   checked={false}                                   onChange={function onChange}                                   className="accent-primary"                                 >                                 ...                             ...                           ...                     ...           ...         ... ` | 2026-10-01T07:42:48.215Z |
| `http://localhost:3000/dashboard/outbound/new` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <LoadingBoundary name="new/" loading={null}>       <HTTPAccessFallbackBoundary notFound={undefined} forbidden={undefined} unauthorized={undefined}>         <RedirectBoundary>           <RedirectErrorBoundary router={{...}}>             <InnerLayoutRouter url="/dashboard..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} ...>               <SegmentViewNode type="page" pagePath="dashboard/...">                 <SegmentTrieNode>                 <NewOutboundPage>                   <OutboundClient products={[...]} stores={[...]} brands={[...]} directSellers={[...]} ...>                     <Suspense fallback={<div>}>                       <OutboundFormContent products={[...]} stores={[...]} supervisors={[...]} directSellers={[...]} ...>                         <div className="max-w-4xl ...">                           <div>                           <header>                           <ConfirmModal>                           <div className="bg-surface...">                             <h3>                             <div className="grid grid-...">                               <div>                               <div className="flex flex-...">                                 <div>                                 <CustomSelect options={[...]} value="" onChange={function onChange} ...>                                   <div className={"relative..."}>                                     <button>                                     <input                                       tabIndex={-1}                                       required={true}                                       value=""                                       onChange={function onChange}                                       style={{ +                                       position: "absolute" -                                       position: "absolute" +                                       opacity: 0 -                                       opacity: "0" +                                       pointerEvents: "none" +                                       bottom: 0 -                                       bottom: "0px" +                                       left: 0 -                                       left: "0px" +                                       right: 0 -                                       right: "0px" +                                       height: "1px" -                                       height: "1px" -                                       pointer-events: "none" -                                       caret-color: "transparent"                                       }}                                     >                               <div className="flex flex-...">                                 <label>                                 <input                                   type="datetime-local"                                   className="w-full bg-surface text-text-primary border border-border rounded-lg px-3 ..."                                   value="2026-10-01T11:43"                                   onChange={function onChange}                                   required={true} -                                 style={{caret-color:"transparent"}}                                 >                               <div className="flex flex-...">                                 <label>                                 <input                                   type="text"                                   className="w-full bg-surface text-text-primary placeholder:text-text-muted border bo..."                                   value=""                                   onChange={function onChange}                                   placeholder="Global remark visible at the top of the Delivery Note PDF..." -                                 style={{caret-color:"transparent"}}                                 >                             ...                           <div className="bg-surface...">                             <div>                             <div className="p-5 flex f...">                               <input                                 type="text"                                 className="w-full bg-surface text-text-primary placeholder:text-text-muted border bord..."                                 placeholder="Focus here to scan or type a serial number..."                                 value=""                                 onChange={function onChange}                                 onKeyDown={function handleGlobalScanSubmit} -                               style={{caret-color:"transparent"}}                               >                               ...                           ...               ...             ... ` | 2026-10-01T07:43:38.544Z |





---
*Generated automatically by Antigravity Headless Audit Agent.*
