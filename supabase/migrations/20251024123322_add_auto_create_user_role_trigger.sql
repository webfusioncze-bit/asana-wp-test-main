/*
  # Auto-create user role on user registration

  1. Changes
    - Adds a trigger function that automatically creates a user_roles entry when a new user is created in auth.users
    - Creates a trigger on auth.users that calls this function after insert
  
  2. Security
    - Trigger runs with SECURITY DEFINER to bypass RLS
    - Only creates 'user' role by default
    - Admins can manually change roles afterwards
*/

-- Create function to auto-create user role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();