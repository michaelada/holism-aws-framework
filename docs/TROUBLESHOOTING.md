# ItsPlainSailing OrgAdmin - Troubleshooting Guide

## Overview

This guide provides solutions to common issues you may encounter while using ItsPlainSailing OrgAdmin. Issues are organized by category for easy reference.

## Table of Contents

1. [Authentication Issues](#authentication-issues)
2. [Module Access Issues](#module-access-issues)
3. [Form and Data Entry Issues](#form-and-data-entry-issues)
4. [Payment Issues](#payment-issues)
5. [File Upload Issues](#file-upload-issues)
6. [Export and Reporting Issues](#export-and-reporting-issues)
7. [Performance Issues](#performance-issues)
8. [Email and Notification Issues](#email-and-notification-issues)
9. [Browser and Compatibility Issues](#browser-and-compatibility-issues)
10. [Error Messages](#error-messages)

---

## Authentication Issues

### Cannot Log In

**Symptoms**:
- Login page doesn't load
- Credentials rejected
- Stuck on login page

**Possible Causes**:
- Incorrect username or password
- Account not activated
- Missing org-admin role
- Keycloak server issues
- Browser cache issues

**Solutions**:

1. **Verify Credentials**
   ```
   - Check username (usually email address)
   - Verify password (case-sensitive)
   - Try password reset if unsure
   ```

2. **Check Account Status**
   ```
   - Verify account is activated
   - Check with system administrator
   - Confirm org-admin role is assigned
   ```

3. **Clear Browser Cache**
   ```
   Chrome: Ctrl+Shift+Delete → Clear browsing data
   Firefox: Ctrl+Shift+Delete → Clear recent history
   Safari: Cmd+Option+E → Empty caches
   ```

4. **Try Different Browser**
   ```
   - Test with Chrome, Firefox, or Edge
   - Use incognito/private mode
   ```

5. **Check Keycloak Status**
   ```
   - Verify Keycloak server is running
   - Check system status page
   - Contact system administrator
   ```

### Session Expired

**Symptoms**:
- Logged out unexpectedly
- "Session expired" message
- Redirected to login page

**Possible Causes**:
- Inactivity timeout (30 minutes default)
- Session token expired
- Server restart

**Solutions**:

1. **Log In Again**
   ```
   - Click "Sign In" button
   - Enter credentials
   - Resume work
   ```

2. **Adjust Session Settings** (Admin Only)
   ```
   - Keycloak Admin Console
   - Realm Settings → Tokens
   - Increase SSO Session Idle timeout
   ```

3. **Save Work Frequently**
   ```
   - Use Ctrl+S to save
   - Save before long breaks
   - Enable auto-save if available
   ```

### Redirect Loop

**Symptoms**:
- Continuously redirected between pages
- Cannot access application
- Browser shows "Too many redirects"

**Possible Causes**:
- Cookie issues
- Keycloak configuration error
- Proxy/CDN issues

**Solutions**:

1. **Clear Cookies**
   ```
   Chrome: Settings → Privacy → Clear browsing data → Cookies
   Firefox: Options → Privacy → Clear Data → Cookies
   ```

2. **Check Keycloak Configuration** (Admin Only)
   ```
   - Verify Valid Redirect URIs
   - Check Web Origins
   - Verify Base URL
   ```

3. **Disable Browser Extensions**
   ```
   - Temporarily disable ad blockers
   - Disable privacy extensions
   - Test in incognito mode
   ```

---

## Module Access Issues

### Module Not Visible

**Symptoms**:
- Expected module missing from dashboard
- Module card not displayed
- Cannot access module URL

**Possible Causes**:
- Capability not enabled
- Insufficient permissions
- Module not loaded
- Browser cache

**Solutions**:

1. **Check Capabilities** (Admin Only)
   ```
   - Settings → Organization Details
   - Verify required capability is enabled
   - Contact super admin to enable capability
   ```

2. **Verify Permissions**
   ```
   - Check your assigned roles
   - Verify org-admin role
   - Contact administrator for role assignment
   ```

3. **Refresh Page**
   ```
   - Press F5 or Ctrl+R
   - Hard refresh: Ctrl+Shift+R
   - Clear cache and refresh
   ```

4. **Log Out and Back In**
   ```
   - Click user menu → Logout
   - Log in again
   - Check if module appears
   ```

### Module Loads Slowly

**Symptoms**:
- Long wait time when opening module
- Spinning loader for extended period
- Module eventually loads

**Possible Causes**:
- Large dataset
- Slow network connection
- Server performance issues
- Browser performance

**Solutions**:

1. **Check Network Connection**
   ```
   - Test internet speed
   - Switch to wired connection if possible
   - Close bandwidth-heavy applications
   ```

2. **Use Filters**
   ```
   - Apply date range filters
   - Limit results per page
   - Use search to narrow results
   ```

3. **Clear Browser Cache**
   ```
   - Clear cached data
   - Restart browser
   - Try again
   ```

4. **Contact Support**
   ```
   - Report slow module
   - Provide module name and data size
   - Request performance optimization
   ```

---

## Form and Data Entry Issues

### Form Won't Save

**Symptoms**:
- Save button doesn't work
- Changes not persisted
- Error message on save

**Possible Causes**:
- Validation errors
- Required fields missing
- Network issues
- Server error

**Solutions**:

1. **Check for Validation Errors**
   ```
   - Look for red text or error messages
   - Scroll through entire form
   - Fix all highlighted fields
   ```

2. **Verify Required Fields**
   ```
   - Check for asterisks (*) indicating required fields
   - Fill in all required information
   - Ensure correct data format
   ```

3. **Check Network Connection**
   ```
   - Verify internet is connected
   - Test with other websites
   - Try saving again
   ```

4. **Copy Your Work**
   ```
   - Select all text: Ctrl+A
   - Copy: Ctrl+C
   - Refresh page
   - Paste: Ctrl+V
   - Try saving again
   ```

### Data Not Appearing

**Symptoms**:
- Saved data doesn't show in list
- Changes not visible
- Empty tables or lists

**Possible Causes**:
- Filters applied
- Wrong date range
- Data not yet synced
- Browser cache

**Solutions**:

1. **Check Filters**
   ```
   - Look for active filters
   - Click "Clear Filters" or "Reset"
   - Expand date range
   ```

2. **Refresh Page**
   ```
   - Press F5
   - Wait a few seconds
   - Check if data appears
   ```

3. **Verify Data Was Saved**
   ```
   - Check for save confirmation message
   - Look in different views/tabs
   - Search for specific record
   ```

4. **Clear Cache**
   ```
   - Clear browser cache
   - Hard refresh: Ctrl+Shift+R
   - Check again
   ```

### Cannot Edit Record

**Symptoms**:
- Edit button disabled
- Fields are read-only
- Changes not allowed

**Possible Causes**:
- Insufficient permissions
- Record locked
- Status prevents editing
- System constraint

**Solutions**:

1. **Check Permissions**
   ```
   - Verify you have edit permission
   - Check your role assignments
   - Contact administrator
   ```

2. **Check Record Status**
   ```
   - Some statuses prevent editing
   - Check if record is archived
   - Verify record is not deleted
   ```

3. **Try Different Action**
   ```
   - Use "Duplicate" to create copy
   - Create new record with same data
   - Contact support for assistance
   ```

---

## Payment Issues

### Payment Not Processing

**Symptoms**:
- Payment fails
- Error during checkout
- Card declined

**Possible Causes**:
- Stripe not configured
- Invalid card details
- Insufficient funds
- Payment method not enabled
- Network issues

**Solutions**:

1. **Verify Stripe Configuration** (Admin Only)
   ```
   - Settings → Payment Settings
   - Check Stripe API keys
   - Verify test/live mode
   - Test with Stripe test cards
   ```

2. **Check Card Details**
   ```
   - Verify card number
   - Check expiration date
   - Verify CVV code
   - Ensure billing address is correct
   ```

3. **Try Different Payment Method**
   ```
   - Use different card
   - Try offline payment if available
   - Contact bank if card repeatedly declined
   ```

4. **Check Payment Method Settings**
   ```
   - Verify payment method is enabled
   - Check supported payment methods
   - Enable additional payment methods if needed
   ```

### Refund Not Processing

**Symptoms**:
- Refund button doesn't work
- Refund fails
- Error message

**Possible Causes**:
- Payment not yet settled
- Refund already processed
- Stripe configuration issue
- Insufficient permissions

**Solutions**:

1. **Check Payment Status**
   ```
   - Verify payment is "Paid"
   - Check if already refunded
   - Wait 24 hours for settlement
   ```

2. **Verify Permissions**
   ```
   - Check if you have refund permission
   - Contact administrator
   - Use admin account
   ```

3. **Check Stripe Dashboard**
   ```
   - Log into Stripe dashboard
   - Check payment status
   - Process refund directly in Stripe
   ```

4. **Contact Support**
   ```
   - Provide payment ID
   - Describe error message
   - Request manual refund
   ```

---

## File Upload Issues

### Cannot Upload File

**Symptoms**:
- Upload button doesn't work
- File not uploading
- Error message during upload

**Possible Causes**:
- File too large
- Invalid file type
- Network issues
- S3 configuration issue
- Browser limitations

**Solutions**:

1. **Check File Size**
   ```
   - Maximum size: 10MB (typically)
   - Compress large files
   - Split into multiple files
   ```

2. **Verify File Type**
   ```
   - Allowed types: PDF, JPG, PNG, DOC, DOCX
   - Check file extension
   - Convert to allowed format
   ```

3. **Check Network Connection**
   ```
   - Verify stable internet
   - Try wired connection
   - Upload during off-peak hours
   ```

4. **Try Different Browser**
   ```
   - Test with Chrome
   - Try Firefox or Edge
   - Update browser to latest version
   ```

5. **Check S3 Configuration** (Admin Only)
   ```
   - Verify S3 bucket exists
   - Check IAM permissions
   - Test S3 connectivity
   ```

### Uploaded File Not Visible

**Symptoms**:
- File uploaded successfully
- Cannot see or download file
- Broken file link

**Possible Causes**:
- S3 permissions issue
- File not yet synced
- Browser cache
- Incorrect file path

**Solutions**:

1. **Refresh Page**
   ```
   - Press F5
   - Wait a few seconds
   - Check if file appears
   ```

2. **Check S3 Permissions** (Admin Only)
   ```
   - Verify bucket policy
   - Check IAM role permissions
   - Test file access directly
   ```

3. **Re-upload File**
   ```
   - Delete existing upload
   - Upload file again
   - Verify upload confirmation
   ```

---

## Export and Reporting Issues

### Excel Export Not Working

**Symptoms**:
- Export button doesn't work
- No file downloaded
- Empty Excel file

**Possible Causes**:
- No data to export
- Browser pop-up blocker
- Network issues
- Server timeout

**Solutions**:

1. **Check for Data**
   ```
   - Verify data exists in table
   - Check applied filters
   - Expand date range
   ```

2. **Disable Pop-up Blocker**
   ```
   - Allow pop-ups for this site
   - Check browser settings
   - Try again
   ```

3. **Try Smaller Export**
   ```
   - Apply date range filter
   - Export in batches
   - Limit number of records
   ```

4. **Try Different Browser**
   ```
   - Test with Chrome
   - Try Firefox or Edge
   - Clear browser cache
   ```

### Report Not Generating

**Symptoms**:
- Report shows no data
- Error generating report
- Report takes too long

**Possible Causes**:
- No data in date range
- Invalid filters
- Server timeout
- Large dataset

**Solutions**:

1. **Check Date Range**
   ```
   - Verify dates are correct
   - Expand date range
   - Check data exists for period
   ```

2. **Clear Filters**
   ```
   - Remove all filters
   - Try again
   - Add filters one at a time
   ```

3. **Reduce Date Range**
   ```
   - Try shorter period
   - Generate monthly reports
   - Combine reports manually
   ```

4. **Contact Support**
   ```
   - Report issue
   - Provide date range and filters
   - Request manual report generation
   ```

---

## Performance Issues

### Slow Page Load

**Symptoms**:
- Pages take long to load
- Spinning loader
- Timeout errors

**Possible Causes**:
- Slow network connection
- Large dataset
- Server performance
- Browser issues

**Solutions**:

1. **Check Network Speed**
   ```
   - Test internet speed
   - Use wired connection
   - Close other applications
   ```

2. **Clear Browser Cache**
   ```
   - Clear cached data
   - Clear cookies
   - Restart browser
   ```

3. **Use Filters**
   ```
   - Apply date range
   - Limit results per page
   - Use search function
   ```

4. **Try Different Time**
   ```
   - Access during off-peak hours
   - Avoid peak usage times
   - Schedule large operations
   ```

### Browser Freezing

**Symptoms**:
- Browser becomes unresponsive
- Cannot click buttons
- Must force close browser

**Possible Causes**:
- Too many tabs open
- Memory issues
- Large dataset
- Browser extension conflict

**Solutions**:

1. **Close Unnecessary Tabs**
   ```
   - Keep only essential tabs
   - Restart browser
   - Try again
   ```

2. **Disable Extensions**
   ```
   - Disable ad blockers
   - Disable privacy extensions
   - Test in incognito mode
   ```

3. **Increase Browser Memory**
   ```
   - Close other applications
   - Restart computer
   - Use 64-bit browser
   ```

4. **Use Different Browser**
   ```
   - Try Chrome
   - Try Firefox
   - Update to latest version
   ```

---

## Email and Notification Issues

### Not Receiving Emails

**Symptoms**:
- Confirmation emails not arriving
- Notification emails missing
- No email received

**Possible Causes**:
- Spam filter
- Incorrect email address
- Email server issues
- Email settings

**Solutions**:

1. **Check Spam Folder**
   ```
   - Look in spam/junk folder
   - Mark as "Not Spam"
   - Add sender to contacts
   ```

2. **Verify Email Address**
   ```
   - Check email in profile
   - Update if incorrect
   - Verify no typos
   ```

3. **Add to Safe Senders**
   ```
   - Add noreply@itsplainsailing.com
   - Add support@itsplainsailing.com
   - Whitelist domain
   ```

4. **Check Email Settings** (Admin Only)
   ```
   - Settings → Email Templates
   - Verify SMTP configuration
   - Test email sending
   ```

5. **Wait and Retry**
   ```
   - Emails can be delayed
   - Wait 10-15 minutes
   - Request resend if needed
   ```

### Email Contains Wrong Information

**Symptoms**:
- Email has incorrect data
- Wrong organization name
- Broken links

**Possible Causes**:
- Email template not updated
- Variable not replaced
- Configuration error

**Solutions**:

1. **Update Email Templates** (Admin Only)
   ```
   - Settings → Email Templates
   - Review template content
   - Update variables
   - Test email
   ```

2. **Update Organization Settings**
   ```
   - Settings → Organization Details
   - Verify all information
   - Save changes
   ```

3. **Contact Support**
   ```
   - Report incorrect email
   - Provide example
   - Request template fix
   ```

---

## Browser and Compatibility Issues

### Layout Issues

**Symptoms**:
- Page looks broken
- Elements overlapping
- Text cut off

**Possible Causes**:
- Browser zoom level
- Outdated browser
- CSS not loading
- Browser compatibility

**Solutions**:

1. **Reset Zoom Level**
   ```
   - Press Ctrl+0 (zero)
   - Or Cmd+0 on Mac
   - Verify 100% zoom
   ```

2. **Update Browser**
   ```
   - Check for updates
   - Install latest version
   - Restart browser
   ```

3. **Clear Cache**
   ```
   - Clear browser cache
   - Hard refresh: Ctrl+Shift+R
   - Restart browser
   ```

4. **Try Different Browser**
   ```
   - Chrome 90+
   - Firefox 88+
   - Safari 14+
   - Edge 90+
   ```

### Mobile Issues

**Symptoms**:
- Hard to use on mobile
- Buttons too small
- Text too small

**Possible Causes**:
- Small screen size
- Mobile browser limitations
- Touch target size

**Solutions**:

1. **Use Tablet or Desktop**
   ```
   - Some features work better on larger screens
   - Use desktop for complex tasks
   - Use mobile for viewing only
   ```

2. **Rotate Device**
   ```
   - Use landscape mode
   - Provides more screen space
   - Easier to navigate
   ```

3. **Zoom In**
   ```
   - Pinch to zoom
   - Double-tap to zoom
   - Adjust text size in settings
   ```

---

## Error Messages

### "Access Denied"

**Meaning**: You don't have permission to access this resource

**Solutions**:
- Verify you have org-admin role
- Check if capability is enabled
- Contact administrator for access
- Log out and log back in

### "Session Expired"

**Meaning**: Your login session has timed out

**Solutions**:
- Log in again
- Save work more frequently
- Adjust session timeout (admin only)

### "Network Error"

**Meaning**: Cannot connect to server

**Solutions**:
- Check internet connection
- Verify server is running
- Try again in a few minutes
- Contact support if persists

### "Validation Error"

**Meaning**: Form data is invalid

**Solutions**:
- Check for red error messages
- Fix highlighted fields
- Verify required fields are filled
- Check data format (email, date, etc.)

### "Server Error"

**Meaning**: Something went wrong on the server

**Solutions**:
- Try again in a few minutes
- Refresh the page
- Clear browser cache
- Contact support with error details

### "Not Found"

**Meaning**: The requested resource doesn't exist

**Solutions**:
- Check URL is correct
- Verify record wasn't deleted
- Use search to find record
- Contact support if issue persists

---

## Getting Additional Help

### Before Contacting Support

1. **Try the solutions above**
2. **Check the User Guide**
3. **Search documentation**
4. **Ask a colleague**

### When Contacting Support

Provide:
1. **What you were trying to do**
2. **What happened instead**
3. **Error messages** (exact text or screenshot)
4. **Steps to reproduce**
5. **Browser and version**
6. **Operating system**
7. **Screenshots** (if helpful)

### Support Channels

- **Email**: support@itsplainsailing.com
- **Help Desk**: https://support.itsplainsailing.com
- **Phone**: Available during business hours
- **Documentation**: https://docs.itsplainsailing.com

---

## Preventive Measures

### Regular Maintenance

- Clear browser cache weekly
- Update browser regularly
- Save work frequently
- Export data for backup
- Review error logs

### Best Practices

- Use supported browsers
- Maintain stable internet connection
- Don't open too many tabs
- Log out when finished
- Report issues promptly

### Training

- Review user guide
- Attend training sessions
- Practice with test data
- Ask questions
- Share knowledge with team

---

## Appendix: Browser Console

For advanced troubleshooting, check the browser console:

### Opening Console

- **Chrome**: F12 or Ctrl+Shift+J
- **Firefox**: F12 or Ctrl+Shift+K
- **Safari**: Cmd+Option+C
- **Edge**: F12 or Ctrl+Shift+I

### What to Look For

- Red error messages
- Network errors (failed requests)
- JavaScript errors
- Console warnings

### Sharing Console Errors

1. Open console
2. Take screenshot of errors
3. Copy error text
4. Send to support

---

This troubleshooting guide is regularly updated. If you encounter an issue not covered here, please contact support so we can add it to help others.
