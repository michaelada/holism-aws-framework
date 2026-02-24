# Keycloak Custom Theme - Quick Setup Guide

## What Was Created

I've created a complete custom Keycloak theme that matches your orgadmin UI's neumorphic design system.

### Theme Features

✨ **Design System Match**
- Teal primary color (#009087) matching your orgadmin
- Neumorphic shadows (soft 3D effect)
- Same typography (Roboto font)
- Consistent button animations
- Light gray background (#e8e8e8)

🎨 **What's Included**
- Login page styling
- Registration page styling
- Password reset styling
- 2FA/OTP setup styling
- Error/success messages
- Responsive design (mobile, tablet, desktop)
- Accessibility features

## Files Created

```
infrastructure/keycloak/themes/aws-framework/
├── login/
│   ├── theme.properties                    # Theme config
│   ├── resources/
│   │   └── css/
│   │       └── neumorphic.css             # Custom styles (400+ lines)
│   └── messages/
│       └── messages_en.properties         # English text
└── README.md

docs/
└── KEYCLOAK_CUSTOM_THEME.md               # Complete documentation

scripts/
└── setup-keycloak-theme.sh                # Automated setup script
```

## Quick Setup (3 Steps)

### Step 1: Run the Setup Script

```bash
chmod +x scripts/setup-keycloak-theme.sh
./scripts/setup-keycloak-theme.sh
```

Choose option 1 (Docker Volume Mount) for development.

### Step 2: Update docker-compose.yml

Add this to your keycloak service:

```yaml
services:
  keycloak:
    # ... existing config
    volumes:
      - ./infrastructure/keycloak/themes:/opt/keycloak/themes
```

Then restart:
```bash
docker-compose restart keycloak
```

### Step 3: Enable in Keycloak

1. Go to http://localhost:8080
2. Login as admin
3. Select `aws-framework` realm
4. Go to **Realm Settings** → **Themes** tab
5. Set **Login Theme** to `aws-framework`
6. Click **Save**

## Test It

1. Logout from Keycloak
2. Go to: http://localhost:5175/orgadmin/
3. You'll be redirected to the custom themed login page
4. The login page should now match your orgadmin UI design!

## Customization Options

### Add Your Logo

1. Place your logo at: `infrastructure/keycloak/themes/aws-framework/login/resources/img/logo.png`
2. Recommended size: 200x60px
3. Restart Keycloak

### Change Colors

Edit `infrastructure/keycloak/themes/aws-framework/login/resources/css/neumorphic.css`:

```css
:root {
  --primary-main: #YOUR_COLOR;
  --bg-default: #YOUR_BG_COLOR;
}
```

### Customize Text

Edit `infrastructure/keycloak/themes/aws-framework/login/messages/messages_en.properties`:

```properties
loginTitle=Your Custom Title
doLogIn=Your Custom Button Text
```

## What It Looks Like

The themed login page will have:
- Neumorphic card with soft shadows
- Teal accent color on focus/hover
- Smooth button animations (wave effect)
- Inset shadows on input fields
- Consistent spacing and typography
- Responsive design for all screen sizes

## Troubleshooting

### Theme not showing?

```bash
# Clear Keycloak cache
docker-compose restart keycloak

# Clear browser cache
# Use Ctrl+Shift+R (or Cmd+Shift+R on Mac)
```

### Still not working?

1. Check theme is selected in Realm Settings → Themes
2. Verify files exist: `ls infrastructure/keycloak/themes/aws-framework/login/resources/css/`
3. Check Keycloak logs: `docker logs <keycloak-container-name>`
4. Try incognito/private browsing mode

## Documentation

For complete documentation including:
- Advanced customization
- Email templates
- Multi-language support
- Production deployment
- Performance optimization

See: `docs/KEYCLOAK_CUSTOM_THEME.md`

## Next Steps

1. ✅ Set up the theme (follow Quick Setup above)
2. 🎨 Add your logo (optional)
3. 🌍 Add translations (optional)
4. 📧 Customize email templates (optional)
5. 🚀 Deploy to production (see full docs)

## Support

If you encounter issues:
1. Check the Troubleshooting section above
2. Review `docs/KEYCLOAK_CUSTOM_THEME.md`
3. Check browser DevTools console (F12)
4. Review Keycloak logs

## Design Consistency

The theme matches these elements from your orgadmin UI:
- ✅ Primary color (#009087)
- ✅ Background color (#e8e8e8)
- ✅ Neumorphic shadows
- ✅ Button animations
- ✅ Typography (Roboto)
- ✅ Border radius (0.5em)
- ✅ Input field styling
- ✅ Responsive design

Your users will have a seamless experience transitioning from the login page to the orgadmin interface!
