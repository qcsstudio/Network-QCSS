import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import connectMongo from '@/lib/mongodb';
import { Admin } from '../../../../models/admin';


const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(req) {
  await connectMongo();
  const { email, password } = await req.json();
  
  const adminDoc = await Admin.findOne({ email });
  if (!adminDoc) {
    return NextResponse.json({ error: 'Admin not found' }, { status: 401 });
  }

  const isMatch = await bcrypt.compare(password, adminDoc.password);
  if (!isMatch) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = jwt.sign(
    {
      adminId: adminDoc._id,
      email: adminDoc.email,
      role: adminDoc.role, // include role in JWT
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const response = NextResponse.json({
    success: true,
    message: 'Login successful',
    role: adminDoc.role, // return role in response body
  });

  response.cookies.set('token', token, {
    httpOnly: true,
    path: '/',
    maxAge: 3600, // 1 hour
  });

  // (Optional) set role separately if you want easier access client-side
  response.cookies.set('role', adminDoc.role, {
    httpOnly: false, // allow reading on client if needed
    path: '/',
    maxAge: 3600,
  });

  return response;
}
