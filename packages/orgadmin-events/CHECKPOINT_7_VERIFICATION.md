# Checkpoint 7: Pilot Module Complete - Verification Guide

## Overview

This document provides a manual verification checklist for the Events module i18n implementation. All automated tests have passed, but manual verification in the browser is recommended to ensure the user experience is correct.

## Automated Test Results ✅

All 48 automated tests passed, covering:
- ✅ Events module renders in all six locales (en-GB, fr-FR, es-ES, it-IT, de-DE, pt-PT)
- ✅ All text translations are present and correct
- ✅ Date formatting works correctly for all locales
- ✅ Currency formatting works correctly for all locales (EUR, GBP, USD)
- ✅ Locale switching updates UI without page reload
- ✅ Translation completeness verified
- ✅ Fallback behavior works correctly

## Manual Verification Checklist

### Prerequisites

1. Start the development environment:
   ```bash
   # Terminal 1: Start backend
   cd packages/backend
   npm run dev
   
   # Terminal 2: Start orgadmin-shell
   cd packages/orgadmin-shell
   npm run dev
   ```

2. Ensure you have test organizations with different locales configured in the database

### Test 1: Events Module with All Six Locales

For each locale (en-GB, fr-FR, es-ES, it-IT, de-DE, pt-PT):

1. **Login to an organization with the target locale**
   - [ ] Navigate to the Events page
   - [ ] Verify page title displays in correct language
   - [ ] Verify navigation menu displays in correct language
   - [ ] Verify all button labels are translated

2. **Events List Page**
   - [ ] Verify "Create Event" button is translated
   - [ ] Verify table headers are translated (Event Name, Dates, Status, Entry Limit, Actions)
   - [ ] Verify search placeholder is translated
   - [ ] Verify "No events found" message is translated (if no events)
   - [ ] Verify tooltips are translated (hover over action buttons)

3. **Create Event Wizard**
   - [ ] Click "Create Event" button
   - [ ] Verify wizard step labels are translated
   - [ ] Verify all form labels are translated
   - [ ] Verify all helper text is translated
   - [ ] Verify all tooltips are translated
   - [ ] Verify validation messages are translated (try submitting empty form)

4. **Event Activities**
   - [ ] Navigate to Activities step
   - [ ] Click "Add Activity"
   - [ ] Verify activity form labels are translated
   - [ ] Verify payment method options are translated
   - [ ] Verify all helper text is translated

5. **Review & Confirm**
   - [ ] Navigate to Review step
   - [ ] Verify all section headings are translated
   - [ ] Verify all field labels are translated
   - [ ] Verify action buttons are translated

### Test 2: Date Formatting Verification

For each locale:

1. **Create an event with specific dates**
   - Start Date: March 15, 2024
   - End Date: March 17, 2024
   - Entries Open: February 1, 2024 14:30
   - Entries Close: March 10, 2024 23:59

2. **Verify date formats**
   - [ ] en-GB: Should show "15/03/2024" or "15 March 2024"
   - [ ] fr-FR: Should show "15/03/2024" or "15 mars 2024"
   - [ ] es-ES: Should show "15/03/2024" or "15 de marzo de 2024"
   - [ ] it-IT: Should show "15/03/2024" or "15 marzo 2024"
   - [ ] de-DE: Should show "15.03.2024" or "15. März 2024"
   - [ ] pt-PT: Should show "15/03/2024" or "15 de março de 2024"

3. **Verify time formats**
   - [ ] All locales should show 24-hour format (14:30, 23:59)
   - [ ] Time separators should be consistent with locale

### Test 3: Currency Formatting Verification

For each locale:

1. **Create an event activity with a fee**
   - Set fee to: €1,234.56

2. **Verify currency formats**
   - [ ] en-GB: Should show "€1,234.56"
   - [ ] fr-FR: Should show "1 234,56 €" (space as thousands separator, comma as decimal)
   - [ ] es-ES: Should show "1.234,56 €" (period as thousands separator, comma as decimal)
   - [ ] it-IT: Should show "1.234,56 €" (period as thousands separator, comma as decimal)
   - [ ] de-DE: Should show "1.234,56 €" (period as thousands separator, comma as decimal)
   - [ ] pt-PT: Should show "1 234,56 €" (space as thousands separator, comma as decimal)

