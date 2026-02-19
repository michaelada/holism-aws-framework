# Keycloak Custom Theme - AWS Framework

This guide explains how to create, deploy, and customize the AWS Framework Keycloak theme that matches the orgadmin UI design system.

## Overview

The custom theme uses a neumorphic design system with the following characteristics:
- **Primary Color**: #009087 (teal)
- **Background**: #e8e8e8 (light gray)
- **Neumorphic Shadows**: Soft 3D effect using dual shadows
- **Typography**: Roboto font family
- **Smooth Animations**: Button hover effects with wave animations

## Theme Structure

```
infrastructure/keycloak/themes/aws-framework/
├── login/
│   ├── theme.properties          # Theme configuration
│   ├── resources/
│   │   ├── css/
│   │   │   └── neumorphic.css   # Custom styles
│   │   └── img/
│   │       └── logo.png          # Optional custom logo
│   └── messages/
│       ├── messages_en.properties # English translations
│       └── messages_de.properties # German translations (optional)
├── account/                       # Account management theme (optional)
└── email/                         # Email templates (optional)
```

## Installation Methods

### Method 1: Docker Volume Mount (Development)

This is the easiest method for local development.

#### Step 1: Update docker-compose.yml

Add a volume mount to your Keycloak service:

```yaml
services:
  keycloak:
    image: quay.io/keycloak/keycloak:latest
    environment:
      # ... existing environment variables
    volumes:
      - ./infrastructure/keycloak/themes:/opt/keycloak/themes
    ports:
      - "8080:8080"
```

#### Step 2: Restart Keycloak

```bash
docker-compose down
docker-compose up -d keycloak
```

#### Step 3: Enable the Theme

1. Go to Keycloak Admin Console: http://localhost:8080
2. Login as admin
3. Select your realm (`aws-framework`)
4. Go to **Realm Settings** → **Themes** tab
5. Set **Login Theme** to `aws-framework`
6. Click **Save**

### Method 2: Build Custom Docker Image (Production)

For production deployments, build a custom Keycloak image with the theme included.

#### Step 1: Create Dockerfile

Create `infrastructure/keycloak/Dockerfile`:

```dockerfile
FROM quay.io/keycloak/keycloak:latest

# Copy custom theme
COPY themes/aws-framework /opt/keycloak/themes/aws-framework

# Set production mode
ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=true

# Build Keycloak
RUN /opt/keycloak/bin/kc.sh build

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
```

#### Step 2: Build the Image

```bash
cd infrastructure/keycloak
docker build -t aws-framework-keycloak:latest .
```

#### Step 3: Update docker-compose.yml

```yaml
services:
  keycloak:
    image: aws-framework-keycloak:latest
    # ... rest of configuration
```

#### Step 4: Deploy

```bash
docker-compose up -d keycloak
```

### Method 3: Manual Installation

If you're running Keycloak outside Docker:

#### Step 1: Copy Theme Files

```bash
# Copy theme to Keycloak themes directory
cp -r infrastructure/keycloak/themes/aws-framework /opt/keycloak/themes/
```

#### Step 2: Restart Keycloak

```bash
# Systemd
sudo systemctl restart keycloak

# Or standalone
/opt/keycloak/bin/kc.sh start
```

## Customization

### Adding a Custom Logo

#### Step 1: Add Logo File

Place your logo in:
```
infrastructure/keycloak/themes/aws-framework/login/resources/img/logo.png
```

Recommended size: 200x60px (or maintain aspect ratio)

#### Step 2: Create Custom Login Template

Create `infrastructure/keycloak/themes/aws-framework/login/template.ftl`:

```html
<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="robots" content="noindex, nofollow">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    
    <title>${msg("loginTitle",(realm.displayName!''))}</title>
    
    <#if properties.meta?has_content>
        <#list properties.meta?split(' ') as meta>
            <meta name="${meta?split('==')[0]}" content="${meta?split('==')[1]}"/>
        </#list>
    </#if>
    
    <link rel="icon" href="${url.resourcesPath}/img/favicon.ico" />
    
    <#if properties.stylesCommon?has_content>
        <#list properties.stylesCommon?split(' ') as style>
            <link href="${url.resourcesCommonPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
</head>

<body class="${properties.kcBodyClass!}">
    <div class="${properties.kcLoginClass!}">
        <div id="kc-header" class="${properties.kcHeaderClass!}">
            <div id="kc-header-wrapper" class="${properties.kcHeaderWrapperClass!}">
                <!-- Custom Logo -->
                <div style="text-align: center; margin-bottom: 2em;">
                    <img src="${url.resourcesPath}/img/logo.png" alt="AWS Framework" style="max-width: 200px; height: auto;" />
                </div>
                ${kcSanitize(msg("loginTitleHtml",(realm.displayNameHtml!'')))?no_esc}
            </div>
        </div>
        
        <div class="${properties.kcFormCardClass!}">
            <div id="kc-content">
                <div id="kc-content-wrapper">
                    <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                        <div class="alert alert-${message.type}">
                            <#if message.type = 'success'><span class="${properties.kcFeedbackSuccessIcon!}"></span></#if>
                            <#if message.type = 'warning'><span class="${properties.kcFeedbackWarningIcon!}"></span></#if>
                            <#if message.type = 'error'><span class="${properties.kcFeedbackErrorIcon!}"></span></#if>
                            <#if message.type = 'info'><span class="${properties.kcFeedbackInfoIcon!}"></span></#if>
                            <span class="kc-feedback-text">${kcSanitize(message.summary)?no_esc}</span>
                        </div>
                    </#if>
                    
                    <#nested "form">
                    
                    <#if displayInfo>
                        <div id="kc-info" class="${properties.kcSignUpClass!}">
                            <div id="kc-info-wrapper" class="${properties.kcInfoAreaWrapperClass!}">
                                <#nested "info">
                            </div>
                        </div>
                    </#if>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
</#macro>
```

### Customizing Colors

Edit `infrastructure/keycloak/themes/aws-framework/login/resources/css/neumorphic.css`:

```css
:root {
  /* Change primary color */
  --primary-main: #YOUR_COLOR;
  --primary-light: #YOUR_LIGHT_COLOR;
  --primary-dark: #YOUR_DARK_COLOR;
  
  /* Change background */
  --bg-default: #YOUR_BG_COLOR;
  
  /* Change text colors */
  --text-primary: #YOUR_TEXT_COLOR;
}
```

### Adding Custom Messages

Create `infrastructure/keycloak/themes/aws-framework/login/messages/messages_en.properties`:

```properties
# Custom login title
loginTitle=AWS Framework Login
loginTitleHtml=<h1>Welcome to AWS Framework</h1>

# Custom button text
doLogIn=Sign In
doRegister=Create Account

# Custom labels
username=Email or Username
password=Password
rememberMe=Keep me signed in

# Custom error messages
invalidUserMessage=Invalid email or password
accountDisabledMessage=Your account has been disabled. Please contact support.

# Custom info messages
loginTotpIntro=Please enter your authentication code
```

### Customizing Email Templates

Create email templates in `infrastructure/keycloak/themes/aws-framework/email/`:

#### html/template.ftl
```html
<#macro emailLayout>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: 'Roboto', 'Helvetica', 'Arial', sans-serif;
            background-color: #e8e8e8;
            color: #090909;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #f5f5f5;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 6px 6px 12px #c5c5c5, -6px -6px 12px #ffffff;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .button {
            display: inline-block;
            padding: 12px 30px;
            background-color: #009087;
            color: #ffffff;
            text-decoration: none;
            border-radius: 8px;
            margin: 20px 0;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #c5c5c5;
            font-size: 12px;
            color: #666666;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>AWS Framework</h1>
        </div>
        <#nested>
        <div class="footer">
            <p>&copy; ${.now?string('yyyy')} AWS Framework. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
</#macro>
```

## Testing the Theme

### Step 1: Clear Browser Cache

Clear your browser cache or use incognito mode to see changes immediately.

### Step 2: Test Login Page

1. Logout from Keycloak if logged in
2. Go to: http://localhost:8080/realms/aws-framework/account
3. You should see the custom themed login page

### Step 3: Test Different Screens

Test these pages to ensure consistent theming:
- Login page: `/realms/aws-framework/protocol/openid-connect/auth`
- Registration page (if enabled)
- Password reset page
- 2FA/OTP setup page
- Account management page

### Step 4: Test Responsive Design

Test on different screen sizes:
- Desktop (1920x1080)
- Tablet (768x1024)
- Mobile (375x667)

## Troubleshooting

### Theme Not Appearing

1. **Check theme is copied correctly**:
   ```bash
   docker exec -it <keycloak-container> ls /opt/keycloak/themes/aws-framework
   ```

2. **Check theme is selected in realm settings**:
   - Go to Realm Settings → Themes
   - Verify "Login Theme" is set to `aws-framework`

