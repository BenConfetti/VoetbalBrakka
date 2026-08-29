import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const username = process.env.APP_USERNAME;
  const password = process.env.APP_PASSWORD;
  if (!username || !password) return NextResponse.next();
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Basic ')) {
    const [givenUser, givenPassword] = atob(auth.slice(6)).split(':');
    if (givenUser === username && givenPassword === password) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-app-user', givenUser);
      return NextResponse.next({request:{headers:requestHeaders}});
    }
  }
  return new NextResponse('Inloggen vereist', {status:401,headers:{'WWW-Authenticate':'Basic realm="Voetbalstatistieken"'}});
}
export const config = {matcher:['/((?!api/health|_next/static|_next/image|favicon.ico|og.png).*)']};
