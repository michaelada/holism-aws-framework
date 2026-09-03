# `packages/orgadmin-merchandise` — Merchandise capability module

Sells branded goods: product types with options and stock, order management, delivery rules and
merchandise discounts.

- **Capability:** `merchandise`. Discount pages gate on `merchandise-discounts`.
- **Discounts attach to products** through `merchandise_types.discount_ids`, like every other
  sellable thing. The column and its service reads/writes were added in
  `1709000000024`; before that the page's `DiscountSelector` existed but its selection was
  discarded on save, so merchandise discounts could be created and never applied.
- **Demo data:** the seed gives **only Kildare Hunt** a shop — 8 products covering all three
  delivery models, tracked and untracked stock, sold-out, hidden and inactive states, each with a
  generated SVG data-URI image. See `docs/EVENTS_DEMO_SEED.md`.
- **Tests:** Vitest — `npm run test:orgadmin-merchandise` (~5 test files; the thinnest coverage of
  the capability modules, so new work here should add tests generously).

## Routes (`src/index.ts`)

| Path | Page | Capability |
|---|---|---|
| `merchandise` | `MerchandiseTypesListPage` | — |
| `merchandise/new` | `CreateMerchandiseTypePage` | — |
| `merchandise/:id` | `MerchandiseTypeDetailsPage` | — |
| `merchandise/:id/edit` | `CreateMerchandiseTypePage` (edit mode) | — |
| `merchandise/orders` | `MerchandiseOrdersListPage` | — |
| `merchandise/orders/:id` | `MerchandiseOrderDetailsPage` | — |
| `merchandise/discounts` | `DiscountsListPage` | `merchandise-discounts` |
| `merchandise/discounts/new` | `CreateDiscountPage` | `merchandise-discounts` |
| `merchandise/discounts/:id/edit` | `EditDiscountPage` | `merchandise-discounts` |
| `merchandise/discounts/:id/stats` | `DiscountUsagePage` (from `orgadmin-events`) | `merchandise-discounts` |  <!-- where the list's View Usage icon goes; see docs/DISCOUNT_USAGE_PAGE.md -->

## Layout

```
src/
  index.ts        merchandiseModule registration
  pages/          The pages above
  components/
    MerchandiseTypeForm             Product definition
    OptionsConfigurationSection     Option types and values (size, colour, …)
    StockManagementSection          Stock levels and availability
    OrderQuantityRulesSection       Min/max/multiples per order
    DeliveryConfigurationSection    Delivery rules and charges
    ImageGalleryUpload              Product imagery (built on shared upload components)
    OrderStatusUpdateDialog         Move an order through its lifecycle
    BatchOrderOperationsDialog      Bulk order actions
  utils/priceCalculator.ts          Price from base + options + quantity rules + discounts
  types/          merchandise.types, module.types
```

## Concepts

- **Option types and values** — a product type declares option types (e.g. Size) each with values;
  the combination determines the purchasable variant and can adjust price. Persisted in
  `merchandise_option_types` / `merchandise_option_values`.
- **Stock** — tracked per type/variant; `StockManagementSection` drives availability.
- **Delivery rules** — `delivery_rules`, served by the backend `delivery-rule.service`.
- **Orders** — `merchandise_orders` with an audit trail in `merchandise_order_history`; status
  transitions go through `OrderStatusUpdateDialog`.
- **Pricing** — `utils/priceCalculator.ts` is the single place combining base price, option
  modifiers, quantity rules and discounts. Change pricing there, not in a page.

## Data it touches

`/api/orgadmin/merchandise*` endpoints, discounts for merchandise, file upload for images.
Backend: `merchandise.service`, `merchandise-option.service`, `delivery-rule.service`,
`discount*.service`, `file-upload.service`.

## Where to look for what

| Question | Start at |
|---|---|
| "How is a price computed?" | `utils/priceCalculator.ts` |
| "How are product variants defined?" | `components/OptionsConfigurationSection.tsx` |
| "What can an order's status be?" | `components/OrderStatusUpdateDialog.tsx` + `merchandise.types.ts` |
| "Where are delivery charges set?" | `components/DeliveryConfigurationSection.tsx` |

## Deleting a merchandise type withdraws it

`deleteMerchandiseType` is a **soft delete** (`deleted` / `deleted_at` / `deleted_by`) — see
[docs/SOFT_DELETE.md](../../docs/SOFT_DELETE.md). `merchandise_orders` reference these rows, so a
hard delete would take order history with it.

Its option types, option values and delivery rules are **no longer destroyed** when the type is
withdrawn; they used to be hard-deleted first, which silently discarded the sizes and colours past
orders referred to. Lists and get-by-id filter `deleted = FALSE`; the order-line name lookup
deliberately does not, so past orders keep naming what was bought.
