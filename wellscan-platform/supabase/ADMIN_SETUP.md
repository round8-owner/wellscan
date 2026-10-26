# First administrator setup

1. Sign up with your intended admin email through the app.
2. Run the following in Supabase SQL Editor, replacing the email:
   ```sql
   update public.profiles set role = 'admin' where email = 'admin@example.com';
   ```
3. Sign out and back in, then open `/admin`.
4. Confirm a normal account receives HTTP 403 from `/api/admin`.

Never expose a service-role key in browser code. Restrict who can run SQL in the Supabase project.