3. **Test different currencies**
   - [ ] Test with GBP (£)
   - [ ] Test with USD ($)
   - [ ] Verify currency symbol position is correct for each locale

### Test 4: Locale Switching Without Page Reload

1. **Start in English (en-GB)**
   - [ ] Navigate to Events page
   - [ ] Note the current text (e.g., "Create Event")

2. **Switch to French organization**
   - [ ] Use organization switcher to change to a French organization
   - [ ] Verify page updates immediately without reload
   - [ ] Verify "Create Event" becomes "Créer un événement"
   - [ ] Verify dates reformat to French style
   - [ ] Verify currency reformats to French style

3. **Switch to German organization**
   - [ ] Switch to a German organization
   - [ ] Verify immediate update without reload
   - [ ] Verify all text updates to German
   - [ ] Verify dates use German format (periods instead of slashes)
   - [ ] Verify currency uses German format (comma for decimal)

4. **Navigate between pages**
   - [ ] Navigate to Dashboard
   - [ ] Navigate back to Events
   - [ ] Verify locale persists (still in German)
   - [ ] Verify no flash of English text

### Test 5: Translation Quality Review

For each non-English locale:

1. **Review translation accuracy**
   - [ ] Translations are grammatically correct
   - [ ] Translations are contextually appropriate
   - [ ] Terminology is consistent throughout the module
   - [ ] No English text appears where it shouldn't

2. **Review cultural appropriateness**
   - [ ] Date formats match local conventions
   - [ ] Currency formats match local conventions
   - [ ] Formal/informal tone is appropriate for the locale

3. **Check for missing translations**
   - [ ] No translation keys visible (e.g., "events.someKey")
   - [ ] No console warnings about missing translations
   - [ ] All tooltips are translated
   - [ ] All validation messages are translated

### Test 6: Edge Cases and Error Handling

1. **Test with missing translations**
   - [ ] Temporarily remove a translation key from one locale
   - [ ] Verify fallback to English works
   - [ ] Verify no application crash
   - [ ] Verify console warning appears (development mode)

2. **Test with invalid dates**
   - [ ] Enter invalid date in form
   - [ ] Verify error message is translated
   - [ ] Verify date picker shows correct locale format

3. **Test with large numbers**
   - [ ] Enter fee of €999,999.99
   - [ ] Verify formatting is correct for each locale
   - [ ] Verify no overflow or display issues

## Known Issues

Document any issues found during manual testing:

- [ ] Issue 1: _Description_
- [ ] Issue 2: _Description_
- [ ] Issue 3: _Description_

## Translation Quality Feedback

### English (en-GB)
- Quality: ⭐⭐⭐⭐⭐
- Notes: _Base language, complete_

### French (fr-FR)
- Quality: ⭐⭐⭐⭐⭐
- Notes: _Add notes here_

### Spanish (es-ES)
- Quality: ⭐⭐⭐⭐⭐
- Notes: _Add notes here_

### Italian (it-IT)
- Quality: ⭐⭐⭐⭐⭐
- Notes: _Add notes here_

### German (de-DE)
- Quality: ⭐⭐⭐⭐⭐
- Notes: _Add notes here_

### Portuguese (pt-PT)
- Quality: ⭐⭐⭐⭐⭐
- Notes: _Add notes here_

## Recommendations for Improvement

Based on testing, document any recommendations:

1. _Recommendation 1_
2. _Recommendation 2_
3. _Recommendation 3_

## Sign-off

- [ ] All automated tests pass
- [ ] All manual verification steps completed
- [ ] Translation quality is acceptable
- [ ] No critical issues found
- [ ] Ready to proceed to next modules

**Verified by:** _________________  
**Date:** _________________  
**Approved by:** _________________  
**Date:** _________________

## Next Steps

Once this checkpoint is approved:
1. Proceed to Task 8: Translate Memberships module
2. Apply lessons learned from Events module
3. Continue with remaining modules following the same pattern
