# Run all tasks: .kiro/specs/onboarding-and-help-system/tasks.md (Continued) (Continued)

Exported: 25/02/2026, 18:28:49

---

**User:**

## SUMMARY OF CONVERSATION

## TASK 1: Fix super admin UI error with useOnboarding
- **STATUS**: done
- **USER QUERIES**: 1 ("Super admin UI error: useOnboarding must be used within OnboardingProvider")
- **DETAILS**: The super admin app (`packages/admin`) was incorrectly importing and using `usePageHelp` from `@aws-web-framework/orgadmin-shell`, but the super admin doesn't have OnboardingProvider set up. The onboarding system is only for the org admin interface, not the super admin interface. Fixed by removing the import and usage of `usePageHelp` from `packages/admin/src/pages/DashboardPage.tsx`.
- **FILEPATHS**: `packages/admin/src/pages/DashboardPage.tsx`

## TASK 2: Fix org admin UI import errors with file extensions
- **STATUS**: done
- **USER QUERIES**: 2 ("Org admin error: Failed to resolve import with .ts extension")
- **DETAILS**: Multiple files in the org admin app were importing from `@aws-web-framework/orgadmin-shell` with incorrect file extensions (`.ts` or `.tsx`). TypeScript/Vite imports should not include file extensions. Fixed imports in 6 files:
  * `packages/orgadmin-core/src/users/pages/CreateAccountUserPage.tsx`
  * `packages/orgadmin-core/src/users/pages/InviteAdminUserPage.tsx`
  * `packages/orgadmin-core/src/users/pages/OrgAdminUsersListPage.tsx`
  * `packages/orgadmin-core/src/users/pages/AccountUsersListPage.tsx`
  * `packages/orgadmin-core/src/users/pages/UserDetailsPage.tsx`
  * `packages/orgadmin-memberships/src/pages/MembersDatabasePage.tsx`
- **FILEPATHS**: All files listed above

## TASK 3: Fix welcome dialog persistence issue
- **STATUS**: done
- **USER QUERIES**: 3 ("Dialog won't disappear when I select checkbox and click close, reappears on reload")
- **DETAILS**: The welcome dialog had two issues:
  1. **Session tracking issue**: Dialog would reappear on every re-render. Fixed by adding `welcomeShownThisSession` state to prevent dialog from showing multiple times in the same session.
  2. **Database table missing**: The backend API was returning 500 errors because the `user_onboarding_preferences` table didn't exist in the database. Created:
     * Database migration file: `packages/backend/src/database/migrations/001_create_user_onboarding_preferences.sql`
     * Updated `infrastructure/init-db.sql` to include the table creation
     * Ran the migration successfully to create the table
  
  Added detailed logging to `OnboardingProvider.tsx` to help debug API calls (logs start with `[OnboardingProvider]`).
- **FILEPATHS**: 
  * `packages/orgadmin-shell/src/context/OnboardingProvider.tsx`
  * `packages/backend/src/database/migrations/001_create_user_onboarding_preferences.sql`
  * `infrastructure/init-db.sql`

## TASK 4: Fix missing translation key for help button tooltip
- **STATUS**: in-progress
- **USER QUERIES**: 4 ("Missing translation key: button.tooltip for languages: en-GB")
- **DETAILS**: The console shows an error about missing translation key `button.tooltip` in the HelpButton component. Investigation shows:
  * The HelpButton component at `packages/orgadmin-shell/src/components/HelpButton.tsx` is trying to access `t('button.tooltip')`
  * The translation file `packages/orgadmin-shell/src/locales/en-GB/help.json` DOES contain `button.tooltip: "Get help"`
  * The error suggests the translation is not being loaded properly or there's a namespace issue
- **NEXT STEPS**:
  * Verify the help.json file is being loaded correctly in the i18n configuration
  * Check if there's a namespace registration issue
  * Ensure all language files (fr-FR, de-DE, it-IT, es-ES, pt-PT) also have the button.tooltip key
  * Test if the translation loads after fixing any configuration issues
- **FILEPATHS**: 
  * `packages/orgadmin-shell/src/components/HelpButton.tsx`
  * `packages/orgadmin-shell/src/locales/en-GB/help.json`
  * `packages/orgadmin-shell/src/locales/*/help.json` (all language files)

## USER CORRECTIONS AND INSTRUCTIONS:
- User clarified they were referring to the super admin UI (packages/admin), not org admin, when reporting the first error
- The onboarding/help system is only for org admin interface, not super admin interface
- Database password for PostgreSQL was needed during migration execution

## Files to read
- `packages/orgadmin-shell/src/components/HelpButton.tsx`
- `packages/orgadmin-shell/src/locales/en-GB/help.json`
- `packages/orgadmin-shell/src/locales/fr-FR/help.json`
- `packages/orgadmin-shell/src/locales/de-DE/help.json`
- `packages/orgadmin-shell/src/locales/it-IT/help.json`
- `packages/orgadmin-shell/src/locales/es-ES/help.json`
- `packages/orgadmin-shell/src/locales/pt-PT/help.json`
- `packages/orgadmin-shell/src/hooks/useTranslation.ts`
- `packages/orgadmin-shell/src/config/i18n.ts` (if exists)

USER QUERIES(most recent first):
1. It won't dissappear when I select the checkbox and cloick close, the next time I reload the page it reappears.
2. Ok,now when I click "Don't show this again" and click Close button it dissappears, however when I relaod the page it pops up again.
3. On the landing page, when I select the "Don't show this again" checkbox and click close, the dialog box keeps popping up again.
4. Its still not working
5. <implicit-rules>## Implicit Rules
Focus on creating a new spec file or identifying an existing spec to update. 
If starting a new spec, create a requirements.md file in the .kiro/specs directory with clear user stories and acceptance criteria. 
If working with an existing spec, review the current requirements and suggest improvements if needed. 
Do not make direct code changes yet. First establish or review the spec file that will guide our implementation.</implicit-rules>

---

**Assistant:**

I'll investigate the missing translation key issue for the help button tooltip. Let me read the relevant files to understand the problem.

Now let me check the translation hook and i18n configuration:

Let me search for the i18n configuration file:

Let me check the main.tsx file where i18n is likely initialized:

Now let me check the i18n config file:

I can see the issue! The i18n configuration only loads two namespaces: `translation` and `onboarding`. The `help` namespace is not being loaded. The HelpButton component is trying to use `useTranslation('help')`, but the help translations are never loaded into i18n.

Let me check if there are other components using the help namespace:

Perfect! Both HelpButton and HelpDrawer use the `help` namespace. The fix is to add the `help` namespace to the i18n configuration. Let me update the config file:

Perfect! Now let me check for any diagnostics to make sure the changes are correct:

Excellent! The changes are syntactically correct. The issue was that the i18n configuration was only loading the `translation` and `onboarding` namespaces, but the HelpButton and HelpDrawer components were trying to use the `help` namespace which was never loaded.

The fix adds the `help` namespace to:
1. The initial resource loading
2. The namespace list in the i18n configuration
3. The preload logic (for testing)
4. The lazy loading logic (for language changes)
5. The fallback initialization

