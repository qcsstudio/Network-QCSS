import { NextResponse } from 'next/server';

export function proxy(request) {
  const token = request.cookies.get('token');
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/login') && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (!token && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login/:path*', '/dashboard/:path*'],
};
