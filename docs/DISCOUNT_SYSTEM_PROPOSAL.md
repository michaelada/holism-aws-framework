# Comprehensive Discount System Proposal

## Executive Summary

This document proposes a flexible, capability-based discount management system that allows organizations to create and apply various types of discounts across multiple modules (Events, Memberships, Calendar, Merchandise, and Registrations).

## System Overview

### Core Principles

1. **Capability-Based Access**: Discount functionality is controlled by specific capabilities per module
2. **Flexible Discount Types**: Support for percentage and fixed-amount discounts
3. **Multi-Scope Application**: Discounts can apply to individual items, item groups, or entire carts
4. **Module Integration**: Seamless integration with existing modules through consistent UI patterns
5. **Reusability**: Discount definitions can be reused across multiple items within their scope

## Capability Structure

### Discount Capabilities

```
- entry-discounts          (Events module)
- membership-discounts     (Memberships module)
- calendar-discounts       (Calendar module)
- merchandise-discounts    (Merchandise module)
- registration-discounts   (Registrations module)
```

Each capability controls:
- Visibility of "Discounts" menu item in the respective module
- Ability to create/edit/delete discount definitions
- Ability to apply discounts to items within that module

## Discount Definition Schema

### Core Discount Properties

```typescript
interface DiscountDefinition {
  id: string;
  organisationId: string;
  moduleType: 'events' | 'memberships' | 'calendar' | 'merchandise' | 'registrations';
  
  // Basic Information
  name: string;
  description: string;
  code?: string;  // Optional discount code for user entry
  
  // Discount Type
  discountType: 'percentage' | 'fixed';
  discountValue: number;  // Percentage (0-100) or fixed amount
  
  // Application Scope
  applicationScope: 'item' | 'category' | 'cart' | 'quantity-based';
  
  // Quantity-Based Rules (for "buy X get Y" scenarios)
  quantityRules?: {
    minimumQuantity: number;
    applyToQuantity?: number;  // e.g., buy 2 get 1 free
    applyEveryN?: number;      // e.g., every 3rd item is free
  };
  
  // Eligibility Criteria
  eligibilityCriteria?: {
    requiresCode: boolean;
    membershipTypes?: string[];  // Specific membership types eligible
    userGroups?: string[];       // Specific user groups eligible
    minimumPurchaseAmount?: number;
    maximumDiscountAmount?: number;  // Cap on discount value
  };
  
  // Validity Period
  validFrom?: Date;
  validUntil?: Date;
  
  // Usage Limits
  usageLimits?: {
    totalUsageLimit?: number;      // Max times discount can be used overall
    perUserLimit?: number;          // Max times per user
    currentUsageCount: number;      // Track usage
  };
  
  // Combination Rules
  combinable: boolean;  // Can be combined with other discounts
  priority: number;     // Order of application when multiple discounts apply
  
  // Status
  status: 'active' | 'inactive' | 'expired';
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}
```

## Discount Application Scenarios

### 1. Event Discounts

#### Event-Level Discounts
Applied to the entire event entry:
- Early bird discount (percentage off before a date)
- Member discount (fixed amount off for members)
- Group discount (percentage off for multiple entries)

#### Activity-Level Discounts
Applied to specific activities within an event:
- "Buy 2 activities, get 3rd free"
- Member-only activity discount
- Multi-activity bundle discount

**Implementation**:
```typescript
interface Event {
  // ... existing fields
  discounts?: string[];  // Array of discount definition IDs
}

interface EventActivity {
  // ... existing fields
  discounts?: string[];  // Array of discount definition IDs
}
```

### 2. Membership Discounts

- Renewal discount (percentage off for early renewal)
- Family membership discount (fixed amount off for additional members)
- Upgrade discount (percentage off when upgrading membership tier)

### 3. Calendar Booking Discounts

- Multi-slot discount (book 2+ consecutive slots, get discount)
- Full-day discount (book all slots in a day)
- Off-peak discount (percentage off for specific time periods)

### 4. Merchandise Discounts

- Bulk purchase discount (buy X items, get Y% off)
- Category discount (percentage off specific product categories)
- Bundle discount (buy specific combination of items)

### 5. Registration Discounts

- Early registration discount
- Group registration discount
- Returning participant discount

## Database Schema

### Discounts Table

