import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Check Your Email</CardTitle>
        <CardDescription>
          We&apos;ve sent a verification link to{" "}
          {email || "your email address"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600">
          Click the link in the email to verify your account.
          The link expires in 24 hours.
        </p>
      </CardContent>
    </Card>
  );
}