This ensures that the help translations are loaded when the app initializes and when the language changes, which will resolve the missing translation key error for `button.tooltip`.

---

**User:**

WHen I click on the Help icon in the top right of the screen nothing happens.

---

**Assistant:**

Let me investigate where the HelpButton is integrated into the Layout and check if the click handler is properly wired up.

Now let me read the Layout component to see how the help drawer is implemented:

I can see the Layout component uses `toggleHelpDrawer` from the `useOnboarding` hook, but I don't see the HelpDrawer component being rendered. Let me check if HelpDrawer is rendered elsewhere:

The HelpDrawer component is not being rendered in the Layout! That's why clicking the button does nothing. Let me check if it should be rendered in the OnboardingProvider or somewhere else:

Found it! The OnboardingProvider only renders the WelcomeDialog, but not the HelpDrawer. The HelpDrawer needs to be added to the OnboardingProvider. Let me add it:

Now let me check for any diagnostics:

Let me check the HelpDrawer props to see if moduleId and pageId can be optional:

The props are required. Let me check if there's a way to make them optional or provide defaults. Let me look at more of the HelpDrawer:

I see the issue. The HelpDrawer requires both moduleId and pageId. When the help drawer is opened without a specific page context, we need to provide default values. Let me update the OnboardingProvider to handle this better:

Perfect! Now the HelpDrawer is properly integrated. The changes I made:

1. **Fixed the missing translation namespace**: Added the `help` namespace to the i18n configuration so that help translations are loaded when the app initializes.

2. **Added HelpDrawer to OnboardingProvider**: The HelpDrawer component wasn't being rendered anywhere, so clicking the HelpButton did nothing. I added it to the OnboardingProvider with logic to:
   - Show the HelpDrawer with the current module and page context when available
   - Fall back to showing dashboard overview help when no specific context is set
   - Only render when `helpDrawerOpen` is true

The help system should now work properly:
- Clicking the help button in the navbar will toggle the help drawer
- The drawer will show contextual help based on the current page
- If no page context is set, it defaults to showing dashboard overview help
- The keyboard shortcut (Shift+?) will also work to toggle the help drawer

---

**User:**

When I am on the Create Field Definition page and I click the Help Icon, i tis showing the Dashboard Help.

---

**Assistant:**

The issue is that pages need to call `setCurrentPageId` from the onboarding context to tell the help system which page they're on. Let me check the CreateFieldPage to see if it's setting the page context:

The page doesn't set the page context. Pages need to call `setCurrentPageId` from the onboarding context to register themselves with the help system. Let me add this to the CreateFieldPage:

Now let me check the diagnostics:

Good! Now the CreateFieldPage will register itself with the help system. However, we also need to make sure the OnboardingProvider tracks the current module. Let me check how the module is being set. Looking back at the OnboardingProvider, I see that `currentModule` is only set when showing module introduction dialogs, not for general page navigation.

We need to update the logic so that when `setCurrentPageId` is called, we also update the `currentModule`. Let me update the OnboardingProvider:

I see the issue now. The `setCurrentPageId` function doesn't also set the module. We need to either:
1. Add a `setCurrentModule` function, or
2. Modify `checkModuleVisit` to also set the current module for help purposes

Let me update the approach. Instead of having pages call both `setCurrentPageId` and `checkModuleVisit`, let's create a helper that sets both the module and page context. Let me update the OnboardingContext and Provider:

Now let me update the OnboardingProvider to add the `setCurrentModule` function and export it in the context:

Now let me update the CreateFieldPage to also set the current module:

Now let me check for diagnostics:

Perfect! Now the help system should work correctly. The changes I made:

1. **Added `setCurrentModule` function** to the OnboardingContext interface and OnboardingProvider to allow pages to set their module context for the help system without triggering the module introduction dialog.

2. **Updated CreateFieldPage** to register itself with the help system by calling:
   - `setCurrentModule('forms')` - Sets the module context
   - `setCurrentPageId('create')` - Sets the page context
   - `checkModuleVisit('forms')` - Checks if the module intro should be shown

Now when you're on the Create Field Definition page and click the Help icon, it should show the Forms module help content (specifically `forms.create` if it exists, or fall back to `forms.overview`).

---

**User:**

