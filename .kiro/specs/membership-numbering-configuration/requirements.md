# Membership Numbering Configuration - Requirements

## Overview

This feature adds configurable membership numbering rules at the Organization Type level, allowing Super Admins to control how membership numbers are generated and managed across organizations.

## Business Requirements

### 1. Membership Numbering Modes

**Requirement 1.1: Support Two Numbering Modes**
- The system shall support two membership numbering modes:
  - **Internal**: System automatically generates membership numbers
  - **External**: Members bring existing membership numbers from external systems

**Requirement 1.2: Mode Configuration**
- Super Admins shall configure the numbering mode at the Organization Type level
- The mode applies to all organizations of that type
- The mode cannot be changed by Org Admins

### 2. Internal Numbering Configuration

**Requirement 2.1: Membership Number Uniqueness**
- When numbering mode is "Internal", Super Admins shall specify uniqueness scope:
  - **Organization Type Level**: Numbers unique across all organizations in the type
  - **Organization Level**: Numbers unique only within each organization

**Requirement 2.2: Initial Membership Number**
- When numbering mode is "Internal", Super Admins shall set the starting number
- Default value: 1000000
- Must be a positive integer
- Subsequent members receive sequential numbers (e.g., 1000000, 1000001, 1000002...)

**Requirement 2.3: Sequential Number Generation**
- System shall generate the next available number in sequence
- Numbers shall never be reused
- Number generation shall be atomic to prevent duplicates

### 3. External Numbering Behavior

**Requirement 3.1: Manual Number Entry**
- When numbering mode is "External", Org Admins shall manually enter membership numbers
- The membership number field shall be required in the Add Member form
- System shall validate uniqueness according to the configured scope

**Requirement 3.2: Number Validation**
- System shall validate that external numbers are unique within the configured scope
- System shall reject duplicate numbers with clear error messages

### 4. Organization Type Configuration (Super Admin)

**Requirement 4.1: Configuration Fields**
- Super Admins shall configure the following fields in Organization Type:
  - **Membership Numbering** (required): "Internal" or "External"
  - **Membership Number Uniqueness** (conditional): Shown only when "Internal"
    - Options: "Organization Type" or "Organization"
  - **Initial Membership Number** (conditional): Shown only when "Internal"
    - Default: 1000000
    - Validation: Must be positive integer

**Requirement 4.2: Conditional Field Display**
- "Membership Number Uniqueness" shall only display when "Internal" is selected
- "Initial Membership Number" shall only display when "Internal" is selected
- Fields shall hide/show dynamically as the user changes "Membership Numbering"

### 5. Add Member Behavior (Org Admin)

**Requirement 5.1: Internal Mode Behavior**
- When Organization Type uses "Internal" numbering:
  - Membership number field shall NOT appear in Add Member form
  - System shall automatically generate the next number on member creation
  - Generated number shall be displayed after successful creation

**Requirement 5.2: External Mode Behavior**
- When Organization Type uses "External" numbering:
  - Membership number field shall appear in Add Member form
  - Field shall be required
  - System shall validate uniqueness before saving
  - Clear error message if number already exists

### 6. Data Migration

**Requirement 6.1: Existing Organization Types**
- Existing organization types shall default to:
  - Membership Numbering: "Internal"
  - Membership Number Uniqueness: "Organization"
  - Initial Membership Number: 1000000

**Requirement 6.2: Existing Members**
- Existing member records shall remain unchanged
- New numbering rules apply only to newly created members

## User Stories

### Story 1: Super Admin Configures Internal Numbering
**As a** Super Admin  
**I want to** configure organization types to use internal membership numbering  
**So that** the system automatically generates unique membership numbers

**Acceptance Criteria:**
- I can select "Internal" for Membership Numbering
- I can choose uniqueness scope (Organization Type or Organization level)
- I can set the initial membership number (default 1000000)
- Changes are saved and applied to all organizations of that type

### Story 2: Super Admin Configures External Numbering
**As a** Super Admin  
**I want to** configure organization types to use external membership numbering  
**So that** members can bring their existing membership numbers into the system

**Acceptance Criteria:**
- I can select "External" for Membership Numbering
- Uniqueness and Initial Number fields are hidden
- Changes are saved and applied to all organizations of that type

### Story 3: Org Admin Adds Member with Internal Numbering
**As an** Org Admin  
**I want to** add a new member without specifying a membership number  
**So that** the system automatically assigns the next available number

**Acceptance Criteria:**
- Membership number field does not appear in the form
- System generates the next sequential number
- Number follows the configured uniqueness scope
- Generated number is displayed after creation

### Story 4: Org Admin Adds Member with External Numbering
**As an** Org Admin  
**I want to** add a new member with their existing membership number  
**So that** we maintain continuity with external systems

**Acceptance Criteria:**
- Membership number field appears in the form
- Field is required
- System validates uniqueness
- Clear error if number already exists
- Member is created with the provided number

## Functional Requirements

### FR1: Database Schema
- Add columns to `organization_types` table:
  - `membership_numbering`: varchar(20), values: 'internal' or 'external'
  - `membership_number_uniqueness`: varchar(20), values: 'organization_type' or 'organization'
  - `initial_membership_number`: integer, default 1000000

### FR2: API Endpoints
- Update Organization Type creation/update endpoints to accept new fields
- Update Member creation endpoint to handle both modes
- Add validation for membership number uniqueness

### FR3: UI Components
- Update Super Admin Organization Type form with conditional fields
- Update Org Admin Add Member form with conditional membership number field
- Add appropriate validation and error messages

### FR4: Business Logic
- Implement sequential number generation for internal mode
- Implement uniqueness validation for both modes
- Handle concurrent member creation without number collisions

## Non-Functional Requirements

### NFR1: Performance
- Number generation shall complete within 500ms
- Uniqueness validation shall complete within 200ms

### NFR2: Reliability
- Number generation shall be atomic and thread-safe
- No duplicate numbers shall be generated under concurrent load

### NFR3: Usability
- Conditional fields shall show/hide smoothly without page reload
- Error messages shall clearly indicate the issue and resolution

### NFR4: Backward Compatibility
- Existing members shall retain their current membership numbers
- Existing functionality shall continue to work during migration

## Out of Scope

- Bulk import of members with external numbers
- Changing numbering mode after members exist
- Custom number formats (e.g., prefixes, suffixes)
- Number gaps or reserved ranges
- Editing membership numbers after creation

## Success Criteria

1. Super Admins can configure all three numbering fields for organization types
2. Conditional fields show/hide correctly based on numbering mode
3. Internal mode generates sequential numbers without duplicates
4. External mode requires manual entry and validates uniqueness
5. All existing functionality continues to work
6. No data loss during migration
7. Clear error messages for all validation failures
