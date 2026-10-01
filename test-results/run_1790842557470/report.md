# Headless Browser Automated Audit Report

**Run ID**: `run_1790842557470`  
**Timestamp**: 2026-10-01T08:15:57.472Z  
**Base URL**: `http://localhost:3000`  

---

## 📊 Summary

| Metric | Value |
| :--- | :--- |
| **Total Test Steps** | **19** |
| **Passed Steps** | ✅ **18** |
| **Failed Steps** | ❌ **1** |
| **Console Errors** | ⚠️ **20** |
| **Network Errors (4xx/5xx)** | 🌐 **0** |
| **Page JS Exceptions** | 💥 **0** |

---

## 📋 Detailed Test Steps

| Step | Action Name | Duration | Status | Screenshot |
| :---: | :--- | :---: | :---: | :--- |
| 1 | **01_Visit_Login_Page** | 3.73s | ✅ PASSED | [`00_01_Visit_Login_Page.png`](./screenshots/00_01_Visit_Login_Page.png) |
| 2 | **02_Admin_Authentication_And_Dashboard_Entry** | 54.94s | ✅ PASSED | [`01_02_Admin_Authentication_And_Dashboard_Entry.png`](./screenshots/01_02_Admin_Authentication_And_Dashboard_Entry.png) |
| 3 | **03_Dashboard_Overview_Cards** | 3.63s | ✅ PASSED | [`02_03_Dashboard_Overview_Cards.png`](./screenshots/02_03_Dashboard_Overview_Cards.png) |
| 4 | **04_Navigate_Brands_List** | 12.59s | ✅ PASSED | [`03_04_Navigate_Brands_List.png`](./screenshots/03_04_Navigate_Brands_List.png) |
| 5 | **05_Create_New_Brand** | 20.66s | ❌ FAILED | [`04_05_Create_New_Brand.png`](./screenshots/04_05_Create_New_Brand.png) |
| 6 | **06_Inspect_Brand_Detail_And_Portal** | 3.18s | ✅ PASSED | [`05_06_Inspect_Brand_Detail_And_Portal.png`](./screenshots/05_06_Inspect_Brand_Detail_And_Portal.png) |
| 7 | **07_Navigate_Stores_List** | 14.21s | ✅ PASSED | [`06_07_Navigate_Stores_List.png`](./screenshots/06_07_Navigate_Stores_List.png) |
| 8 | **08_Create_New_Store** | 26.64s | ✅ PASSED | [`07_08_Create_New_Store.png`](./screenshots/07_08_Create_New_Store.png) |
| 9 | **09_Create_New_Supervisor** | 49.77s | ✅ PASSED | [`08_09_Create_New_Supervisor.png`](./screenshots/08_09_Create_New_Supervisor.png) |
| 10 | **10_Create_New_Product** | 65.14s | ✅ PASSED | [`09_10_Create_New_Product.png`](./screenshots/09_10_Create_New_Product.png) |
| 11 | **11_Staff_Management_And_Assign** | 41.35s | ✅ PASSED | [`10_11_Staff_Management_And_Assign.png`](./screenshots/10_11_Staff_Management_And_Assign.png) |
| 12 | **12_Inbound_Deliveries_Ledger_And_New** | 34.37s | ✅ PASSED | [`11_12_Inbound_Deliveries_Ledger_And_New.png`](./screenshots/11_12_Inbound_Deliveries_Ledger_And_New.png) |
| 13 | **13_Outbound_Deliveries_Ledger_And_New** | 21.70s | ✅ PASSED | [`12_13_Outbound_Deliveries_Ledger_And_New.png`](./screenshots/12_13_Outbound_Deliveries_Ledger_And_New.png) |
| 14 | **14_Client_Returns_And_Balances** | 21.15s | ✅ PASSED | [`13_14_Client_Returns_And_Balances.png`](./screenshots/13_14_Client_Returns_And_Balances.png) |
| 15 | **15_Damage_And_Loss_Flow** | 29.71s | ✅ PASSED | [`14_15_Damage_And_Loss_Flow.png`](./screenshots/14_15_Damage_And_Loss_Flow.png) |
| 16 | **16_Rebrand_And_Repurpose_Flow** | 15.32s | ✅ PASSED | [`15_16_Rebrand_And_Repurpose_Flow.png`](./screenshots/15_16_Rebrand_And_Repurpose_Flow.png) |
| 17 | **17_Ledgers_Transactions_Expiry_Used_Reports_Settings** | 55.01s | ✅ PASSED | [`16_17_Ledgers_Transactions_Expiry_Used_Reports_Settings.png`](./screenshots/16_17_Ledgers_Transactions_Expiry_Used_Reports_Settings.png) |
| 18 | **18_Global_Search_Feature** | 19.54s | ✅ PASSED | [`17_18_Global_Search_Feature.png`](./screenshots/17_18_Global_Search_Feature.png) |
| 19 | **19_Security_Invalid_Credentials_Rejection** | 20.73s | ✅ PASSED | [`18_19_Security_Invalid_Credentials_Rejection.png`](./screenshots/18_19_Security_Invalid_Credentials_Rejection.png) |


