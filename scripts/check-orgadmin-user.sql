-- Check if there are any org-admin users
SELECT 
    ou.id,
    ou.email,
    ou.first_name,
    ou.last_name,
    ou.keycloak_user_id,
    ou.user_type,
    ou.status,
    o.name as organization_name,
    o.display_name as organization_display_name
FROM organization_users ou
INNER JOIN organizations o ON ou.organization_id = o.id
WHERE ou.user_type = 'org-admin'
ORDER BY ou.created_at DESC;

-- If no users exist, you'll need to create one
-- First, find your Keycloak user ID by logging into Keycloak admin console
-- Then run something like:
-- 
-- INSERT INTO organization_users (
--     organization_id,
--     keycloak_user_id,
--     user_type,
--     email,
--     first_name,
--     last_name,
--     status
-- ) VALUES (
--     '<your-organization-id>',
--     '<your-keycloak-user-id>',
--     'org-admin',
--     'your-email@example.com',
--     'Your',
--     'Name',
--     'active'
-- );
