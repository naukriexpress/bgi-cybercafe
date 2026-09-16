BGI Cybercafe website — Supabase edition
========================================

This version is ready for shared online data:
- index.html is the public website.
- admin.html is the secure admin panel.
- Supabase Auth handles the admin email/password.
- Supabase Database stores settings, services and document lists.
- Row Level Security permits public reading but only approved admins can edit.

Start with DEPLOY-GUIDE-HINDI.txt and run supabase/setup.sql.
Then paste the Supabase Project URL and anon/publishable key into js/config.js.

Never put a Supabase service_role key in this project or GitHub.
