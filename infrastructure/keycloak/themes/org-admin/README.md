# Organization Admin Keycloak Theme

Custom Keycloak theme for the Organization Admin Portal.

## Features

- ✨ Neumorphic design with soft 3D shadows
- 🎨 Teal primary color (#009087)
- 📱 Fully responsive design
- ♿ Accessibility compliant
- 🌍 Multi-language support ready
- 🎭 Smooth animations and transitions
- 🔒 Consistent with OrgAdmin UI
- 👥 Customized for organization administrators

## Login Page Customization

- **Title**: "Organization Admin Portal"
- **Heading**: "Organization Administrator Login"
- **Description**: "Organization administrators only. Please enter your credentials to manage your organization."

## Usage

This theme should be assigned to the Organization Admin client in Keycloak:

1. Go to Keycloak Admin Console
2. Navigate to Clients → [org-admin-client]
3. Go to the "Settings" tab
4. Scroll to "Login settings"
5. Set "Login theme" to `org-admin`
6. Save

## Quick Start

### Option 1: Docker Volume Mount (Recommended for Development)

1. Add to your `docker-compose.yml`:
   ```yaml
   services:
     keycloak:
       volumes:
         - ./infrastructure/keycloak/themes:/opt/keycloak/themes
   ```

2. Restart Keycloak:
   ```bash
   docker-compose restart keycloak
   ```

3. Enable in Keycloak Admin Console:
   - Go to Realm Settings → Themes
   - Set Login Theme to `aws-framework`
   - Save

### Option 2: Use Setup Script

```bash
./scripts/setup-keycloak-theme.sh
```

## Structure

```
aws-framework/
├── login/                          # Login theme
│   ├── theme.properties           # Theme configuration
│   ├── resources/
│   │   ├── css/
│   │   │   └── neumorphic.css    # Custom styles
│   │   └── img/
│   │       └── logo.png          # Custom logo (add your own)
│   └── messages/
│       └── messages_en.properties # English translations
└── README.md                      # This file
```

## Customization

### Change Colors

Edit `login/resources/css/neumorphic.css`:

```css
:root {
  --primary-main: #009087;    /* Your primary color */
  --bg-default: #e8e8e8;      /* Your background color */
  --text-primary: #090909;    /* Your text color */
}
```

### Add Logo

1. Place your logo at: `login/resources/img/logo.png`
2. Recommended size: 200x60px
3. The logo will automatically appear on the login page

### Add Translations

Create new message files:
- `login/messages/messages_de.properties` (German)
- `login/messages/messages_fr.properties` (French)
- `login/messages/messages_es.properties` (Spanish)

## Testing

1. Clear browser cache
2. Go to: `http://localhost:8080/realms/aws-framework/account`
3. You should see the custom themed login page

## Documentation

For detailed documentation, see: [docs/KEYCLOAK_CUSTOM_THEME.md](../../../docs/KEYCLOAK_CUSTOM_THEME.md)

## Design System

### Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Primary | #009087 | Buttons, links, accents |
| Primary Light | #00b3a8 | Hover states |
| Primary Dark | #006d66 | Active states |
| Background | #e8e8e8 | Main background |
| Paper | #f5f5f5 | Card backgrounds |
| Text Primary | #090909 | Main text |
| Text Secondary | #666666 | Secondary text |

### Typography

- Font Family: Roboto, Helvetica, Arial, sans-serif
- Base Size: 16px (1rem)
- Button Size: 16px (1rem)
- Heading Size: 24px (1.5rem)

### Shadows

Neumorphic shadows create a soft 3D effect:
- Light shadow: #ffffff
- Dark shadow: #c5c5c5
- Elevation: 6px 6px 12px (light), -6px -6px 12px (dark)

### Border Radius

- Small: 0.5em (8px)
- Large: 1em (16px)

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: iOS Safari, Chrome Mobile

## Troubleshooting

### Theme not appearing?

1. Check theme is selected in Realm Settings
2. Clear browser cache
3. Restart Keycloak container
4. Check browser console for errors

### CSS not loading?

1. Verify file paths in `theme.properties`
2. Check file permissions
3. Restart Keycloak

### Logo not showing?

1. Verify logo file exists at `login/resources/img/logo.png`
2. Check image format (PNG, JPG, SVG)
3. Optimize image size (< 100KB)

## Contributing

When making changes:
1. Test on multiple browsers
2. Test responsive design
3. Verify accessibility
4. Update documentation

## License

Part of the AWS Framework project.
