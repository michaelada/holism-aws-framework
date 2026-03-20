# Run all tasks: .kiro/specs/merchandise-module/tasks.md (Continued)

Exported: 20/03/2026, 17:02:54

---

**User:**

## TASK 1: Run all tasks for merchandise-module spec
- **STATUS**: done
- **USER QUERIES**: 1 ("Run all tasks for this spec")
- **DETAILS**: Executed all required (non-optional) tasks from `.kiro/specs/merchandise-module/tasks.md`. Tasks 1-9 and 12 were completed. Tasks 10-11 (property-based tests) were skipped as they're marked optional with `*`. The work involved:
  - Task 1: Types already had `discountIds` in both frontend and backend
  - Task 2: List page already had real API; added delete with confirmation dialog
  - Task 3: Create/edit page wired to POST/PUT, edit mode loading, form validation (already existed), DiscountSelector integration, application form selection
  - Task 4: Checkpoint (marked complete)
  - Task 5: Details page wired to real API with delete confirmation (already existed)
  - Task 6: Orders list page wired with server-side filtering, date range filters, and Excel export
  - Task 7: Order details page wired with admin notes save functionality
  - Task 8: OrderStatusUpdateDialog and BatchOrderOperationsDialog wired to API
  - Task 9, 12: Checkpoints (marked complete)
- **FILEPATHS**: `.kiro/specs/merchandise-module/tasks.md`, `packages/orgadmin-merchandise/src/pages/*.tsx`, `packages/orgadmin-merchandise/src/components/*.tsx`, `packages/orgadmin-merchandise/src/types/merchandise.types.ts`, `packages/backend/src/services/merchandise.service.ts`

## TASK 2: Fix blank page when navigating to merchandise module
- **STATUS**: done
- **USER QUERIES**: 2, 3 ("When I go to the merchandise module, I am still seeing a blank page")
- **DETAILS**: Root cause was in `packages/orgadmin-shell/vite.config.ts` — the merchandise module was aliased to a mock file (`./src/test/mocks/orgadmin-merchandise.ts`) that renders `null` components. Fixed by:
  1. Changed alias to point to real source: `'@aws-web-framework/orgadmin-merchandise': path.resolve(__dirname, '../orgadmin-merchandise/src')`
  2. Added `'@aws-web-framework/orgadmin-merchandise'` to `optimizeDeps.exclude` array
  3. Fixed inconsistent navigation paths — some pages used `/orgadmin/merchandise/...` instead of `/merchandise/...` (the router handles the `/orgadmin` base path). Fixed in `MerchandiseTypesListPage.tsx`, `MerchandiseTypeDetailsPage.tsx`, and `MerchandiseOrdersListPage.tsx`
- **FILEPATHS**: `packages/orgadmin-shell/vite.config.ts`, `packages/orgadmin-merchandise/src/pages/MerchandiseTypesListPage.tsx`, `packages/orgadmin-merchandise/src/pages/MerchandiseTypeDetailsPage.tsx`, `packages/orgadmin-merchandise/src/pages/MerchandiseOrdersListPage.tsx`

## TASK 3: Add missing merchandise translation keys
- **STATUS**: in-progress
- **USER QUERIES**: 4 ("The merchandise section is missing translations for a bunch of keys")
- **DETAILS**: Identified 53 missing translation keys by comparing keys used in `packages/orgadmin-merchandise/src/**/*.tsx` against keys in `packages/orgadmin-shell/src/locales/en-GB/translation.json`. Started adding missing keys to the English translation file. The following groups were ALREADY ADDED to en-GB:
  - `merchandise.table.image`, `merchandise.table.options` — added to table section
  - `merchandise.deleteDialog.*` (title, message, cancel, confirm) — added new section
  - `merchandise.filters.dateFrom`, `merchandise.filters.dateTo` — added to filters section
  - `merchandise.sections.discounts`, `merchandise.sections.emailConfig`, `merchandise.sections.stockStatus` — added to sections
  - `merchandise.fields.supportedPaymentMethods`, `merchandise.fields.selectDiscounts`, `merchandise.fields.selectDiscountsHelper` — added to fields
  - `merchandise.stock.tracking`, `merchandise.stock.lowStockThreshold`, `merchandise.stock.outOfStockBehavior` — added to stock
