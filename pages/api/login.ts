import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// This is a serverless function, so environment variables are secure.
// These must be set in your project's environment variables.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const jwtSecret = process.env.SUPABASE_JWT_SECRET;

// A default handler to catch unconfigured environments
const handle_error = (res: any, message: string, status: number = 500) => {
  console.error(message);
  return res.status(status).json({ message });
}

export default async function handler(req: any, res: any) {
  if (!supabaseUrl || !supabaseServiceKey || !jwtSecret) {
    return handle_error(res, "Server environment variables (URL, Service Key, JWT Secret) are not set.");
  }
  
  // Create a Supabase client with the service role key to bypass RLS for this internal check
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    // 1. Call the database function to verify the password
    const { data, error } = await supabaseAdmin.rpc('verify_password', {
      username_in: username,
      password_in: password,
    });

    if (error || !data || data.length === 0) {
      console.error('RPC verify_password error:', error);
      return res.status(401).json({ message: 'نام کاربری یا رمز عبور اشتباه است.' });
    }

    const { user_id } = data[0];

    // 2. Fetch the full user object to return to the client.
    // This bypasses the RLS issue on the client side.
    const { data: fullUserData, error: userFetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user_id)
      .single();

    if (userFetchError || !fullUserData) {
      console.error('Error fetching user data post-login:', userFetchError);
      return res.status(500).json({ message: 'Could not retrieve user details after verification.' });
    }


    // 3. If successful, create a new JWT
    const payload = {
      sub: user_id, // Subject - THIS IS CRUCIAL FOR RLS (auth.uid())
      role: 'authenticated', // Standard Supabase claim
      iat: Math.floor(Date.now() / 1000), // Issued at time
    };

    const accessToken = jwt.sign(payload, jwtSecret, { expiresIn: '1h' });

    // 4. Return the token and user data to the client
    return res.status(200).json({ accessToken, user: fullUserData });

  } catch (error: any) {
    return handle_error(res, `An internal server error occurred: ${error.message}`);
  }
}
