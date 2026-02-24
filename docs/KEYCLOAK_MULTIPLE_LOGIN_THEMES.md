# Keycloak Multiple Login Themes Configuration

## Overview

The system now supports three different Keycloak login themes, one for each user type:

1. **Super Admin Theme** - For system administrators
2. **Organization Admin Theme** - For organization administrators
3. **Account User Theme** - For regular members/account users

Each theme has customized titles, headings, and descriptions to provide context-appropriate login experiences.

## Theme Locations

```
infrastructure/keycloak/themes/
├── super-admin/          # Super Admin Portal theme
├── org-admin/            # Organization Admin Portal theme
├── account-user/         # Account User Portal theme (ItsPlainSailing)
└── aws-framework/        # Original base theme
```

## Theme Customizations

### 1. Super Admin Theme

**Location**: `infrastructure/keycloak/themes/super-admin/`

**Login Page Content**:
- **Title**: "Super Admin Portal"
- **Heading**: "Super Administrator Login"
- **Description**: "System administrators only. Please enter your credentials to access the Super Admin Portal."

**Target Users**: System administrators who manage the entire platform

**Client**: Should be assigned to the Super Admin client (e.g., `admin-portal`)

---

### 2. Organization Admin Theme

**Location**: `infrastructure/keycloak/themes/org-admin/`

**Login Page Content**:
- **Title**: "Organization Admin Portal"
- **Heading**: "Organization Administrator Login"
- **Description**: "Organization administrators only. Please enter your credentials to manage your organization."

**Target Users**: Organization administrators who manage their specific organization

**Client**: Should be assigned to the Organization Admin client (e.g., `orgadmin-portal`)

---

### 3. Account User Theme

**Location**: `infrastructure/keycloak/themes/account-user/`

**Login Page Content**:
- **Title**: "ItsPlainSailing"
- **Heading**: "Member Login"
- **Description**: "Welcome! Please enter your email and password to access your account."

**Target Users**: Regular members and account users

**Client**: Should be assigned to the Account User client (e.g., `account-user-portal`)

---

## Configuration Steps

### Step 1: Mount Themes in Docker

Ensure your `docker-compose.yml` has the themes directory mounted:

```yaml
services:
  keycloak:
    volumes:
      - ./infrastructure/keycloak/themes:/opt/keycloak/themes
```

### Step 2: Restart Keycloak

```bash
docker-compose restart keycloak
```

### Step 3: Configure Clients in Keycloak Admin Console

For each client, assign the appropriate theme:

#### Super Admin Client Configuration

1. Log in to Keycloak Admin Console
2. Navigate to **Clients** → Find your Super Admin client (e.g., `admin-portal`)
3. Click on the client to open settings
4. Scroll down to **Login settings** section
5. Find **Login theme** dropdown
6. Select `super-admin`
7. Click **Save**

#### Organization Admin Client Configuration

1. Navigate to **Clients** → Find your Org Admin client (e.g., `orgadmin-portal`)
2. Click on the client to open settings
3. Scroll down to **Login settings** section
4. Find **Login theme** dropdown
5. Select `org-admin`
6. Click **Save**

#### Account User Client Configuration

1. Navigate to **Clients** → Find your Account User client (e.g., `account-user-portal`)
2. Click on the client to open settings
3. Scroll down to **Login settings** section
4. Find **Login theme** dropdown
5. Select `account-user`
6. Click **Save**

### Step 4: Test Each Login

Test each login page to verify the correct theme is displayed:

1. **Super Admin**: Navigate to your Super Admin portal and click login
   - Should see "Super Admin Portal" title
   - Should see "Super Administrator Login" heading
   
2. **Org Admin**: Navigate to your Org Admin portal and click login
   - Should see "Organization Admin Portal" title
   - Should see "Organization Administrator Login" heading
   
3. **Account User**: Navigate to your Account User portal and click login
   - Should see "ItsPlainSailing" title
   - Should see "Member Login" heading

---

## Customization Guide

### Changing Text Content

To modify the text on any login page, edit the messages file:

```
infrastructure/keycloak/themes/[theme-name]/login/messages/messages_en.properties
```

