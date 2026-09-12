import { redirect } from "next/navigation";

// This app has no standalone landing page — everything happens inside the
// LIFF dashboard, so the root route just forwards straight there.
export default function Home() {
  redirect("/dashboard");
}
