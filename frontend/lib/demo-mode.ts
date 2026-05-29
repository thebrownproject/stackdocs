export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export function assertDemoModeSafe(): void {
  const isProductionDeploy =
    process.env.VERCEL_ENV === "production" || process.env.TRESTLE_ENV === "production";
  if (isDemoMode && isProductionDeploy) {
    throw new Error(
      "NEXT_PUBLIC_DEMO_MODE=true is not permitted in production deploys. " +
        "Demo mode bypasses Clerk route protection and may use the Supabase service role key.",
    );
  }
}
