"use client";

import Image from "next/image";
import { signIn } from "@/lib/auth-client";
import { AuthLayout } from "./_components/auth-layout";

const SignInPage = () => {
	return (
		<AuthLayout type="Sign-In" text="Welcome back! Please sign in to continue">
			<button
				onClick={() => signIn.social({ provider: "github" })}
				className="flex justify-center items-center gap-2 border-gray-200 hover:scale-[1.02] hover:bg-[#fefbfb] shadow-gray-200 shadow-sm px-8 py-1.5 border rounded-md w-fit transition-all duration-150 ease-in-out"
				type="button"
			>
				<Image
					sizes="(max-width: 80px) 80px, 160px"
					src={"/icons/google.svg"}
					alt="GitHub logo"
					width={16}
					height={16}
				/>
				<span className="text-sm">Sign in with GitHub</span>
			</button>
		</AuthLayout>
	);
};

export default SignInPage;
