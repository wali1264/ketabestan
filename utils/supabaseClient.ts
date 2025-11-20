
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://niybskrhrcwrzcczdraj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5peWJza3JocmN3cnpjY3pkcmFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MzY2MTUsImV4cCI6MjA3OTExMjYxNX0.hzf7jAUeKtuh_aO5AncjfLuzMaS0026pJAinPExdKDw';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and anon key are required.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