Key properties to customize:
- `loginTitle` - Browser tab title
- `loginTitleHtml` - Main page title (HTML)
- `accountLoginHeading` - Login form heading
- `loginDescription` - Description text below heading

### Changing Colors

Each theme uses the same color scheme by default. To customize colors for a specific theme:

Edit: `infrastructure/keycloak/themes/[theme-name]/login/resources/css/neumorphic.css`

```css
:root {
  --primary-main: #009087;    /* Primary color */
  --bg-default: #e8e8e8;      /* Background color */
  --text-primary: #090909;    /* Text color */
}
```

### Adding Different Logos

To use different logos for each theme:

1. Place logo files in each theme's resources:
   ```
   infrastructure/keycloak/themes/super-admin/login/resources/img/logo.png
   infrastructure/keycloak/themes/org-admin/login/resources/img/logo.png
   infrastructure/keycloak/themes/account-user/login/resources/img/logo.png
   ```

2. Recommended size: 200x60px
3. Supported formats: PNG, JPG, SVG

---

## Multi-Language Support

Each theme supports multiple languages. To add translations:

1. Create new message files in the theme's messages directory:
   ```
   messages_de.properties  # German
   messages_fr.properties  # French
   messages_es.properties  # Spanish
   messages_it.properties  # Italian
   ```

2. Copy the content from `messages_en.properties` and translate the values

3. Keycloak will automatically use the appropriate language based on user's browser settings

---

## Troubleshooting

### Theme Not Appearing

1. **Check theme is mounted**: Verify the Docker volume mount is correct
2. **Restart Keycloak**: `docker-compose restart keycloak`
3. **Clear browser cache**: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
4. **Verify client configuration**: Check that the theme is selected in the client settings
5. **Check Keycloak logs**: `docker-compose logs keycloak`

### Wrong Theme Showing

1. **Verify client configuration**: Each client must have its own theme assigned
2. **Check redirect URIs**: Ensure the client's redirect URIs match your application URLs
3. **Clear Keycloak cache**: Restart Keycloak container

### CSS Not Loading

1. **Check file permissions**: Ensure theme files are readable
2. **Verify file paths**: Check that CSS files exist in `resources/css/`
3. **Check browser console**: Look for 404 errors or CSS loading issues

### Text Not Changing

1. **Check messages file**: Verify the properties file has been updated
2. **Restart Keycloak**: Changes to message files require a restart
3. **Clear browser cache**: Old cached pages may show old text
4. **Check language**: Ensure you're editing the correct language file (e.g., `messages_en.properties`)

---

## Architecture Benefits

### User Experience
- **Context-appropriate**: Each user type sees relevant messaging
- **Professional**: Administrators see professional, role-specific content
- **Welcoming**: Account users see friendly, welcoming content

### Security
- **Clear separation**: Users immediately know which portal they're accessing
- **Reduced confusion**: Less likely to enter credentials in wrong portal
- **Audit trail**: Different themes help identify which portal was accessed

### Branding
- **Flexible**: Each portal can have its own branding
- **Consistent**: All themes share the same design system
- **Scalable**: Easy to add more themes for new user types

---

## Future Enhancements

Potential improvements to consider:

1. **Different color schemes**: Use different primary colors for each theme
2. **Custom logos**: Add unique logos for each portal
3. **Additional languages**: Add more language translations
4. **Custom backgrounds**: Use different background images or patterns
5. **Registration pages**: Customize registration pages per theme
6. **Password reset**: Customize password reset pages per theme

---

## Related Documentation

- [Keycloak Custom Theme Guide](./KEYCLOAK_CUSTOM_THEME.md)
- [Keycloak Setup Guide](../infrastructure/keycloak/KEYCLOAK_SETUP.md)
- [System Architecture](./SYSTEM_ARCHITECTURE.md)

---

## Summary

You now have three distinct login themes that provide context-appropriate experiences for:
- System administrators (Super Admin)
- Organization administrators (Org Admin)
- Regular members (Account Users)

Each theme can be independently customized while maintaining a consistent design system across all portals.
