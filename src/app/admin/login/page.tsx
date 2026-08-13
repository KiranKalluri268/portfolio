import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 text-white">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