---

## ❌ Step Failures & Errors

### Step 5: 05_Create_New_Brand
- **Error**: `Newly created brand "Brand_558450" not found in brands list`
- **Duration**: 20656ms




---

## ⚠️ Browser Console Errors Detected

| URL | Error Message | Time |
| :--- | :--- | :--- |
| `http://localhost:3000/dashboard/stores` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <LoadingBoundary name="stores/" loading={null}>       <HTTPAccessFallbackBoundary notFound={undefined} forbidden={undefined} unauthorized={undefined}>         <RedirectBoundary>           <RedirectErrorBoundary router={{...}}>             <InnerLayoutRouter url="/dashboard..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} ...>               <SegmentViewNode type="page" pagePath="dashboard/...">                 <SegmentTrieNode>                 <StoresPage>                   <Suspense fallback={<div>}>                     <StoresClient initialStores={[...]}>                       <div className="flex flex-...">                         <header>                         <div className="flex flex-...">                           <div className="bg-surface...">                             <div className="relative f...">                               <Search>                               <input                                 type="text"                                 className="w-full bg-surface text-text-primary placeholder:text-text-muted border bord..."                                 placeholder="Search stores by name or address..."                                 value=""                                 onChange={function onChange} -                               style={{caret-color:"transparent"}}                               >                             ...                           ...                         ...               ...             ... ` | 2026-10-01T08:17:52.404Z |
| `http://localhost:3000/dashboard/products/new` | `A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up. This can happen if a SSR-ed Client Component used:  - A server/client branch `if (typeof window !== 'undefined')`. - Variable input such as `Date.now()` or `Math.random()` which changes each time it's called. - Date formatting in a user's locale which doesn't match the server. - External changing data without sending a snapshot of it along with the HTML. - Invalid HTML tag nesting.  It can also happen if the client has a browser extension installed which messes with the HTML before React loaded.  %s%s https://react.dev/link/hydration-mismatch     ...     <RedirectBoundary>       <RedirectErrorBoundary router={{...}}>         <InnerLayoutRouter url="/dashboard..." tree={[...]} params={{}} cacheNode={{rsc:{...}, ...}} segmentPath={[...]} ...>           <SegmentViewNode type="page" pagePath="dashboard/...">             <SegmentTrieNode>             <NewProductPage>               <NewProductClient brands={[...]} stores={[...]} supervisors={[...]} staff={[...]} recentReceivers={[...]} ...>                 <div className="max-w-4xl ...">                   <header>                   <ConfirmModal>                   <form onSubmit={function handleBatchSubmit} className="flex flex-...">                     <div className="flex flex-...">                       <div className={"bg-surfa..."}>                         <div className="p-6 sm:p-8...">                           <div>                           <div>                           ...                             <div className="flex flex-...">                               <label>                               <div className="flex items...">                                 <div>                                 <div className="flex-1 fle...">                                   <span>                                   <input                                     type="file"                                     accept="image/*"                                     onChange={function onChange}                                     className="hidden" +                                   id="image-file-temp-1790842797076-0" -                                   id="image-file-temp-1790842793659-0"                                   >                                   <label +                                   htmlFor="image-file-temp-1790842797076-0" -                                   htmlFor="image-file-temp-1790842793659-0"                                     className="px-3.5 py-1.5 bg-surface border border-border hover:bg-surface-elevated..."                                   >                           <div className="flex flex-...">                             <h4>                             <div className="flex items...">                               <label className="flex items...">                                 <input                                   type="radio" +                                 name="includeInbound-temp-1790842797076-0" -                                 name="includeInbound-temp-1790842793659-0"                                   checked={true}                                   onChange={function onChange}                                   className="accent-primary"                                 >                                 ...                               <label className="flex items...">                                 <input                                   type="radio" +                                 name="includeInbound-temp-1790842797076-0" -                                 name="includeInbound-temp-1790842793659-0"                                   checked={false}                                   onChange={function onChange}                                   className="accent-primary"                                 >                                 ...                           ...                     ...                   ...           ...         ... ` | 2026-10-01T08:19:57.195Z |
| `http://localhost:3000/dashboard/staff/assign` | `Failed to load resource: net::ERR_FAILED` | 2026-10-01T08:20:53.582Z |
| `http://localhost:3000/dashboard/staff/assign` | `Failed to load resource: net::ERR_FAILED` | 2026-10-01T08:20:53.701Z |
| `http://localhost:3000/dashboard/staff/assign` | `Failed to load resource: net::ERR_FAILED` | 2026-10-01T08:20:53.703Z |
| `http://localhost:3000/dashboard/staff/assign` | `Failed to load resource: net::ERR_FAILED` | 2026-10-01T08:20:53.703Z |
| `http://localhost:3000/dashboard/staff/assign` | `Failed to load resource: net::ERR_FAILED` | 2026-10-01T08:20:53.703Z |
| `http://localhost:3000/dashboard/staff/assign` | `Failed to load resource: net::ERR_FAILED` | 2026-10-01T08:20:53.703Z |
| `http://localhost:3000/dashboard/staff/assign` | `Failed to load resource: net::ERR_FAILED` | 2026-10-01T08:20:53.706Z |
| `http://localhost:3000/dashboard/staff/assign` | `Failed to load resource: net::ERR_FAILED` | 2026-10-01T08:20:53.707Z |
| `http://localhost:3000/dashboard/staff/assign` | `Failed to load resource: net::ERR_FAILED` | 2026-10-01T08:20:53.707Z |
| `http://localhost:3000/dashboard/inbound` | `Failed to load resource: net::ERR_FAILED` | 2026-10-01T08:20:56.255Z |
| `http://localhost:3000/dashboard/inbound` | `Failed to load resource: net::ERR_FAILED` | 2026-10-01T08:20:56.286Z |
| `http://localhost:3000/dashboard/inbound` | `Failed to load resource: net::ERR_FAILED` | 2026-10-01T08:20:56.287Z |
| `http://localhost:3000/dashboard/inbound` | `Failed to load resource: net::ERR_FAILED` | 2026-10-01T08:20:56.295Z |
| `http://localhost:3000/dashboard/inbound` | `Failed to load resource: net::ERR_FAILED` | 2026-10-01T08:20:56.296Z |
| `http://localhost:3000/dashboard/inbound` | `Failed to load resource: net::ERR_FAILED` | 2026-10-01T08:20:56.296Z |
| `http://localhost:3000/dashboard/inbound` | `Failed to load resource: net::ERR_FAILED` | 2026-10-01T08:20:56.297Z |
| `http://localhost:3000/dashboard/inbound` | `Failed to load resource: net::ERR_FAILED` | 2026-10-01T08:20:56.298Z |
| `http://localhost:3000/dashboard/inbound` | `Failed to load resource: net::ERR_FAILED` | 2026-10-01T08:20:56.298Z |





---
*Generated automatically by Antigravity Headless Audit Agent.*
