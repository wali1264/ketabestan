import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iycepqjfbuxhfxvpgdqm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5Y2VwcWpmYnV4aGZ4dnBnZHFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NDA3ODksImV4cCI6MjA3OTAxNjc4OX0.Ks3BwBtjylXYBEFWSTrt9Wxeiu__9Sj0bBcnOHmUOmI';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and anon key are required.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