Do you think you can create a new theme for the Super Admin and Orgadmin UI based on the css+html below. If so could you do it in such a way that the old theme is kept and I can switch back to it easily.
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ItsPlainSailing | Online Payments ~ Made Easy</title>
<meta name="description" content="Manage events, memberships, merchandise and bookings online. Accept payments easily with ItsPlainSailing.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
/* ═══════════════════════════════════════════════════
CSS CUSTOM PROPERTIES
═══════════════════════════════════════════════════ */
:root {
--gold: #FFC107;
--orange: #FF9800;
--amber: #E65100;
--orange-soft: #FFF3E0;
--orange-hover: #F57C00;
--charcoal: #1A1E2E;
--slate: #334155;
--text: #1E293B;
--text-muted: #64748B;
--text-light: #94A3B8;
--bg-white: #FFFFFF;
--bg-warm: #FAF8F5;
--bg-light: #F1EDE8;
--bg-dark: #111827;
--bg-card: #FFFFFF;
--radius: 12px;
--radius-lg: 20px;
--shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
--shadow-md: 0 4px 20px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04);
--shadow-lg: 0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04);
--shadow-orange: 0 8px 30px rgba(255,152,0,0.25);
--font: 'Sora', sans-serif;
--transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
--max-width: 1200px;
}
/* ═══════════════════════════════════════════════════
RESET & BASE
═══════════════════════════════════════════════════ */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 80px; }
body {
font-family: var(--font);
color: var(--text);
background: var(--bg-white);
line-height: 1.7;
font-weight: 400;
font-size: 16px;
-webkit-font-smoothing: antialiased;
overflow-x: hidden;
}
img { max-width: 100%; display: block; }
a { color: inherit; text-decoration: none; }
button { font-family: inherit; cursor: pointer; border: none; background: none; }
ul { list-style: none; }
/* ═══════════════════════════════════════════════════
TYPOGRAPHY
═══════════════════════════════════════════════════ */
h1 { font-size: clamp(2.8rem, 6vw, 4.5rem); font-weight: 800; line-height: 1.08; letter-spacing: -0.03em; }
h2 { font-size: clamp(2rem, 4vw, 3rem); font-weight: 700; line-height: 1.15; letter-spacing: -0.02em; }
h3 { font-size: 1.25rem; font-weight: 600; line-height: 1.3; }
p { color: var(--text-muted); max-width: 60ch; }
.gradient-text {
background: linear-gradient(135deg, var(--gold) 0%, var(--orange) 50%, var(--amber) 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
background-clip: text;
}
.section-label {
font-size: 0.8rem;
font-weight: 600;
letter-spacing: 0.12em;
text-transform: uppercase;
color: var(--orange);
margin-bottom: 1rem;
display: block;
}
/* ═══════════════════════════════════════════════════
LAYOUT
═══════════════════════════════════════════════════ */
.container { max-width: var(--max-width); margin: 0 auto; padding: 0 2rem; }
.section { padding: 7rem 0; }
.section--dark { background: var(--charcoal); color: #fff; }
.section--dark p { color: #CBD5E1; }
.section--warm { background: var(--bg-warm); }
.section--gradient {
background: linear-gradient(135deg, var(--charcoal) 0%, #1E293B 50%, #0F172A 100%);
color: #fff;
}
.text-center { text-align: center; }
.mx-auto { margin-left: auto; margin-right: auto; }
/* ═══════════════════════════════════════════════════
BUTTONS
═══════════════════════════════════════════════════ */
.btn {
display: inline-flex;
align-items: center;
gap: 0.5rem;
padding: 0.85rem 2rem;
font-size: 0.95rem;
font-weight: 600;
border-radius: 60px;
transition: all var(--transition);
white-space: nowrap;
}
.btn--primary {
background: linear-gradient(135deg, var(--orange), var(--amber));
color: #fff;
box-shadow: var(--shadow-orange);
}
.btn--primary:hover {
transform: translateY(-2px);
box-shadow: 0 12px 35px rgba(255,152,0,0.35);
}
.btn--outline {
border: 2px solid var(--text);
color: var(--text);
background: transparent;
}
.btn--outline:hover {
background: var(--text);
color: #fff;
transform: translateY(-2px);
}
.btn--outline-light {
border: 2px solid rgba(255,255,255,0.3);
color: #fff;
}
.btn--outline-light:hover {
background: #fff;
color: var(--text);
border-color: #fff;
}
.btn--white {
background: #fff;
color: var(--text);
}
.btn--white:hover {
transform: translateY(-2px);
box-shadow: var(--shadow-lg);
}
/* ═══════════════════════════════════════════════════
NAVIGATION
═══════════════════════════════════════════════════ */
.nav {
position: fixed;
top: 0;
left: 0;
right: 0;
z-index: 1000;
padding: 1.2rem 0;
transition: all var(--transition);
}
.nav.scrolled {
background: rgba(255,255,255,0.95);
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
box-shadow: 0 1px 30px rgba(0,0,0,0.06);
padding: 0.8rem 0;
}
.nav__inner {
display: flex;
align-items: center;
justify-content: space-between;
max-width: var(--max-width);
margin: 0 auto;
padding: 0 2rem;
}
.nav__logo {
display: flex;
align-items: center;
gap: 0.6rem;
font-size: 1.25rem;
font-weight: 700;
color: var(--text);
z-index: 1001;
}
.nav__logo img, .nav__logo svg { flex-shrink: 0; }
.nav__links {
display: flex;
align-items: center;
gap: 2.5rem;
}
.nav__links a {
font-size: 0.9rem;
font-weight: 500;
color: var(--text-muted);
transition: color var(--transition);
position: relative;
}
.nav__links a:hover { color: var(--text); }
.nav__links a::after {
content: '';
position: absolute;
bottom: -4px;
left: 0;
width: 0;
height: 2px;
background: var(--orange);
transition: width var(--transition);
}
.nav__links a:hover::after { width: 100%; }
.nav__actions {
display: flex;
align-items: center;
gap: 1.5rem;
}
.nav__login {
font-size: 0.9rem;
font-weight: 500;
color: var(--text-muted);
transition: color var(--transition);
}
.nav__login:hover { color: var(--text); }
.nav__cta {
padding: 0.6rem 1.5rem;
font-size: 0.85rem;
font-weight: 600;
border: 2px solid var(--text);
border-radius: 60px;
color: var(--text);
transition: all var(--transition);
}
.nav__cta:hover {
background: var(--text);
color: #fff;
}
.nav__burger {
display: none;
flex-direction: column;
gap: 5px;
z-index: 1001;
padding: 4px;
}
.nav__burger span {
display: block;
width: 24px;
height: 2px;
background: var(--text);
border-radius: 2px;
transition: all var(--transition);
}
.nav__burger.active span:nth-child(1) { transform: rotate(45deg) translate(5px, 5px); }
.nav__burger.active span:nth-child(2) { opacity: 0; }
.nav__burger.active span:nth-child(3) { transform: rotate(-45deg) translate(5px, -5px); }
/* Mobile menu */
.nav__mobile {
display: none;
position: fixed;
inset: 0;
background: rgba(255,255,255,0.98);
backdrop-filter: blur(20px);
flex-direction: column;
align-items: center;
justify-content: center;
gap: 2rem;
z-index: 999;
}
.nav__mobile.open { display: flex; }
.nav__mobile a {
font-size: 1.5rem;
font-weight: 600;
color: var(--text);
}
/* ═══════════════════════════════════════════════════
HERO
═══════════════════════════════════════════════════ */
.hero {
padding: 10rem 0 6rem;
position: relative;
overflow: hidden;
min-height: 90vh;
display: flex;
align-items: center;
}
.hero__bg {
position: absolute;
top: -10%;
right: -15%;
width: 700px;
height: 700px;
opacity: 0.06;
pointer-events: none;
}
.hero__dot-grid {
position: absolute;
top: 15%;
right: 5%;
width: 200px;
height: 200px;
background-image: radial-gradient(circle, var(--orange) 1px, transparent 1px);
background-size: 20px 20px;
opacity: 0.12;
pointer-events: none;
}
.hero__content { position: relative; z-index: 1; max-width: 720px; }
.hero h1 { margin-bottom: 1.5rem; }
.hero p { font-size: 1.15rem; margin-bottom: 2.5rem; line-height: 1.8; }
.hero__btns { display: flex; gap: 1rem; flex-wrap: wrap; }
/* ═══════════════════════════════════════════════════
WAVE DIVIDER
═══════════════════════════════════════════════════ */
.wave-divider {
width: 100%;
overflow: hidden;
line-height: 0;
margin-top: -1px;
}
.wave-divider svg {
display: block;
width: 100%;
height: 50px;
}
.wave-divider--flip { transform: scaleY(-1); margin-bottom: -1px; margin-top: 0; }
/* ═══════════════════════════════════════════════════
FEATURES
═══════════════════════════════════════════════════ */
.features__header { max-width: 600px; margin-bottom: 4rem; }
.features__grid {
display: grid;
grid-template-columns: repeat(3, 1fr);
gap: 1.5rem;
}
.feature-card {
background: var(--bg-card);
border-radius: var(--radius-lg);
padding: 2.5rem 2rem;
transition: all var(--transition);
border: 1px solid rgba(0,0,0,0.04);
position: relative;
overflow: hidden;
}
.feature-card::before {
content: '';
position: absolute;
top: 0;
left: 0;
width: 4px;
height: 0;
background: linear-gradient(to bottom, var(--gold), var(--orange), var(--amber));
transition: height 0.4s ease;
border-radius: 0 0 4px 0;
}
.feature-card:hover {
transform: translateY(-4px);
box-shadow: var(--shadow-lg);
}
.feature-card:hover::before { height: 100%; }
.feature-card__icon {
width: 56px;
height: 56px;
border-radius: 14px;
background: var(--orange-soft);
display: flex;
align-items: center;
justify-content: center;
margin-bottom: 1.5rem;
}
.feature-card__icon svg { width: 28px; height: 28px; color: var(--orange); }
.feature-card h3 { margin-bottom: 0.75rem; color: var(--text); }
.feature-card p { font-size: 0.9rem; line-height: 1.7; margin-bottom: 1.25rem; }
.feature-card__link {
font-size: 0.85rem;
font-weight: 600;
color: var(--orange);
display: inline-flex;
align-items: center;
gap: 0.3rem;
transition: gap var(--transition);
}
.feature-card__link:hover { gap: 0.6rem; }
/* Bottom row: 2 cards centered */
.features__grid .feature-card:nth-child(4) { grid-column: 1 / 2; }
.features__grid .feature-card:nth-child(5) { grid-column: 2 / 3; }
/* ═══════════════════════════════════════════════════
HOW IT WORKS
═══════════════════════════════════════════════════ */
.steps { padding: 7rem 0; }
.steps__header { max-width: 500px; margin: 0 auto 5rem; text-align: center; }
.steps__grid {
display: grid;
grid-template-columns: repeat(3, 1fr);
gap: 2rem;
position: relative;
}
.steps__line {
position: absolute;
top: 40px;
left: 16.66%;
right: 16.66%;
height: 2px;
background: linear-gradient(90deg, var(--gold), var(--orange), var(--amber));
opacity: 0.3;
}
.step {
text-align: center;
position: relative;
z-index: 1;
}
.step__number {
width: 80px;
height: 80px;
border-radius: 50%;
background: linear-gradient(135deg, var(--orange), var(--amber));
color: #fff;
font-size: 1.75rem;
font-weight: 700;
display: flex;
align-items: center;
justify-content: center;
margin: 0 auto 1.5rem;
box-shadow: var(--shadow-orange);
}
.step h3 { margin-bottom: 0.5rem; }
.step p { font-size: 0.9rem; margin: 0 auto; }
/* ═══════════════════════════════════════════════════
WHO IT'S FOR
═══════════════════════════════════════════════════ */
.audiences__header { max-width: 500px; margin-bottom: 4rem; }
.audiences__grid {
display: grid;
grid-template-columns: repeat(4, 1fr);
gap: 1.5rem;
}
.audience-card {
background: var(--bg-card);
border-radius: var(--radius-lg);
padding: 2.5rem 1.5rem;
text-align: center;
transition: all var(--transition);
border: 1px solid rgba(0,0,0,0.04);
}
.audience-card:hover {
transform: translateY(-4px);
box-shadow: var(--shadow-lg);
}
.audience-card__icon {
width: 64px;
height: 64px;
border-radius: 50%;
background: var(--orange-soft);
display: flex;
align-items: center;
justify-content: center;
margin: 0 auto 1.25rem;
}
.audience-card__icon svg { width: 28px; height: 28px; color: var(--amber); }
.audience-card h3 { font-size: 1.05rem; margin-bottom: 0.5rem; }
.audience-card p { font-size: 0.85rem; margin: 0 auto; }
/* ═══════════════════════════════════════════════════
SOCIAL PROOF / TESTIMONIAL
═══════════════════════════════════════════════════ */
.proof { padding: 6rem 0; }
.proof__quote {
max-width: 700px;
margin: 0 auto 4rem;
text-align: center;
}
.proof__quote-icon {
font-size: 4rem;
line-height: 1;
color: var(--orange);
opacity: 0.5;
margin-bottom: 1rem;
font-family: Georgia, serif;
}
.proof__quote blockquote {
font-size: 1.3rem;
line-height: 1.7;
color: #E2E8F0;
font-weight: 300;
margin-bottom: 1.5rem;
font-style: italic;
}
.proof__author { font-size: 0.9rem; font-weight: 600; color: #fff; }
.proof__author span { color: var(--orange); }
/* Testimonial Carousel */
.proof__carousel {
max-width: 750px;
margin: 0 auto 4rem;
overflow: hidden;
position: relative;
}
.proof__track {
display: flex;
transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
.proof__slide {
flex: 0 0 auto;
text-align: center;
padding: 0 1rem;
box-sizing: border-box;
}
.proof__slide .proof__quote-icon {
font-size: 4rem;
line-height: 1;
color: var(--orange);
opacity: 0.5;
margin-bottom: 1rem;
font-family: Georgia, serif;
}
.proof__slide blockquote {
font-size: 1.3rem;
line-height: 1.7;
color: #E2E8F0;
font-weight: 300;
font-style: italic;
margin-bottom: 0;
}
.proof__dots {
display: flex;
justify-content: center;
gap: 0.5rem;
margin-top: 2rem;
}
.proof__dot {
width: 10px;
height: 10px;
border-radius: 50%;
background: rgba(255,255,255,0.2);
border: none;
cursor: pointer;
transition: all var(--transition);
padding: 0;
}
.proof__dot.active {
background: var(--orange);
transform: scale(1.2);
}
.proof__dot:hover { background: rgba(255,255,255,0.4); }
.proof__dot.active:hover { background: var(--orange); }
.proof__stats {
display: grid;
grid-template-columns: repeat(3, 1fr);
gap: 2rem;
max-width: 800px;
margin: 0 auto;
padding-top: 4rem;
border-top: 1px solid rgba(255,255,255,0.08);
}
.stat { text-align: center; }
.stat__number {
font-size: clamp(2.2rem, 4vw, 3rem);
font-weight: 800;
background: linear-gradient(135deg, var(--gold), var(--orange));
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
background-clip: text;
line-height: 1.2;
margin-bottom: 0.25rem;
}
.stat__label { font-size: 0.9rem; color: var(--text-light); }
/* ═══════════════════════════════════════════════════
PRICING
═══════════════════════════════════════════════════ */
.pricing__header {
max-width: 600px;
margin: 0 auto 4rem;
text-align: center;
}
.pricing__grid {
display: grid;
grid-template-columns: repeat(2, 1fr);
gap: 2rem;
max-width: 820px;
margin: 0 auto;
}
.price-card {
border-radius: var(--radius-lg);
padding: 3rem 2.5rem;
transition: all var(--transition);
position: relative;
}
.price-card--free {
background: var(--bg-card);
border: 1px solid rgba(0,0,0,0.06);
}
.price-card--standard {
background: var(--charcoal);
color: #fff;
box-shadow: var(--shadow-lg);
}
.price-card__badge {
position: absolute;
top: -14px;
left: 50%;
transform: translateX(-50%);
background: linear-gradient(135deg, var(--orange), var(--amber));
color: #fff;
font-size: 0.75rem;
font-weight: 700;
padding: 0.4rem 1.2rem;
border-radius: 60px;
letter-spacing: 0.05em;
text-transform: uppercase;
white-space: nowrap;
}
.price-card__name {
font-size: 1.1rem;
font-weight: 600;
margin-bottom: 0.25rem;
}
.price-card--standard .price-card__name { color: var(--orange); }
.price-card__subtitle {
font-size: 0.85rem;
color: var(--text-muted);
margin-bottom: 1.5rem;
}
.price-card--standard .price-card__subtitle { color: #94A3B8; }
.price-card__price {
font-size: 3rem;
font-weight: 800;
line-height: 1;
margin-bottom: 0.25rem;
}
.price-card--standard .price-card__price {
background: linear-gradient(135deg, var(--gold), var(--orange));
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
background-clip: text;
}
.price-card__period {
font-size: 0.85rem;
color: var(--text-muted);
margin-bottom: 2rem;
}
.price-card--standard .price-card__period { color: #94A3B8; }
.price-card__features {
list-style: none;
margin-bottom: 2rem;
}
.price-card__features li {
padding: 0.6rem 0;
font-size: 0.9rem;
display: flex;
align-items: center;
gap: 0.75rem;
border-bottom: 1px solid rgba(0,0,0,0.04);
}
.price-card--standard .price-card__features li { border-color: rgba(255,255,255,0.06); color: #CBD5E1; }
.price-card__features li .check { color: #22C55E; font-weight: 700; font-size: 1.1rem; }
.price-card__features li .cross { color: #EF4444; font-weight: 700; font-size: 1.1rem; }
.price-card .btn { width: 100%; justify-content: center; }
/* ═══════════════════════════════════════════════════
FIND ORGANISATION
═══════════════════════════════════════════════════ */
.find-org { padding: 5rem 0; }
.find-org__inner {
max-width: 700px;
margin: 0 auto;
text-align: center;
}
.find-org h2 { margin-bottom: 1rem; }
.find-org p { margin: 0 auto 2.5rem; }
.find-org__search {
display: flex;
align-items: center;
gap: 0;
background: var(--bg-card);
border: 2px solid rgba(0,0,0,0.08);
border-radius: 60px;
padding: 0.5rem 0.5rem 0.5rem 1.5rem;
max-width: 520px;
margin: 0 auto;
transition: border-color var(--transition), box-shadow var(--transition);
}
.find-org__search:focus-within {
border-color: var(--orange);
box-shadow: 0 0 0 4px rgba(255,152,0,0.1);
}
.find-org__search svg {
flex-shrink: 0;
width: 20px;
height: 20px;
color: var(--text-muted);
margin-right: 0.75rem;
}
.find-org__search input {
flex: 1;
border: none;
outline: none;
font-family: var(--font);
font-size: 0.95rem;
color: var(--text);
background: transparent;
}
.find-org__search input::placeholder { color: var(--text-light); }
.find-org__search button {
padding: 0.7rem 1.5rem;
font-size: 0.85rem;
font-weight: 600;
border-radius: 60px;
background: linear-gradient(135deg, var(--orange), var(--amber));
color: #fff;
transition: all var(--transition);
white-space: nowrap;
}
.find-org__search button:hover { box-shadow: var(--shadow-orange); }
/* ═══════════════════════════════════════════════════
CTA SECTION
═══════════════════════════════════════════════════ */
.cta-section {
padding: 6rem 0;
text-align: center;
position: relative;
overflow: hidden;
}
.cta-section__bg {
position: absolute;
top: 50%;
left: 50%;
transform: translate(-50%, -50%);
width: 600px;
height: 600px;
background: radial-gradient(circle, rgba(255,152,0,0.08), transparent 70%);
pointer-events: none;
}
.cta-section h2 { margin-bottom: 1rem; color: #fff; }
.cta-section p { margin: 0 auto 2.5rem; }
.cta-section__btns { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
/* ═══════════════════════════════════════════════════
FOOTER
═══════════════════════════════════════════════════ */
.footer {
background: #0B0F1A;
color: #94A3B8;
padding: 4rem 0 2rem;
}
.footer__grid {
display: grid;
grid-template-columns: 2fr 1fr 1fr 1fr;
gap: 3rem;
margin-bottom: 3rem;
}
.footer__brand p { font-size: 0.85rem; line-height: 1.8; margin-top: 1rem; color: #64748B; max-width: 280px; }
.footer__heading {
font-size: 0.85rem;
font-weight: 600;
color: #fff;
margin-bottom: 1.25rem;
text-transform: uppercase;
letter-spacing: 0.08em;
}
.footer ul li { margin-bottom: 0.6rem; }
.footer ul li a {
font-size: 0.85rem;
color: #64748B;
transition: color var(--transition);
}
.footer ul li a:hover { color: var(--orange); }
.footer__social {
display: flex;
gap: 1rem;
margin-top: 1rem;
}
.footer__social a {
width: 40px;
height: 40px;
border-radius: 50%;
background: rgba(255,255,255,0.05);
display: flex;
align-items: center;
justify-content: center;
transition: all var(--transition);
}
.footer__social a:hover { background: var(--orange); }
.footer__social svg { width: 18px; height: 18px; color: #94A3B8; }
.footer__social a:hover svg { color: #fff; }
.footer__bottom {
padding-top: 2rem;
border-top: 1px solid rgba(255,255,255,0.06);
display: flex;
justify-content: space-between;
align-items: center;
font-size: 0.8rem;
color: #475569;
}
.footer__bottom a { color: #64748B; transition: color var(--transition); }
.footer__bottom a:hover { color: var(--orange); }
/* ═══════════════════════════════════════════════════
SCROLL REVEAL ANIMATIONS
═══════════════════════════════════════════════════ */
.reveal {
opacity: 0;
transform: translateY(30px);
transition: opacity 0.7s ease, transform 0.7s ease;
}
.reveal.visible {
opacity: 1;
transform: translateY(0);
}
.reveal-delay-1 { transition-delay: 0.1s; }
.reveal-delay-2 { transition-delay: 0.2s; }
.reveal-delay-3 { transition-delay: 0.3s; }
.reveal-delay-4 { transition-delay: 0.35s; }
.reveal-delay-5 { transition-delay: 0.4s; }
/* Stagger children */
.stagger-children .reveal:nth-child(1) { transition-delay: 0s; }
.stagger-children .reveal:nth-child(2) { transition-delay: 0.1s; }
.stagger-children .reveal:nth-child(3) { transition-delay: 0.2s; }
.stagger-children .reveal:nth-child(4) { transition-delay: 0.3s; }
.stagger-children .reveal:nth-child(5) { transition-delay: 0.4s; }
/* ═══════════════════════════════════════════════════
RESPONSIVE
═══════════════════════════════════════════════════ */
@media (max-width: 1024px) {
.features__grid { grid-template-columns: repeat(2, 1fr); }
.features__grid .feature-card:nth-child(4),
.features__grid .feature-card:nth-child(5) { grid-column: auto; }
.audiences__grid { grid-template-columns: repeat(2, 1fr); }
.footer__grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) {
.section { padding: 5rem 0; }
.hero { padding: 8rem 0 4rem; min-height: auto; }
.nav__links, .nav__actions { display: none; }
.nav__burger { display: flex; }
.steps__grid { grid-template-columns: 1fr; gap: 3rem; }
.steps__line { display: none; }
.pricing__grid { grid-template-columns: 1fr; max-width: 420px; }
.proof__stats { grid-template-columns: 1fr; gap: 1.5rem; }
.features__grid { grid-template-columns: 1fr; }
.audiences__grid { grid-template-columns: 1fr; }
.footer__grid { grid-template-columns: 1fr; gap: 2rem; }
.footer__bottom { flex-direction: column; gap: 0.75rem; text-align: center; }
.find-org__search { flex-direction: column; border-radius: var(--radius-lg); padding: 1rem; }
.find-org__search input { width: 100%; text-align: center; padding: 0.5rem; }
.find-org__search svg { display: none; }
.find-org__search button { width: 100%; }
.hero__btns { flex-direction: column; align-items: flex-start; }
.cta-section__btns { flex-direction: column; align-items: center; }
}
@media (max-width: 480px) {
.container { padding: 0 1.25rem; }
.hero { padding: 7rem 0 3rem; }
.hero__dot-grid { display: none; }
}
</style>
</head>
<body>
<!-- ═══════════════════════════════════════════════════
NAVIGATION
═══════════════════════════════════════════════════ -->
<nav class="nav" id="nav">
<div class="nav__inner">
<a href="#" class="nav__logo">
<img src="https://itsplainsailing.com/shared/img/ips-logo-sails-transparent-64.png" alt="ItsPlainSailing" width="32" height="32">
ItsPlainSailing
</a>
<div class="nav__links">
<a href="#features">Features</a>
<a href="#examples">Examples</a>
<a href="#pricing">Pricing</a>
<a href="#contact">Contact</a>
</div>
<div class="nav__actions">
<a href="#" class="nav__login">Login</a>
<a href="#signup" class="nav__cta">Sign Up</a>
</div>
<button class="nav__burger" id="burger" aria-label="Toggle menu">
<span></span><span></span><span></span>
</button>
</div>
</nav>
<!-- Mobile menu -->
<div class="nav__mobile" id="mobileMenu">
<a href="#features" class="mobile-link">Features</a>
<a href="#examples" class="mobile-link">Examples</a>
<a href="#pricing" class="mobile-link">Pricing</a>
<a href="#contact" class="mobile-link">Contact</a>
<a href="#" class="btn btn--primary" style="margin-top:1rem">Sign Up</a>
</div>
<!-- ═══════════════════════════════════════════════════
HERO
═══════════════════════════════════════════════════ -->
<section class="hero">
<div class="hero__dot-grid"></div>
<div class="hero__bg">
<svg viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M200 580C200 580,120 300,220 30C230 60,300 320,260 580Z" fill="#FFC107"/>
<path d="M300 580C300 580,220 250,320 10C330 50,400 270,360 580Z" fill="#FF9800"/>
<path d="M400 580C400 580,320 280,420 40C430 70,500 290,460 580Z" fill="#E65100"/>
</svg>
</div>
<div class="container">
<div class="hero__content">
<h1 class="reveal">Online Payments<br>Made <span class="gradient-text">Easy</span></h1>
<p class="reveal reveal-delay-1">Manage your events, memberships, merchandise and calendar-based bookings online — all in one place, with card payments deposited directly into your account.</p>
<div class="hero__btns reveal reveal-delay-2">
<a href="#signup" class="btn btn--primary">Get Started Free &rarr;</a>
<a href="#examples" class="btn btn--outline">See Examples</a>
</div>
</div>
</div>
</section>
<!-- ═══════════════════════════════════════════════════
FEATURES
═══════════════════════════════════════════════════ -->
<section class="section section--warm" id="features">
<div class="container">
<div class="features__header reveal">
<span class="section-label">Features</span>
<h2>A Flexible <span class="gradient-text">Solution</span></h2>
<p style="margin-top:1rem">Everything your organisation needs to collect payments and manage activities online.</p>
</div>
<div class="features__grid stagger-children">
<!-- Events -->
<div class="feature-card reveal">
<div class="feature-card__icon">
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
</div>
<h3>Events</h3>
<p>Collect applications and payments for your events online. Card payments are deposited directly into your bank account.</p>
<a href="#" class="feature-card__link">Learn more <span>&rarr;</span></a>
</div>
<!-- Ticketing -->
<div class="feature-card reveal">
<div class="feature-card__icon">
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M2 9a3 3 0 016 0v6a3 3 0 01-6 0V9zM16 3a3 3 0 016 0v6a3 3 0 01-6 0V3z" transform="rotate(45 12 12)"/><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M9 6v12M15 6v12"/></svg>
</div>
<h3>Ticketing</h3>
<p>Issue electronic tickets with QR codes. Scan tickets at your event entrance with our custom scanning app.</p>
<a href="#" class="feature-card__link">Learn more <span>&rarr;</span></a>
</div>
<!-- Merchandise -->
<div class="feature-card reveal">
<div class="feature-card__icon">
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>
</div>
<h3>Merchandise</h3>
<p>Sell products and services online with delivery options, stock management, and a quick setup process.</p>
<a href="#" class="feature-card__link">Learn more <span>&rarr;</span></a>
</div>
<!-- Calendar Bookings -->
<div class="feature-card reveal">
<div class="feature-card__icon">
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
</div>
<h3>Calendar Bookings</h3>
<p>Create calendars for classes, courts, arenas, facilities and more. Let people select and book specific time slots.</p>
<a href="#" class="feature-card__link">Learn more <span>&rarr;</span></a>
</div>
<!-- Membership -->
<div class="feature-card reveal">
<div class="feature-card__icon">
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
</div>
<h3>Membership</h3>
<p>Manage new and renewing membership applications and payments with a secure, centralised member database.</p>
<a href="#" class="feature-card__link">Learn more <span>&rarr;</span></a>
</div>
</div>
</div>
</section>
<!-- ═══════════════════════════════════════════════════
HOW IT WORKS
═══════════════════════════════════════════════════ -->
<section class="steps" id="how">
<div class="container">
<div class="steps__header reveal">
<span class="section-label">How It Works</span>
<h2>Up and Running<br>in <span class="gradient-text">Minutes</span></h2>
</div>
<div class="steps__grid">
<div class="steps__line"></div>
<div class="step reveal">
<div class="step__number">1</div>
<h3>Sign Up Free</h3>
<p>Create your account in under a minute. No credit card required to get started.</p>
</div>
<div class="step reveal reveal-delay-2">
<div class="step__number">2</div>
<h3>Set Up Your Page</h3>
<p>Add your events, products, bookings or memberships using our simple setup tools.</p>
</div>
<div class="step reveal reveal-delay-3">
<div class="step__number">3</div>
<h3>Accept Payments</h3>
<p>Share your page and start collecting payments online via Stripe. It's that simple.</p>
</div>
</div>
</div>
</section>
<!-- ═══════════════════════════════════════════════════
WHO IT'S FOR
═══════════════════════════════════════════════════ -->
<section class="section section--warm" id="examples">
<div class="container">
<div class="audiences__header reveal">
<span class="section-label">Who It's For</span>
<h2>Built for <span class="gradient-text">Organisations</span></h2>
<p style="margin-top:1rem">From sports clubs to schools, community groups to small businesses.</p>
</div>
<div class="audiences__grid stagger-children">
<div class="audience-card reveal">
<div class="audience-card__icon">
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
</div>
<h3>Sports Clubs</h3>
<p>Memberships, events, match fees and merchandise all in one place.</p>
</div>
<div class="audience-card reveal">
<div class="audience-card__icon">
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
</div>
<h3>Small Businesses</h3>
<p>Sell online, take bookings and manage your calendar with ease.</p>
</div>
<div class="audience-card reveal">
<div class="audience-card__icon">
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
</div>
<h3>Schools</h3>
<p>Collect payments for trips, events, books, uniforms and activities.</p>
</div>
<div class="audience-card reveal">
<div class="audience-card__icon">
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
</div>
<h3>Community Groups</h3>
<p>Fundraising, event management and group membership made simple.</p>
</div>
</div>
</div>
</section>
<!-- ═══════════════════════════════════════════════════
SOCIAL PROOF
═══════════════════════════════════════════════════ -->
<section class="section section--gradient proof">
<div class="container">
<div class="proof__carousel reveal" id="testimonialCarousel">
<div class="proof__track" id="testimonialTrack">
<div class="proof__slide">
<div class="proof__quote-icon">&ldquo;</div>
<blockquote>It proved very popular with our members who liked the idea of making a booking at a time of day that suited them</blockquote>
</div>
<div class="proof__slide">
<div class="proof__quote-icon">&ldquo;</div>
<blockquote>The huge administration workload involved in hosting the event is now miniscule &mdash; the parents are doing the typing</blockquote>
</div>
<div class="proof__slide">
<div class="proof__quote-icon">&ldquo;</div>
<blockquote>At month end and year end I am no longer chasing payments.</blockquote>
</div>
<div class="proof__slide">
<div class="proof__quote-icon">&ldquo;</div>
<blockquote>The online system has halved my workload as Secretary of our club. I spend at least 75% less time on renewals</blockquote>
</div>
<div class="proof__slide">
<div class="proof__quote-icon">&ldquo;</div>
<blockquote>The team at ItsPlainSailing provide terrific support and are always eager to listen to suggestions</blockquote>
</div>
<div class="proof__slide">
<div class="proof__quote-icon">&ldquo;</div>
<blockquote>For our club, the system has dramatically reduced the workload on our branch officials</blockquote>
</div>
<div class="proof__slide">
<div class="proof__quote-icon">&ldquo;</div>
<blockquote>The online entry system ensured that those who entered early were guaranteed their spot</blockquote>
</div>
</div>
<div class="proof__dots" id="testimonialDots">
<button class="proof__dot active" aria-label="Testimonial 1"></button>
<button class="proof__dot" aria-label="Testimonial 2"></button>
<button class="proof__dot" aria-label="Testimonial 3"></button>
<button class="proof__dot" aria-label="Testimonial 4"></button>
<button class="proof__dot" aria-label="Testimonial 5"></button>
<button class="proof__dot" aria-label="Testimonial 6"></button>
<button class="proof__dot" aria-label="Testimonial 7"></button>
</div>
</div>
<div class="proof__stats">
<div class="stat reveal">
<div class="stat__number" data-count="500">0</div>
<div class="stat__label">Organisations</div>
</div>
<div class="stat reveal reveal-delay-1">
<div class="stat__number" data-count="10000">0</div>
<div class="stat__label">Events Managed</div>
</div>
<div class="stat reveal reveal-delay-2">
<div class="stat__number" data-count="1" data-prefix="€" data-suffix="M+">0</div>
<div class="stat__label">Payments Processed</div>
</div>
</div>
</div>
</section>
<!-- ═══════════════════════════════════════════════════
PRICING
═══════════════════════════════════════════════════ -->
<section class="section" id="pricing">
<div class="container">
<div class="pricing__header reveal">
<span class="section-label">Pricing</span>
<h2>Simple, Transparent <span class="gradient-text">Pricing</span></h2>
<p style="margin-top:1rem">Start free and upgrade when you're ready for online payments. No hidden fees, no subscriptions.</p>
</div>
<div class="pricing__grid">
<!-- Free Plan -->
<div class="price-card price-card--free reveal">
<div class="price-card__name">Free Plan</div>
<div class="price-card__subtitle">Offline Payments Only</div>
<div class="price-card__price">€0</div>
<div class="price-card__period">Free forever</div>
<ul class="price-card__features">
<li><span class="check">&#10003;</span> Event Entries</li>
<li><span class="check">&#10003;</span> Merchandise Selling</li>
<li><span class="check">&#10003;</span> Membership Applications</li>
<li><span class="check">&#10003;</span> Calendar Based Bookings</li>
<li><span class="check">&#10003;</span> Best Effort Support</li>
<li><span class="cross">&#10005;</span> Credit / Debit Card Payments</li>
</ul>
<a href="#signup" class="btn btn--outline">Get Started</a>
</div>
<!-- Standard Plan -->
<div class="price-card price-card--standard reveal reveal-delay-1">
<div class="price-card__badge">Most Popular</div>
<div class="price-card__name">Standard Plan</div>
<div class="price-card__subtitle">Online Payments via Stripe</div>
<div class="price-card__price">60c</div>
<div class="price-card__period">Per card payment &middot; No setup cost</div>
<ul class="price-card__features">
<li><span class="check">&#10003;</span> Event Entries</li>
<li><span class="check">&#10003;</span> Merchandise Selling</li>
<li><span class="check">&#10003;</span> Membership Applications</li>
<li><span class="check">&#10003;</span> Calendar Based Bookings</li>
<li><span class="check">&#10003;</span> Standard Support</li>
<li><span class="check">&#10003;</span> Credit / Debit Card Payments</li>
</ul>
<a href="#signup" class="btn btn--primary">Start Free Trial</a>
</div>
</div>
</div>
</section>
<!-- ═══════════════════════════════════════════════════
FIND ORGANISATION
═══════════════════════════════════════════════════ -->
<section class="section section--warm find-org">
<div class="container">
<div class="find-org__inner reveal">
<span class="section-label">Find</span>
<h2>Find Your Organisation</h2>
<p>Already know your organisation uses ItsPlainSailing? Start typing their name below to go directly to their page.</p>
<div class="find-org__search">
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
<input type="text" placeholder="Start typing your organisation's name..." aria-label="Search for an organisation">
<button>Search</button>
</div>
</div>
</div>
</section>
<!-- ═══════════════════════════════════════════════════
CTA
═══════════════════════════════════════════════════ -->
<section class="section section--gradient cta-section" id="signup">
<div class="cta-section__bg"></div>
<div class="container" style="position:relative;z-index:1">
<div class="reveal">
<h2>Ready to Get <span class="gradient-text">Started</span>?</h2>
<p style="color:#94A3B8; margin: 0 auto 2.5rem;">Join hundreds of organisations already using ItsPlainSailing. It's free to set up, takes minutes, and there's no commitment.</p>
<div class="cta-section__btns">
<a href="#" class="btn btn--primary">Sign Up Free &rarr;</a>
<a href="#contact" class="btn btn--outline-light">Get In Touch</a>
</div>
</div>
</div>
</section>
<!-- ═══════════════════════════════════════════════════
FOOTER
═══════════════════════════════════════════════════ -->
<footer class="footer" id="contact">
<div class="container">
<div class="footer__grid">
<div class="footer__brand">
<a href="#" class="nav__logo" style="color:#fff;margin-bottom:0.5rem">
<img src="https://itsplainsailing.com/shared/img/ips-logo-sails-transparent-64.png" alt="ItsPlainSailing" width="28" height="28">
ItsPlainSailing
</a>
<p>Online payments made easy for organisations. Built by Esker Software Ltd.</p>
<div class="footer__social">
<a href="#" aria-label="Facebook">
<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
</a>
<a href="#" aria-label="Twitter">
<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
</a>
<a href="#" aria-label="YouTube">
<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
</a>
</div>
</div>
<div>
<div class="footer__heading">Product</div>
<ul>
<li><a href="#features">Features</a></li>
<li><a href="#pricing">Pricing</a></li>
<li><a href="#examples">Examples</a></li>
<li><a href="#how">How It Works</a></li>
</ul>
</div>
<div>
<div class="footer__heading">Support</div>
<ul>
<li><a href="mailto:support@eskersoft.com">support@eskersoft.com</a></li>
<li><a href="mailto:info@eskersoft.com">info@eskersoft.com</a></li>
<li><a href="#">Help Centre</a></li>
</ul>
</div>
<div>
<div class="footer__heading">Company</div>
<ul>
<li><a href="#">Esker Software Ltd.</a></li>
<li>Laragh, Maynooth</li>
<li>Co. Kildare, Ireland</li>
<li style="margin-top:0.5rem"><a href="#">Privacy Policy</a></li>
</ul>
</div>
</div>
<div class="footer__bottom">
<span>&copy; 2026 <a href="https://eskersoft.com">EskerSoft.com</a>. All rights reserved.</span>
<div>
<a href="#">Privacy</a> &middot; <a href="#">Terms</a>
</div>
</div>
</div>
</footer>
<!-- ═══════════════════════════════════════════════════
JAVASCRIPT
═══════════════════════════════════════════════════ -->
<script>
(function() {
'use strict';
/* ── Scroll Reveal ── */
const revealObserver = new IntersectionObserver((entries) => {
entries.forEach(entry => {
if (entry.isIntersecting) {
entry.target.classList.add('visible');
revealObserver.unobserve(entry.target);
}
});
}, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });
/* Immediately reveal hero elements, observe the rest */
document.querySelectorAll('.reveal').forEach(el => {
if (el.closest('.hero')) {
setTimeout(() => el.classList.add('visible'), 100);
} else {
revealObserver.observe(el);
}
});
/* ── Nav scroll effect ── */
const nav = document.getElementById('nav');
let lastScroll = 0;
window.addEventListener('scroll', () => {
const current = window.scrollY;
nav.classList.toggle('scrolled', current > 60);
lastScroll = current;
}, { passive: true });
/* ── Mobile menu ── */
const burger = document.getElementById('burger');
const mobileMenu = document.getElementById('mobileMenu');
burger.addEventListener('click', () => {
burger.classList.toggle('active');
mobileMenu.classList.toggle('open');
document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
});
document.querySelectorAll('.mobile-link').forEach(link => {
link.addEventListener('click', () => {
burger.classList.remove('active');
mobileMenu.classList.remove('open');
document.body.style.overflow = '';
});
});
/* ── Smooth scroll for anchor links ── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
anchor.addEventListener('click', function(e) {
const target = document.querySelector(this.getAttribute('href'));
if (target) {
e.preventDefault();
target.scrollIntoView({ behavior: 'smooth' });
}
});
});
/* ── Stats counter animation ── */
const counters = document.querySelectorAll('.stat__number[data-count]');
const counterObserver = new IntersectionObserver((entries) => {
entries.forEach(entry => {
if (entry.isIntersecting) {
const el = entry.target;
const target = parseInt(el.dataset.count);
const prefix = el.dataset.prefix || '';
const suffix = el.dataset.suffix || '+';
const duration = 2000;
const start = performance.now();
function update(now) {
const progress = Math.min((now - start) / duration, 1);
const eased = 1 - Math.pow(1 - progress, 3);
const current = Math.floor(eased * target);
el.textContent = prefix + current.toLocaleString() + suffix;
if (progress < 1) requestAnimationFrame(update);
}
requestAnimationFrame(update);
counterObserver.unobserve(el);
}
});
}, { threshold: 0.5 });
counters.forEach(c => counterObserver.observe(c));
/* ── Testimonial Carousel ── */
const track = document.getElementById('testimonialTrack');
const dots = document.querySelectorAll('.proof__dot');
const carousel = document.getElementById('testimonialCarousel');
const slides = track ? track.querySelectorAll('.proof__slide') : [];
const slideCount = dots.length;
let currentSlide = 0;
let autoplayInterval;
let isPaused = false;
/* Size slides to match carousel width (avoids CSS % resolution quirks) */
function sizeSlides() {
if (!carousel || !track) return;
const w = carousel.offsetWidth;
slides.forEach(s => { s.style.width = w + 'px'; });
track.style.transform = 'translateX(-' + (currentSlide * w) + 'px)';
}
sizeSlides();
window.addEventListener('resize', sizeSlides);
function goToSlide(index) {
currentSlide = index;
const w = carousel.offsetWidth;
track.style.transform = 'translateX(-' + (currentSlide * w) + 'px)';
dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));
}
function nextSlide() {
goToSlide((currentSlide + 1) % slideCount);
}
function startAutoplay() {
autoplayInterval = setInterval(() => {
if (!isPaused) nextSlide();
}, 5000);
}
dots.forEach((dot, i) => {
dot.addEventListener('click', () => {
goToSlide(i);
clearInterval(autoplayInterval);
startAutoplay();
});
});
if (carousel) {
carousel.addEventListener('mouseenter', () => { isPaused = true; });
carousel.addEventListener('mouseleave', () => { isPaused = false; });
}
startAutoplay();
})();
</script>
</body>
</html>

---

**Assistant:**

I can definitely create a new theme based on that HTML/CSS! This is a beautiful warm, modern design with orange/gold gradients. I'll create it as an alternative theme that you can easily switch between.

Let me create the new theme files:

Perfect! Now let me read the current theme:

Perfect! Now I'll create the new warm/orange theme and a theme switcher. Let me create the files:

Now let me create an index file that exports both themes and makes it easy to switch:

Now let me update the main.tsx to use the new theme export:

Now let me check if there's a similar theme file structure for the admin package:

---