3. **Clear Keycloak cache**:
   ```bash
   docker exec -it <keycloak-container> /opt/keycloak/bin/kc.sh build
   docker-compose restart keycloak
   ```

4. **Check browser cache**:
   - Clear browser cache
   - Use incognito/private mode
   - Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### CSS Not Loading

1. **Check file paths in theme.properties**:
   ```properties
   styles=css/login.css css/neumorphic.css
   ```

2. **Verify CSS file exists**:
   ```bash
   docker exec -it <keycloak-container> cat /opt/keycloak/themes/aws-framework/login/resources/css/neumorphic.css
   ```

3. **Check for CSS syntax errors**:
   - Open browser DevTools (F12)
   - Check Console for CSS errors
   - Check Network tab to see if CSS files are loading

### Logo Not Displaying

1. **Check image path**:
   - Verify logo file exists in `resources/img/logo.png`
   - Check file permissions

2. **Check image format**:
   - Use PNG, JPG, or SVG
   - Optimize image size (< 100KB recommended)

3. **Verify template references correct path**:
   ```html
   <img src="${url.resourcesPath}/img/logo.png" alt="Logo" />
   ```

## Advanced Customization

### Adding Custom JavaScript

Create `infrastructure/keycloak/themes/aws-framework/login/resources/js/custom.js`:

```javascript
// Add custom behavior
document.addEventListener('DOMContentLoaded', function() {
    // Example: Add password strength indicator
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            // Add your custom logic
        });
    }
});
```

Register in `theme.properties`:
```properties
scripts=js/custom.js
```

### Creating Account Management Theme

Copy the login theme structure to `account/`:

```bash
cp -r infrastructure/keycloak/themes/aws-framework/login infrastructure/keycloak/themes/aws-framework/account
```

Update `account/theme.properties`:
```properties
parent=keycloak.v2
styles=css/account.css css/neumorphic.css
```

### Multi-Language Support

Create message files for each language:

```
messages/
├── messages_en.properties  # English
├── messages_de.properties  # German
├── messages_fr.properties  # French
└── messages_es.properties  # Spanish
```

Example `messages_de.properties`:
```properties
loginTitle=AWS Framework Anmeldung
doLogIn=Anmelden
username=E-Mail oder Benutzername
password=Passwort
```

## Production Deployment

### Step 1: Build Production Image

```bash
cd infrastructure/keycloak
docker build -t your-registry/aws-framework-keycloak:1.0.0 .
```

### Step 2: Push to Registry

```bash
docker push your-registry/aws-framework-keycloak:1.0.0
```

### Step 3: Update Production docker-compose.yml

```yaml
services:
  keycloak:
    image: your-registry/aws-framework-keycloak:1.0.0
    environment:
      KC_HOSTNAME: keycloak.yourdomain.com
      KC_HOSTNAME_STRICT: true
      KC_PROXY: edge
      # ... other production settings
```

### Step 4: Deploy

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Performance Optimization

### Minimize CSS

Use a CSS minifier:
```bash
npm install -g cssnano-cli
cssnano infrastructure/keycloak/themes/aws-framework/login/resources/css/neumorphic.css infrastructure/keycloak/themes/aws-framework/login/resources/css/neumorphic.min.css
```

Update `theme.properties`:
```properties
styles=css/neumorphic.min.css
```

### Optimize Images

```bash
# Install imagemagick
brew install imagemagick  # macOS
apt-get install imagemagick  # Ubuntu

# Optimize logo
convert logo.png -strip -quality 85 -resize 200x60 logo-optimized.png
```

### Enable Caching

In production, ensure proper cache headers are set for theme resources.

## Maintenance

### Updating the Theme

1. Make changes to theme files
2. Rebuild Docker image (if using Method 2)
3. Restart Keycloak
4. Clear browser cache
5. Test changes

### Version Control

Keep theme files in version control:
```bash
git add infrastructure/keycloak/themes/
git commit -m "Update Keycloak theme"
git push
```

## Resources

- [Keycloak Theme Documentation](https://www.keycloak.org/docs/latest/server_development/#_themes)
- [Keycloak Server Developer Guide](https://www.keycloak.org/docs/latest/server_development/)
- [FreeMarker Template Language](https://freemarker.apache.org/docs/)

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review Keycloak logs: `docker logs <keycloak-container>`
3. Check browser DevTools console for errors
4. Consult the Keycloak documentation

## License

This theme is part of the AWS Framework project and follows the same license.