- **NEXT STEPS** (keys still missing from en-GB):
  - `merchandise.delivery.free` ("Free Delivery"), `merchandise.delivery.fixed` ("Fixed Fee: ") — display labels used in MerchandiseTypeDetailsPage
  - `merchandise.email.*` (confirmationMessage, noNotificationEmails, notificationEmails)
  - `merchandise.errors.*` (batchUpdateFailed, deleteFailed, exportFailed, loadFailed, loadOrderFailed, loadOrdersFailed, saveNotesFailed, updateStatusFailed)
  - `merchandise.orderNotFound`
  - `merchandise.orders.*` (adminNotes, adminNotesPlaceholder, customer, deliveryFee, email, merchandiseType, noHistory, orderDate, orderHistory, orderInformation, orderItems, orderStatus, paymentStatus, quantity, selectedOptions, subtotal, total, unitPrice)
  - `merchandise.payment.*` (handlingFeeIncluded, noMethods, termsEnabled)
  - `merchandise.quantity.*` (increment, max, min)
  - After en-GB is complete, the same keys need to be added to ALL other locale files: `de-DE`, `es-ES`, `fr-FR`, `it-IT`, `pt-PT`
- **FILEPATHS**: `packages/orgadmin-shell/src/locales/en-GB/translation.json`, `packages/orgadmin-shell/src/locales/de-DE/translation.json`, `packages/orgadmin-shell/src/locales/es-ES/translation.json`, `packages/orgadmin-shell/src/locales/fr-FR/translation.json`, `packages/orgadmin-shell/src/locales/it-IT/translation.json`, `packages/orgadmin-shell/src/locales/pt-PT/translation.json`

## USER CORRECTIONS AND INSTRUCTIONS:
- The project uses i18next with translation files in `packages/orgadmin-shell/src/locales/{locale}/translation.json`
- Navigation paths in module pages should NOT include `/orgadmin` prefix — the router base path handles that
- Follow patterns from memberships/events modules for shared integrations (discounts, payment methods, etc.)
- The `useTranslation` hook comes from `@aws-web-framework/orgadmin-shell`

## Files to read
- `packages/orgadmin-shell/src/locales/en-GB/translation.json` (the merchandise section ~line 888-1105, to see current state and add remaining missing keys)
- `packages/orgadmin-shell/src/locales/de-DE/translation.json` (merchandise section ~line 639, needs same keys added with German translations)
- `packages/orgadmin-shell/src/locales/fr-FR/translation.json` (merchandise section ~line 858, needs same keys added with French translations)
- `packages/orgadmin-shell/src/locales/es-ES/translation.json` (merchandise section ~line 857, needs same keys added with Spanish translations)
- `packages/orgadmin-shell/src/locales/it-IT/translation.json` (merchandise section ~line 639, needs same keys added with Italian translations)
- `packages/orgadmin-shell/src/locales/pt-PT/translation.json` (merchandise section ~line 639, needs same keys added with Portuguese translations)
- `packages/orgadmin-merchandise/src/pages/MerchandiseTypeDetailsPage.tsx` (uses delivery.free, delivery.fixed, email.*, payment.*, quantity.*, stock.tracking etc.)
- `packages/orgadmin-merchandise/src/pages/MerchandiseOrderDetailsPage.tsx` (uses orders.* detail keys)
- `packages/orgadmin-merchandise/src/pages/MerchandiseOrdersListPage.tsx` (uses errors.*, filters.dateFrom/dateTo)
- `packages/orgadmin-merchandise/src/pages/MerchandiseTypesListPage.tsx` (uses deleteDialog.*, errors.deleteFailed)

USER QUERIES(most recent first):
1. When I go tot he merchandise module, I am still seeing a blank page ?
2. Run all tasks for this spec.
3. <implicit-rules>## Implicit Rules
You are working on the implementation plan. 
Ensure each task is actionable, references specific requirements, and focuses only on coding activities. 
Inform the user that the spec is complete and they can begin implementing the tasks by opening the tasks.md file.</implicit-rules>

---

**Assistant:**



Let me pick up where we left off — adding the remaining missing translation keys to all locale files. Let me read the current state of the files.

Let me read the rest of the en-GB merchandise section and also check the other locale files.

Now I can see the full picture. Let me compile the missing keys. I need to check what's in the en-GB file and compare against what the components use. Let me also check the other locale files to see their current merchandise sections.

Now let me read the merchandise sections from the non-English locale files to see what keys they currently have.

Now let me see the rest of each non-English locale's merchandise section to understand what they already have beyond `stock`:

Now I have a clear picture. All non-English locales are missing the same keys that en-GB is missing. Let me compile the complete list of missing keys by comparing what the components use vs what exists in en-GB:

