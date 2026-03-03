-- Migration: Create Discounts System tables
-- Description: Adds discounts, discount_applications, and discount_usage tables for comprehensive discount management

-- Create discounts table
CREATE TABLE IF NOT EXISTS discounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL,
  module_type VARCHAR(50) NOT NULL CHECK (module_type IN ('events', 'memberships', 'calendar', 'merchandise', 'registrations')),
  
  -- Basic Information
  name VARCHAR(255) NOT NULL,
  description TEXT,
  code VARCHAR(50),
  
  -- Discount Configuration
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10, 2) NOT NULL CHECK (discount_value > 0),
  
  -- Application Scope
  application_scope VARCHAR(50) NOT NULL CHECK (application_scope IN ('item', 'category', 'cart', 'quantity-based')),
  
  -- Quantity Rules (JSONB)
  -- { minimumQuantity: number, applyToQuantity?: number, applyEveryN?: number }
  quantity_rules JSONB,
  
  -- Eligibility Criteria (JSONB)
  -- { requiresCode: boolean, membershipTypes?: string[], userGroups?: string[], 
  --   minimumPurchaseAmount?: number, maximumDiscountAmount?: number }
  eligibility_criteria JSONB,
  
  -- Validity Period
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  
  -- Usage Limits (JSONB)
  -- { totalUsageLimit?: number, perUserLimit?: number, currentUsageCount: number }
  usage_limits JSONB DEFAULT '{"currentUsageCount": 0}'::jsonb,
  
  -- Combination Rules
  combinable BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  
  -- Constraints
  CONSTRAINT unique_code_per_org UNIQUE (organisation_id, code),
  CONSTRAINT valid_date_range CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_from < valid_until),
  CONSTRAINT valid_percentage CHECK (discount_type != 'percentage' OR (discount_value >= 0 AND discount_value <= 100)),
  CONSTRAINT valid_code_length CHECK (code IS NULL OR (LENGTH(code) >= 3 AND LENGTH(code) <= 50))
);

-- Indexes for discounts table
CREATE INDEX idx_discounts_organisation ON discounts(organisation_id);
CREATE INDEX idx_discounts_module ON discounts(module_type);
CREATE INDEX idx_discounts_code ON discounts(code) WHERE code IS NOT NULL;
CREATE INDEX idx_discounts_status ON discounts(status);
CREATE INDEX idx_discounts_validity ON discounts(valid_from, valid_until);
CREATE INDEX idx_discounts_org_module ON discounts(organisation_id, module_type);

-- Create discount_applications table
CREATE TABLE IF NOT EXISTS discount_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  discount_id UUID NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
  
  -- Polymorphic Target
  target_type VARCHAR(50) NOT NULL,  -- 'event', 'event_activity', 'membership_type', etc.
  target_id UUID NOT NULL,
  
  -- Metadata
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  applied_by UUID,
  
  -- Constraints
  CONSTRAINT unique_discount_target UNIQUE (discount_id, target_type, target_id)
);

-- Indexes for discount_applications table
CREATE INDEX idx_discount_applications_discount ON discount_applications(discount_id);
CREATE INDEX idx_discount_applications_target ON discount_applications(target_type, target_id);

-- Create discount_usage table
CREATE TABLE IF NOT EXISTS discount_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  discount_id UUID NOT NULL REFERENCES discounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Transaction Details
  transaction_type VARCHAR(50) NOT NULL,  -- 'event_entry', 'membership', 'booking', etc.
  transaction_id UUID NOT NULL,
  
  -- Discount Applied
  original_amount DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) NOT NULL,
  final_amount DECIMAL(10, 2) NOT NULL,
  
  -- Metadata
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT valid_amounts CHECK (
    original_amount >= 0 AND 
    discount_amount >= 0 AND 
    final_amount >= 0 AND
    discount_amount <= original_amount AND
    final_amount = original_amount - discount_amount
  )
);

-- Indexes for discount_usage table
CREATE INDEX idx_discount_usage_discount ON discount_usage(discount_id);
CREATE INDEX idx_discount_usage_user ON discount_usage(user_id);
CREATE INDEX idx_discount_usage_transaction ON discount_usage(transaction_type, transaction_id);
CREATE INDEX idx_discount_usage_date ON discount_usage(applied_at);

-- Insert discount capabilities
-- These capabilities control access to discount functionality per module
INSERT INTO capabilities (name, display_name, description, category, is_active)
VALUES
  ('entry-discounts', 'Entry Discounts', 'Manage discounts for event entries', 'additional-feature', true),
  ('membership-discounts', 'Membership Discounts', 'Manage discounts for memberships', 'additional-feature', true),
  ('calendar-discounts', 'Calendar Discounts', 'Manage discounts for calendar bookings', 'additional-feature', true),
  ('merchandise-discounts', 'Merchandise Discounts', 'Manage discounts for merchandise', 'additional-feature', true),
  ('registration-discounts', 'Registration Discounts', 'Manage discounts for registrations', 'additional-feature', true)
ON CONFLICT (name) DO NOTHING;
