# Event Discounts Help

## Overview

The discount system allows you to create flexible pricing incentives for your events. You can offer percentage or fixed-amount discounts with various rules and restrictions.

## Discount Types

### Percentage Discounts
Reduce the price by a percentage (e.g., 20% off).

**Example:** 25% off early bird registration
- Discount Type: Percentage
- Discount Value: 25
- Valid From: 2024-01-01
- Valid Until: 2024-02-15

### Fixed Amount Discounts
Reduce the price by a specific amount (e.g., £10 off).

**Example:** £15 off for members
- Discount Type: Fixed Amount
- Discount Value: 15
- Membership Types: Premium, Standard

## Application Scope

Choose how the discount applies:

### Item Level
Applies to specific event tickets or items.

**Example:** 10% off VIP tickets only

### Category Level
Applies to all items in a category.

**Example:** 15% off all workshop sessions

### Cart Level
Applies to the entire purchase total.

**Example:** £20 off orders over £100
- Application Scope: Cart Level
- Minimum Purchase Amount: 100

### Quantity-Based
Applies based on quantity purchased.

**Example 1 - Buy 2 Get 1 Free:**
- Application Scope: Quantity-Based
- Discount Type: Percentage
- Discount Value: 100 (100% off)
- Minimum Quantity: 3
- Apply to Quantity: 1
- Apply Every N: 3

**Example 2 - Buy 5 Get 10% Off:**
- Application Scope: Quantity-Based
- Discount Type: Percentage
- Discount Value: 10
- Minimum Quantity: 5

**Example 3 - Group Discount (10+ tickets):**
- Application Scope: Quantity-Based
- Discount Type: Percentage
- Discount Value: 15
- Minimum Quantity: 10

## Eligibility Criteria

### Discount Codes
Require users to enter a code to activate the discount.

**Example:** Early bird code "EARLY2024"
- Requires Code: Yes
- Discount Code: EARLY2024

### Membership Types
Restrict to specific membership tiers.

**Example:** Member-only discount
- Membership Types: Premium, Gold, Silver
- Discount Value: 20%

### User Groups
Target specific user segments.

**Example:** Student discount
- User Groups: Students
- Discount Value: 30%

### Minimum Purchase
Require a minimum cart value.

**Example:** Spend £50, save £10
- Minimum Purchase Amount: 50
- Discount Value: 10 (fixed)

### Maximum Discount Cap
Limit the maximum discount amount for percentage discounts.

**Example:** 20% off, max £50 savings
- Discount Type: Percentage
- Discount Value: 20
- Maximum Discount Amount: 50

## Validity & Limits

### Date Range
Set when the discount is active.

**Example:** Summer sale
- Valid From: 2024-06-01
- Valid Until: 2024-08-31

### Usage Limits
Control how many times a discount can be used.

**Total Usage Limit:**
Limit total uses across all users.

**Example:** First 100 customers only
- Total Usage Limit: 100

**Per-User Limit:**
Limit uses per individual user.

**Example:** One use per customer
- Per-User Limit: 1

### Combinability
Allow or prevent stacking with other discounts.

**Example:** Cannot combine with other offers
- Combinable: No

### Priority
Set which discount applies when multiple are available (higher number = higher priority).

**Example:** Member discount takes precedence
- Priority: 10 (member discount)
- Priority: 5 (general discount)

## Common Discount Scenarios

### Scenario 1: Early Bird Special
**Goal:** Encourage early registrations

**Setup:**
- Name: "Early Bird - 30% Off"
- Discount Type: Percentage
- Discount Value: 30
- Valid From: Registration opens
- Valid Until: 30 days before event
- Application Scope: Item Level

### Scenario 2: Member Exclusive
**Goal:** Reward members with special pricing

**Setup:**
- Name: "Member Discount"
- Discount Type: Percentage
- Discount Value: 25
- Membership Types: All member types
- Requires Code: No
- Priority: 10

### Scenario 3: Group Booking Discount
**Goal:** Encourage group registrations

**Setup:**
- Name: "Group Rate - 5+ Tickets"
- Discount Type: Percentage
- Discount Value: 15
- Application Scope: Quantity-Based
- Minimum Quantity: 5

### Scenario 4: Flash Sale
**Goal:** Limited-time promotion

**Setup:**
- Name: "24-Hour Flash Sale"
- Discount Type: Fixed Amount
- Discount Value: 20
- Valid From: 2024-03-15 00:00
- Valid Until: 2024-03-15 23:59
- Total Usage Limit: 50
- Requires Code: Yes
- Code: FLASH24

### Scenario 5: Referral Discount
**Goal:** Reward referrals

**Setup:**
- Name: "Referral Reward"
- Discount Type: Fixed Amount
- Discount Value: 10
- Requires Code: Yes
- Code: REFER10
- Per-User Limit: 1

### Scenario 6: Bundle Deal
**Goal:** Buy multiple items, save more

**Setup:**
- Name: "Buy 3 Get 20% Off"
- Discount Type: Percentage
- Discount Value: 20
- Application Scope: Quantity-Based
- Minimum Quantity: 3

### Scenario 7: Last Minute Discount
**Goal:** Fill remaining seats

**Setup:**
- Name: "Last Minute - 40% Off"
- Discount Type: Percentage
- Discount Value: 40
- Valid From: 7 days before event
- Valid Until: Event start time
- Total Usage Limit: 20

### Scenario 8: Loyalty Reward
**Goal:** Thank repeat customers

**Setup:**
- Name: "Loyal Customer Bonus"
- Discount Type: Fixed Amount
- Discount Value: 25
- User Groups: Loyal Customers
- Per-User Limit: 1
- Combinable: Yes
- Priority: 5

## Tips for Effective Discounts

### 1. Clear Naming
Use descriptive names that explain the offer:
- ✅ "Early Bird - 30% Off (Ends Feb 15)"
- ❌ "Discount 1"

### 2. Set Expiration Dates
Create urgency with time limits:
- Early bird discounts
- Flash sales
- Seasonal promotions

### 3. Use Codes Strategically
- Public codes: Share widely for general promotions
- Private codes: Send to specific groups (email lists, partners)
- Unique codes: Generate individual codes for tracking

### 4. Limit Usage
Prevent abuse and control costs:
- Set total usage limits for budget control
- Set per-user limits to prevent hoarding

### 5. Test Before Publishing
Verify your discount works as expected:
- Check the math (percentage vs. fixed)
- Test eligibility criteria
- Verify date ranges
- Confirm usage limits

### 6. Monitor Performance
Track discount usage:
- How many times used?
- Which discounts are most popular?
- Revenue impact

### 7. Stack Carefully
Decide if discounts can combine:
- Allow stacking for maximum savings
- Prevent stacking to control costs
- Use priority to control which applies

## Troubleshooting

### Discount Not Applying
**Check:**
- Is the discount active (status = Active)?
- Are you within the valid date range?
- Does the user meet eligibility criteria?
- Has the usage limit been reached?
- Is the code entered correctly?

### Wrong Amount Calculated
**Check:**
- Discount type (percentage vs. fixed)
- Application scope (item vs. cart)
- Maximum discount cap
- Quantity rules for quantity-based discounts

### Multiple Discounts Conflict
**Check:**
- Combinability settings
- Priority values
- Eligibility overlap

## Need More Help?

For complex discount scenarios or technical issues, contact your system administrator.
