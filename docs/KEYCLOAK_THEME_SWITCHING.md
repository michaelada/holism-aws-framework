# Keycloak Theme Switching Guide

This guide explains how to switch between the available Keycloak login themes for both the Super Admin and Org Admin portals.

## Available Themes

### 1. Neumorphic Theme (Default)
- Original design with teal/gray colors
- Soft neumorphic shadows and 3D effects
- Roboto font family
- Clean, modern aesthetic

### 2. Warm Theme
- Inspired by the ItsPlainSailing marketing site
- Orange (#FF9800) to Amber (#E65100) gradient colors
- Gold accent (#FFC107)
- Sora font family
- Modern, warm aesthetic with rounded buttons and smooth transitions

## How to Switch Themes

### Super Admin Login Theme

1. Open `infrastructure/keycloak/themes/super-admin/login/theme.properties`

2. Find the "Theme Styles" section

3. To use the **neumorphic theme** (current default):
   ```properties
   styles=css/login.css css/neumorphic.css
   ```

4. To use the **warm theme**:
   ```properties
   # Comment out the neumorphic theme line
   # styles=css/login.css css/neumorphic.css
   
   # Uncomment the warm theme line
   styles=css/login.css css/warm.css
   ```

### Org Admin Login Theme

1. Open `infrastructure/keycloak/themes/org-admin/login/theme.properties`

2. Find the "Theme Styles" section

3. To use the **neumorphic theme** (current default):
   ```properties
   styles=css/login.css css/neumorphic.css
   ```

4. To use the **warm theme**:
   ```properties
   # Comment out the neumorphic theme line
   # styles=css/login.css css/neumorphic.css
   
   # Uncomment the warm theme line
   styles=css/login.css css/warm.css
   ```

## After Switching

After changing the theme in either login portal:

1. **Restart Keycloak** to apply the changes:
   ```bash
   docker-compose restart keycloak
   ```

2. **Clear your browser cache** or open an incognito/private window

3. **Navigate to the login page** to see the new theme:
   - Super Admin: `http://localhost:8080/realms/aws-framework/account`
   - Org Admin: `http://localhost:8080/realms/aws-framework/account`

## Theme Files Location

### Super Admin Theme
- **Theme Properties**: `infrastructure/keycloak/themes/super-admin/login/theme.properties`
- **Neumorphic CSS**: `infrastructure/keycloak/themes/super-admin/login/resources/css/neumorphic.css`
- **Warm CSS**: `infrastructure/keycloak/themes/super-admin/login/resources/css/warm.css`
- **Template**: `infrastructure/keycloak/themes/super-admin/login/template.ftl`

### Org Admin Theme
- **Theme Properties**: `infrastructure/keycloak/themes/org-admin/login/theme.properties`
- **Neumorphic CSS**: `infrastructure/keycloak/themes/org-admin/login/resources/css/neumorphic.css`
- **Warm CSS**: `infrastructure/keycloak/themes/org-admin/login/resources/css/warm.css`
- **Template**: `infrastructure/keycloak/themes/org-admin/login/template.ftl`

## Theme Customization

Both themes can be customized by editing their respective CSS files.

### Warm Theme Customization

To modify the warm theme colors, edit the CSS variables at the top of the warm.css file:

```css
:root {
  /* Primary Colors - Orange/Amber Gradient */
  --primary-main: #FF9800;
  --primary-light: #FFB74D;
  --primary-dark: #F57C00;
  --primary-gradient-start: #FF9800;
  --primary-gradient-end: #E65100;
  
  /* Secondary Colors - Gold */
  --secondary-main: #FFC107;
  --secondary-light: #FFD54F;
  --secondary-dark: #FFA000;
  
  /* Background Colors */
  --bg-default: #FFFFFF;
  --bg-paper: #FAF8F5;
  --bg-warm: #F1EDE8;
  
  /* Text Colors */
  --text-primary: #1E293B;
  --text-secondary: #64748B;
  --text-charcoal: #1A1E2E;
}
```

### Neumorphic Theme Customization

To modify the neumorphic theme colors, edit the CSS variables at the top of the neumorphic.css file:

```css
:root {
  /* Primary Colors */
  --primary-main: #009087;
  --primary-light: #00b3a8;
  --primary-dark: #006d66;
  
  /* Background Colors */
  --bg-default: #e8e8e8;
  --bg-paper: #f5f5f5;
  
  /* Text Colors */
  --text-primary: #090909;
  --text-secondary: #666666;
}
```

## Font Requirements

### Warm Theme
The warm theme uses the **Sora** font family, which is loaded from Google Fonts via the CSS file:
```css
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap');
```

### Neumorphic Theme
The neumorphic theme uses the **Roboto** font family, which is typically available by default or can be loaded from Google Fonts.

## Matching Application Themes

For a consistent user experience, you should match the Keycloak login theme with your application theme:

### If using Warm Theme in Applications:
1. Set Keycloak login themes to warm (both super-admin and org-admin)
2. Set application themes to warm:
   - `packages/admin/src/theme/index.ts` → export warmTheme as defaultTheme
   - `packages/orgadmin-shell/src/theme/index.ts` → export warmTheme as defaultTheme

### If using Neumorphic Theme in Applications:
1. Set Keycloak login themes to neumorphic (both super-admin and org-admin)
2. Set application themes to neumorphic:
   - `packages/admin/src/theme/index.ts` → export neumorphicTheme as defaultTheme
   - `packages/orgadmin-shell/src/theme/index.ts` → export neumorphicTheme as defaultTheme

## Troubleshooting

### Theme not changing after restart?

1. **Clear browser cache completely**:
   - Chrome: Ctrl+Shift+Delete → Clear cached images and files
   - Firefox: Ctrl+Shift+Delete → Cached Web Content
   - Safari: Cmd+Option+E

2. **Try incognito/private browsing mode**

3. **Check Keycloak logs** for any theme loading errors:
   ```bash
   docker-compose logs keycloak
   ```

### CSS not loading?

1. **Verify file paths** in theme.properties are correct
2. **Check file permissions** on the CSS files
3. **Restart Keycloak container**:
   ```bash
   docker-compose restart keycloak
   ```

### Fonts not loading?

1. **Check internet connection** (fonts load from Google Fonts CDN)
2. **Verify CSS @import statement** is at the top of the CSS file
3. **Check browser console** for font loading errors

### Theme looks broken?

1. **Verify you commented/uncommented the correct lines** in theme.properties
2. **Check for syntax errors** in the CSS file
3. **Ensure only ONE styles= line is active** in theme.properties

## Testing Checklist

After switching themes, test the following:

- [ ] Login page loads correctly
- [ ] Logo displays properly
- [ ] Form inputs are styled correctly
- [ ] Buttons have correct colors and hover effects
- [ ] Error messages display properly
- [ ] Links are visible and clickable
- [ ] Responsive design works on mobile
- [ ] Fonts load correctly
- [ ] Colors match the application theme

## Creating a New Theme

To create a new Keycloak theme:

1. **Create a new CSS file** in the resources/css directory:
   ```bash
   touch infrastructure/keycloak/themes/super-admin/login/resources/css/mytheme.css
   ```

2. **Copy an existing theme** as a starting point:
   ```bash
   cp infrastructure/keycloak/themes/super-admin/login/resources/css/warm.css \
      infrastructure/keycloak/themes/super-admin/login/resources/css/mytheme.css
   ```

3. **Customize the CSS variables** and styles

4. **Update theme.properties** to reference your new theme:
   ```properties
   styles=css/login.css css/mytheme.css
   ```

5. **Restart Keycloak** and test

## Additional Resources

- [Keycloak Theme Documentation](https://www.keycloak.org/docs/latest/server_development/#_themes)
- [Application Theme Switching Guide](./THEME_SWITCHING_GUIDE.md)
- [Warm Theme Implementation Summary](./WARM_THEME_IMPLEMENTATION.md)

## Maintenance

When updating themes:

1. **Keep both themes in sync** with design system changes
2. **Test on multiple browsers** (Chrome, Firefox, Safari, Edge)
3. **Verify accessibility** (color contrast, focus states)
4. **Test responsive design** on different screen sizes
5. **Update documentation** if adding new features