```sql
CREATE TABLE discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  module_type VARCHAR(50) NOT NULL,
  
  -- Basic Information
  name VARCHAR(255) NOT NULL,
  description TEXT,
  code VARCHAR(50),  -- Optional discount code
  
  -- Discount Configuration
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10, 2) NOT NULL,
  
  -- Application Scope
  application_scope VARCHAR(50) NOT NULL CHECK (application_scope IN ('item', 'category', 'cart', 'quantity-based')),
  
  -- Quantity Rules (JSON)
  quantity_rules JSONB,
  
  -- Eligibility Criteria (JSON)
  eligibility_criteria JSONB,
  
  -- Validity Period
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  
  -- Usage Limits (JSON)
  usage_limits JSONB,
  
  -- Combination Rules
  combinable BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES organisation_users(id),
  
  -- Indexes
  INDEX idx_discounts_organisation (organisation_id),
  INDEX idx_discounts_module (module_type),
  INDEX idx_discounts_code (code),
  INDEX idx_discounts_status (status)
);
```

### Discount Applications Table (Many-to-Many)

```sql
CREATE TABLE discount_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id UUID NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
  
  -- Target Entity (polymorphic)
  target_type VARCHAR(50) NOT NULL,  -- 'event', 'event_activity', 'membership_type', etc.
  target_id UUID NOT NULL,
  
  -- Metadata
  applied_at TIMESTAMP DEFAULT NOW(),
  applied_by UUID REFERENCES organisation_users(id),
  
  -- Indexes
  INDEX idx_discount_applications_discount (discount_id),
  INDEX idx_discount_applications_target (target_type, target_id)
);
```

### Discount Usage Tracking Table

```sql
CREATE TABLE discount_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id UUID NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES account_users(id),
  
  -- Transaction Details
  transaction_type VARCHAR(50) NOT NULL,  -- 'event_entry', 'membership', etc.
  transaction_id UUID NOT NULL,
  
  -- Discount Applied
  original_amount DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) NOT NULL,
  final_amount DECIMAL(10, 2) NOT NULL,
  
  -- Metadata
  applied_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_discount_usage_discount (discount_id),
  INDEX idx_discount_usage_user (user_id),
  INDEX idx_discount_usage_transaction (transaction_type, transaction_id)
);
```

## Frontend Architecture

### Module Structure

Each module with discount capability will have:

```
packages/orgadmin-{module}/src/
├── pages/
│   ├── DiscountsListPage.tsx       # List all discounts
│   ├── CreateDiscountPage.tsx      # Create/Edit discount
│   └── ... (existing pages)
├── components/
│   ├── DiscountSelector.tsx        # Reusable discount selection component
│   └── DiscountSummary.tsx         # Display applied discounts
└── types/
    └── discount.types.ts           # Discount type definitions
```

### UI Components

#### 1. Discount List Page
- Table view of all discounts for the module
- Columns: Name, Type, Value, Scope, Status, Usage Count, Actions
- Filters: Status, Type, Scope
- Search by name or code
- Actions: Edit, Activate/Deactivate, Delete, View Usage

#### 2. Create/Edit Discount Page
Multi-step wizard:

**Step 1: Basic Information**
- Name
- Description
- Discount code (optional)
- Status

**Step 2: Discount Configuration**
- Discount type (Percentage / Fixed Amount)
- Discount value
- Application scope (Item / Category / Cart / Quantity-based)
- Quantity rules (if quantity-based)

**Step 3: Eligibility Criteria**
- Requires code entry
- Eligible membership types
- Eligible user groups
- Minimum purchase amount
- Maximum discount amount

**Step 4: Validity & Limits**
- Valid from date
- Valid until date
- Total usage limit
- Per-user limit
- Combinable with other discounts
- Priority

**Step 5: Review & Confirm**
- Summary of all settings
- Save as Active or Inactive

#### 3. Discount Selector Component

Reusable component for applying discounts to items:

```typescript
<DiscountSelector
  moduleType="events"
  selectedDiscounts={selectedDiscounts}
  onChange={handleDiscountChange}
  multiSelect={true}
/>
```

Features:
- Only shows if discounts exist for the module
- Checkbox to enable discount selection
- Multi-select dropdown when enabled
- Shows discount details on hover
- Validates discount eligibility

### Integration with Existing Pages

#### Events Module Integration

**CreateEventPage.tsx - Step 1 (Basic Information)**

Add after Event Type and Venue selection:

```typescript
{/* Event-Level Discounts */}
{eventDiscounts.length > 0 && (
  <>
    <Grid item xs={12}>
      <FormControlLabel
        control={
          <Checkbox
            checked={applyEventDiscounts}
            onChange={(e) => setApplyEventDiscounts(e.target.checked)}
          />
        }
        label="Apply Discounts to Event"
      />
    </Grid>
    
    {applyEventDiscounts && (
      <Grid item xs={12}>
        <DiscountSelector
          moduleType="events"
          selectedDiscounts={formData.discounts}
          onChange={(discounts) => handleChange('discounts', discounts)}
          multiSelect={true}
        />
      </Grid>
    )}
  </>
)}
```

**CreateEventPage.tsx - Step 4 (Activities)**

Add to each activity form:

```typescript
{/* Activity-Level Discounts */}
{eventDiscounts.length > 0 && (
  <>
    <FormControlLabel
      control={
        <Checkbox
          checked={activity.applyDiscounts}
          onChange={(e) => handleActivityChange(index, 'applyDiscounts', e.target.checked)}
        />
      }
      label="Apply Discounts to Activity"
    />
    
    {activity.applyDiscounts && (
      <DiscountSelector
        moduleType="events"
        selectedDiscounts={activity.discounts}
        onChange={(discounts) => handleActivityChange(index, 'discounts', discounts)}
        multiSelect={true}
      />
    )}
  </>
)}
```

## Backend Architecture

### Service Layer

```typescript
// discount.service.ts
class DiscountService {
  // CRUD Operations
  async createDiscount(data: CreateDiscountDto): Promise<Discount>
  async updateDiscount(id: string, data: UpdateDiscountDto): Promise<Discount>
  async deleteDiscount(id: string): Promise<void>
  async getDiscountById(id: string): Promise<Discount | null>
  async getDiscountsByOrganisation(orgId: string, moduleType?: string): Promise<Discount[]>
  
  // Application Operations
  async applyDiscountToTarget(discountId: string, targetType: string, targetId: string): Promise<void>
  async removeDiscountFromTarget(discountId: string, targetType: string, targetId: string): Promise<void>
  async getDiscountsForTarget(targetType: string, targetId: string): Promise<Discount[]>
  
  // Validation & Calculation
  async validateDiscount(discountId: string, userId: string, amount: number): Promise<ValidationResult>
  async calculateDiscount(discountId: string, amount: number, quantity: number): Promise<DiscountCalculation>
  async calculateCartDiscounts(cartItems: CartItem[], userId: string): Promise<CartDiscountResult>
  
  // Usage Tracking
  async recordDiscountUsage(discountId: string, userId: string, transactionDetails: TransactionDetails): Promise<void>
  async getDiscountUsageStats(discountId: string): Promise<UsageStats>
}
```

### Discount Calculation Engine

```typescript
class DiscountCalculator {
  /**
   * Calculate discount for a single item
   */
  calculateItemDiscount(
    discount: Discount,
    itemPrice: number,
    quantity: number
  ): DiscountResult {
    if (discount.discountType === 'percentage') {
      const discountAmount = (itemPrice * quantity * discount.discountValue) / 100;
      return {
        originalAmount: itemPrice * quantity,
        discountAmount: Math.min(discountAmount, discount.eligibilityCriteria?.maximumDiscountAmount || Infinity),
        finalAmount: (itemPrice * quantity) - discountAmount
      };
    } else {
      // Fixed amount
      const discountAmount = Math.min(discount.discountValue, itemPrice * quantity);
      return {
        originalAmount: itemPrice * quantity,
        discountAmount,
        finalAmount: (itemPrice * quantity) - discountAmount
      };
    }
  }
  
  /**
   * Calculate quantity-based discounts (e.g., buy 2 get 1 free)
   */
  calculateQuantityDiscount(
    discount: Discount,
    itemPrice: number,
    quantity: number
  ): DiscountResult {
    const rules = discount.quantityRules;
    if (!rules) return { originalAmount: itemPrice * quantity, discountAmount: 0, finalAmount: itemPrice * quantity };
    
    if (quantity < rules.minimumQuantity) {
      return { originalAmount: itemPrice * quantity, discountAmount: 0, finalAmount: itemPrice * quantity };
    }
    
    // Calculate free items
    const freeItems = Math.floor(quantity / rules.minimumQuantity) * (rules.applyToQuantity || 1);
    const discountAmount = freeItems * itemPrice;
    
    return {
      originalAmount: itemPrice * quantity,
      discountAmount,
      finalAmount: (itemPrice * quantity) - discountAmount
    };
  }
  
  /**
   * Apply multiple discounts with priority and combination rules
   */
  applyMultipleDiscounts(
    discounts: Discount[],
    itemPrice: number,
    quantity: number
  ): DiscountResult {
    // Sort by priority
    const sortedDiscounts = discounts.sort((a, b) => b.priority - a.priority);
    
    let currentAmount = itemPrice * quantity;
    let totalDiscount = 0;
    
    for (const discount of sortedDiscounts) {
      if (!discount.combinable && totalDiscount > 0) {
        continue; // Skip if not combinable and already have a discount
      }
      
      const result = this.calculateItemDiscount(discount, currentAmount / quantity, quantity);
      totalDiscount += result.discountAmount;
      currentAmount = result.finalAmount;
    }
    
    return {
      originalAmount: itemPrice * quantity,
      discountAmount: totalDiscount,
      finalAmount: currentAmount
    };
  }
}
```

