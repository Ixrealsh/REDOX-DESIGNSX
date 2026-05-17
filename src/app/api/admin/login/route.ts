import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const { idToken } = body || {};

    if (!idToken) {
      return NextResponse.json({ error: 'idToken is required.' }, { status: 400 });
    }

    // Verify the Firebase ID Token using Firebase Auth REST API
    const apiKey = "AIzaSyD4rIJfGT9SLfYQ1nbTMDmVIqoSsXHKSpg";
    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
    
    const verifyRes = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });

    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.users || verifyData.users.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired Firebase session.' }, { status: 401 });
    }

    const firebaseUser = verifyData.users[0];
    const authenticatedEmail = firebaseUser.email || '';

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@redoxdesignx.com';

    if (authenticatedEmail.trim().toLowerCase() === adminEmail.trim().toLowerCase()) {
      // Create a secure cryptographic signature of the admin email using a fixed secret
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
    }

    // Non-admin email address
    return NextResponse.json({ error: 'Access Denied. Unauthorized admin account.' }, { status: 403 });
  } catch (error: any) {
    console.error('Admin Login verification error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
