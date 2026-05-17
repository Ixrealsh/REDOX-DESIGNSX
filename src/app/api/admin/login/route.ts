import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const { email, password } = body || {};

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@redoxdesignx.com';

    // 1. Strictly verify that the email matches the authorized admin email in .env
    if (email.trim().toLowerCase() !== adminEmail.trim().toLowerCase()) {
      return NextResponse.json({ error: 'Access Denied. Unauthorized admin account.' }, { status: 403 });
    }

    // 2. Perform Server-side Firebase REST authentication
    const apiKey = "AIzaSyD4rIJfGT9SLfYQ1nbTMDmVIqoSsXHKSpg";
    const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
    
    const signInRes = await fetch(signInUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true
      })
    });

    const signInData = await signInRes.json();
    
    if (!signInRes.ok) {
      const errMsg = signInData.error?.message || '';
      if (errMsg.includes('INVALID_PASSWORD') || errMsg.includes('EMAIL_NOT_FOUND')) {
        return NextResponse.json({ error: 'Invalid admin email or password.' }, { status: 401 });
      }
      return NextResponse.json({ error: errMsg || 'Authentication failed via Firebase.' }, { status: 401 });
    }

    // 3. Create a secure cryptographic signature of the admin email using a fixed secret
    const secret = 'redox-secret-key-129847192';
    const signature = crypto.createHmac('sha256', secret).update(adminEmail).digest('hex');
    
    const response = NextResponse.json({ success: true, message: 'Authenticated successfully!' });
    
    // Set secure HTTP-only cookie
    response.cookies.set('admin_session', signature, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/'
    });

    return response;
  } catch (error: any) {
    console.error('Server-side Admin Login error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
