/*
  # Remove trigger and handle user_roles insertion manually

  1. Changes
    - Drop the trigger on_auth_user_created
    - Keep the handle_new_user function for potential future use
    
  2. Reasoning
    - Edge function will handle user_roles insertion directly
    - More control and better error handling
    - Avoids timing issues with triggers
*/

-- Drop the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;