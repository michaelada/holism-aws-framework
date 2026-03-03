# Bugfix Requirements Document

## Introduction

This document describes the fix for capability-based visibility of discount features in the org admin UI. Currently, discount-related UI elements (submenu items and form sections) are displayed regardless of whether the organization has the required discount capabilities enabled. This creates confusion for users and exposes functionality that should not be accessible.

The bug affects three main areas:
1. The Discounts submenu item in the Members module navigation
2. The discount selector section in membership type creation/edit pages
3. The discount selector section in event creation/edit pages

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an organisation does not have the 'entry-discounts' capability THEN the system displays the "Discounts" submenu item in the Members module navigation

1.2 WHEN an organisation does not have the 'entry-discounts' capability THEN the system displays the discount selector section in CreateSingleMembershipTypePage

1.3 WHEN an organisation does not have any discount-related capabilities THEN the system displays the discount selector section in CreateEventPage

1.4 WHEN the Layout component filters submenu items THEN the system checks `organisation?.enabledCapabilities` but the check is not applied to the Discounts submenu item

### Expected Behavior (Correct)

2.1 WHEN an organisation does not have the 'entry-discounts' capability THEN the system SHALL hide the "Discounts" submenu item in the Members module navigation

2.2 WHEN an organisation does not have the 'entry-discounts' capability THEN the system SHALL hide the discount selector section in CreateSingleMembershipTypePage

2.3 WHEN an organisation does not have the 'entry-discounts' capability THEN the system SHALL hide the discount selector section in CreateEventPage

2.4 WHEN the Layout component filters submenu items THEN the system SHALL check each submenu item's capability requirement against `organisation?.enabledCapabilities` and hide items where the capability is not present

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an organisation has the 'entry-discounts' capability THEN the system SHALL CONTINUE TO display the "Discounts" submenu item in the Members module navigation

3.2 WHEN an organisation has the 'entry-discounts' capability THEN the system SHALL CONTINUE TO display the discount selector section in CreateSingleMembershipTypePage

3.3 WHEN an organisation has the 'entry-discounts' capability THEN the system SHALL CONTINUE TO display the discount selector section in CreateEventPage

3.4 WHEN the Layout component filters submenu items that have no capability requirement THEN the system SHALL CONTINUE TO display those submenu items for all organisations

3.5 WHEN an organisation has other capabilities enabled THEN the system SHALL CONTINUE TO display the corresponding UI elements for those capabilities without interference from discount capability checks