Missing from en-GB:
1. `merchandise.delivery.free` / `merchandise.delivery.fixed` (used in details page as display labels, different from `freeDelivery`/`fixedFee` in the form)
2. `merchandise.email.*` (confirmationMessage, noNotificationEmails, notificationEmails)
3. `merchandise.errors.*` (batchUpdateFailed, deleteFailed, exportFailed, loadFailed, loadOrderFailed, loadOrdersFailed, saveNotesFailed, updateStatusFailed)
4. `merchandise.orderNotFound`
5. `merchandise.orders.*` (adminNotes, adminNotesPlaceholder, customer, deliveryFee, email, merchandiseType, noHistory, orderDate, orderHistory, orderInformation, orderItems, orderStatus, paymentStatus, quantity, selectedOptions, subtotal, total, unitPrice)
6. `merchandise.payment.*` (handlingFeeIncluded, noMethods, termsEnabled)
7. `merchandise.quantity.*` (increment, max, min)
8. `merchandise.table.image`, `merchandise.table.options` — already added per context
9. `merchandise.deleteDialog.*` — already added per context
10. `merchandise.filters.dateFrom`, `merchandise.filters.dateTo` — already added per context
11. `merchandise.sections.discounts`, `merchandise.sections.emailConfig`, `merchandise.sections.stockStatus` — already added per context
12. `merchandise.fields.supportedPaymentMethods`, `merchandise.fields.selectDiscounts`, `merchandise.fields.selectDiscountsHelper` — already added per context
13. `merchandise.stock.tracking`, `merchandise.stock.lowStockThreshold`, `merchandise.stock.outOfStockBehavior` — already added per context

Let me now add all the remaining missing keys. I'll start with en-GB, then do all other locales.

Now add the `errors`, `email`, `payment`, and `quantity` sections to en-GB. Let me find the right place to insert them — after the `actions` section at the end of merchandise:

en-GB is done. Now let me add the same missing keys to all other locales. I'll do them all in parallel:

Now let me also add the missing `sections` keys (discounts, emailConfig, stockStatus) and `fields` keys (supportedPaymentMethods, selectDiscounts, selectDiscountsHelper) and `stock` keys (tracking, lowStockThreshold, outOfStockBehavior) and `filters` keys (dateFrom, dateTo) and `table` keys (image, options) and `deleteDialog` to the non-English locales. Let me check which of these are already present:

So the non-English locales are also missing: `table.image`, `table.options`, `deleteDialog.*`, `filters.dateFrom`, `filters.dateTo`, `sections.discounts`, `sections.emailConfig`, `sections.stockStatus`, `fields.supportedPaymentMethods`, `fields.selectDiscounts`, `fields.selectDiscountsHelper`, `stock.tracking`, `stock.lowStockThreshold`, `stock.outOfStockBehavior`. Let me add all of these to each non-English locale now.

Now add the `deleteDialog` to de-DE. Let me find where to insert it:

de-DE is done. Now let's do fr-FR:

fr-FR done. Now es-ES:

es-ES done. Now it-IT:

One of the it-IT replacements was incomplete. Let me fix the actions section in it-IT to add the errors/email/payment/quantity sections:

Now let me do pt-PT:

Now let me also add the es-ES delivery.free/fixed keys:

Now let me verify the JSON is valid across all files:

All JSON files are valid. Let me do a quick sanity check to make sure all the key translation keys are present across all locales:

All 6 locales have the keys. Everything looks good. All 53 missing translation keys have been added across all 6 locale files (en-GB, de-DE, fr-FR, es-ES, it-IT, pt-PT) with proper translations for each language.

The missing keys covered these categories:
- `merchandise.orders.*` — 14 order detail keys (orderInformation, orderDate, customer, email, etc.)
- `merchandise.orderNotFound` — order not found message
- `merchandise.errors.*` — 8 error message keys
- `merchandise.email.*` — 3 email configuration keys
- `merchandise.payment.*` — 3 payment display keys
- `merchandise.quantity.*` — 3 quantity rule keys
- `merchandise.delivery.free` / `merchandise.delivery.fixed` — 2 delivery display labels
- `merchandise.table.image` / `merchandise.table.options` — 2 table column headers
- `merchandise.deleteDialog.*` — 4 delete confirmation dialog keys
- `merchandise.filters.dateFrom` / `merchandise.filters.dateTo` — 2 date filter keys
- `merchandise.sections.discounts` / `merchandise.sections.emailConfig` / `merchandise.sections.stockStatus` — 3 section headers
- `merchandise.fields.supportedPaymentMethods` / `merchandise.fields.selectDiscounts` / `merchandise.fields.selectDiscountsHelper` — 3 field labels
- `merchandise.stock.tracking` / `merchandise.stock.lowStockThreshold` / `merchandise.stock.outOfStockBehavior` — 3 stock display keys

All translation files pass JSON validation with no errors.

---

**User:**

The Supported Payment methods for merchandise only shows "Pay Offline" and "Card Payment (Stripe)".
The Terms and Conditions section is not a rich text editor like Events, Membership Types etc.
Other problems I see, there is no discounts section under Merchandise, I see that we need at least 3 sub menus, one for Merchandise Types, one for Discounts, and one for Merchandise Orders.

---

**Assistant:**

These are solid observations — sounds like a few things need to be brought in line with how the other modules work. Let me scope this out as a new spec.

---
