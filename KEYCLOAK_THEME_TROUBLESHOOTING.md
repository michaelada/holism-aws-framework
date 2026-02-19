# Keycloak Theme Not Showing - Fixed!

## What Was The Problem

The theme files were created correctly, but Keycloak wasn't seeing them because:
1. The volume mount wasn't in `docker-compose.yml`
2. Keycloak needed a full restart (stop + remove + start) to pick up the new theme

## What Was Fixed

1. ✅ Added volume mount to `docker-compose.yml`:
   ```yaml
   volumes:
     - ./infrastructure/keycloak/themes:/opt/keycloak/themes
   ```

2. ✅ Fully restarted Keycloak container:
   ```bash
   docker-compose stop keycloak
   docker-compose rm -f keycloak
   docker-compose up -d keycloak
   ```

## Verify The Theme Is Now Available

### Step 1: Check Theme Files in Container

```bash
docker exec aws-framework-keycloak ls -la /opt/keycloak/themes/aws-framework/login/
```

You should see:
- `theme.properties`
- `resources/` directory
- `messages/` directory

### Step 2: Access Keycloak Admin Console

1. Go to: http://localhost:8080
2. Click "Administration Console"
3. Login:
   - Username: `admin`
   - Password: `admin`

### Step 3: Select Your Realm

1. In the top-left corner, click the realm dropdown
2. Select **`aws-framework`** realm

### Step 4: Enable The Theme

1. In the left sidebar, click **"Realm Settings"**
2. Click the **"Themes"** tab
3. In the **"Login Theme"** dropdown, you should now see:
   - Base
   - Keycloak
   - **aws-framework** ← This is your custom theme!
4. Select **`aws-framework`**
5. Click **"Save"**

### Step 5: Test The Theme

1. Logout from Keycloak (click your username → Sign Out)
2. Go to: http://localhost:5175/orgadmin/
3. You'll be redirected to the Keycloak login page
4. The login page should now have:
   - Light gray background (#e8e8e8)
   - Neumorphic card with soft shadows
   - Teal accent color (#009087)
   - Smooth button animations

## If Theme Still Not Showing

### Option 1: Clear Browser Cache

```bash
# Hard refresh in browser
# Mac: Cmd + Shift + R
# Windows/Linux: Ctrl + Shift + R

# Or use incognito/private mode
```

### Option 2: Check Keycloak Logs

```bash
docker logs aws-framework-keycloak 2>&1 | grep -i theme
```

### Option 3: Verify Theme Structure

```bash
# Check theme.properties
docker exec aws-framework-keycloak cat /opt/keycloak/themes/aws-framework/login/theme.properties

# Check CSS file exists
docker exec aws-framework-keycloak ls -la /opt/keycloak/themes/aws-framework/login/resources/css/
```

### Option 4: Restart Keycloak Again

```bash
docker-compose restart keycloak

# Wait 15 seconds for it to start
sleep 15

# Then try again
```

### Option 5: Check for Typos

The theme name must be **exactly** `aws-framework` (with hyphen, all lowercase):
- ✅ Correct: `aws-framework`
- ❌ Wrong: `aws_framework`
- ❌ Wrong: `AWS-Framework`
- ❌ Wrong: `awsframework`

## Common Issues

### Issue: "Theme not in dropdown"

**Solution**: 
1. Verify volume mount in docker-compose.yml
2. Restart Keycloak: `docker-compose restart keycloak`
3. Wait 15 seconds
4. Refresh Keycloak admin page

### Issue: "Theme selected but not applying"

**Solution**:
1. Clear browser cache (Ctrl+Shift+R)
2. Use incognito mode
3. Check browser console for CSS errors (F12)

### Issue: "CSS not loading"

**Solution**:
1. Verify CSS file exists:
   ```bash
   docker exec aws-framework-keycloak cat /opt/keycloak/themes/aws-framework/login/resources/css/neumorphic.css | head -20
   ```
2. Check theme.properties has correct path:
   ```
   styles=css/login.css css/neumorphic.css
   ```

## Success Indicators

When the theme is working correctly, you should see:

1. ✅ In Keycloak Admin → Realm Settings → Themes:
   - `aws-framework` appears in Login Theme dropdown

2. ✅ On the login page:
   - Light gray background
   - Neumorphic card with soft shadows
   - Teal color on focus/hover
   - Smooth button animations

3. ✅ In browser DevTools (F12) → Network tab:
   - `neumorphic.css` loads successfully (200 OK)

## Next Steps

Once the theme is working:

1. **Add Your Logo** (optional):
   - Place logo at: `infrastructure/keycloak/themes/aws-framework/login/resources/img/logo.png`
   - Recommended size: 200x60px
   - Restart Keycloak

2. **Customize Colors** (optional):
   - Edit: `infrastructure/keycloak/themes/aws-framework/login/resources/css/neumorphic.css`
   - Change CSS variables in `:root` section
   - Restart Keycloak

3. **Add Translations** (optional):
   - Create: `infrastructure/keycloak/themes/aws-framework/login/messages/messages_de.properties`
   - Add translated strings
   - Restart Keycloak

## Documentation

For complete documentation, see:
- `docs/KEYCLOAK_CUSTOM_THEME.md` - Full customization guide
- `KEYCLOAK_THEME_SETUP.md` - Quick setup guide
- `infrastructure/keycloak/themes/aws-framework/README.md` - Theme README

## Support

If you're still having issues:
1. Check the theme files exist locally: `ls -la infrastructure/keycloak/themes/aws-framework/`
2. Check docker-compose.yml has the volume mount
3. Check Keycloak logs: `docker logs aws-framework-keycloak`
4. Try the full restart procedure above
5. Check browser console (F12) for errors