### API Endpoints

```typescript
// Discount Management
GET    /api/orgadmin/organisations/:orgId/discounts
GET    /api/orgadmin/organisations/:orgId/discounts/:moduleType
POST   /api/orgadmin/discounts
GET    /api/orgadmin/discounts/:id
PUT    /api/orgadmin/discounts/:id
DELETE /api/orgadmin/discounts/:id

// Discount Application
POST   /api/orgadmin/discounts/:id/apply
DELETE /api/orgadmin/discounts/:id/apply/:targetType/:targetId
GET    /api/orgadmin/discounts/target/:targetType/:targetId

// Discount Validation & Calculation
POST   /api/orgadmin/discounts/validate
POST   /api/orgadmin/discounts/calculate
POST   /api/orgadmin/discounts/calculate-cart

// Usage & Analytics
GET    /api/orgadmin/discounts/:id/usage
GET    /api/orgadmin/discounts/:id/stats
```

## Implementation Phases

### Phase 1: Core Infrastructure (Foundation)
- Database schema and migrations
- Discount service layer
- Basic CRUD API endpoints
- Discount calculation engine

### Phase 2: Events Module Integration
- Discounts menu in Events module
- Discount list and create/edit pages
- Integration with event creation (Step 1)
- Integration with activity creation (Step 4)
- Event-level and activity-level discount application

### Phase 3: Additional Module Integration
- Memberships module discounts
- Calendar module discounts
- Merchandise module discounts (if exists)
- Registrations module discounts (if exists)

### Phase 4: Advanced Features
- Discount code validation at checkout
- Cart-level discount calculation
- Usage tracking and analytics
- Discount performance reports
- A/B testing for discount effectiveness

### Phase 5: User-Facing Features
- Discount code entry in account user cart
- Automatic discount application based on eligibility
- Discount display in cart summary
- Discount history for users

## Security Considerations

1. **Capability Validation**: Always verify user has appropriate capability before allowing discount operations
2. **Discount Code Security**: Hash discount codes if they're sensitive
3. **Usage Limit Enforcement**: Implement atomic operations to prevent race conditions in usage counting
4. **Amount Validation**: Validate that discounts don't result in negative prices
5. **Audit Trail**: Log all discount creations, modifications, and applications

## Testing Strategy

### Unit Tests
- Discount calculation logic
- Validation rules
- Combination rules
- Quantity-based calculations

### Integration Tests
- Discount application to events/activities
- Multi-discount scenarios
- Usage limit enforcement
- Expiration handling

### Property-Based Tests
- Discount calculations never result in negative amounts
- Combined discounts respect priority order
- Usage limits are never exceeded
- Discount amounts are always <= original amounts

## Future Enhancements

1. **Dynamic Discounts**: Time-based discounts that adjust automatically
2. **Referral Discounts**: Discounts for referring new users
3. **Loyalty Discounts**: Automatic discounts based on user history
4. **Conditional Discounts**: Complex rules based on multiple criteria
5. **Discount Templates**: Pre-configured discount types for common scenarios
6. **Discount Analytics Dashboard**: Visual insights into discount performance
7. **A/B Testing**: Test different discount strategies
8. **Discount Recommendations**: AI-powered discount suggestions

## Conclusion

This comprehensive discount system provides:
- **Flexibility**: Multiple discount types and application scopes
- **Scalability**: Extensible to new modules and discount types
- **Control**: Fine-grained capability-based access
- **Usability**: Consistent UI patterns across modules
- **Power**: Advanced features like quantity-based discounts and combination rules

The phased implementation approach allows for incremental delivery of value while maintaining system stability.
