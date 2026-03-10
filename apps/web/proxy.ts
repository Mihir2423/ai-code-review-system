import { type NextRequest, NextResponse } from "next/server";

const publicRoutes = ["/", "/login"];

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const isPublic = publicRoutes.includes(pathname);

	const session = request.cookies.get("better-auth.session_token");

	if (!isPublic && !session) {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	if (isPublic && session && pathname === "/login") {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|.*\\..*).+)"],
};
