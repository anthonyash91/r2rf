-- Add facilityUser to the app_role enum so it can be stored in user_roles.
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'facilityUser';
