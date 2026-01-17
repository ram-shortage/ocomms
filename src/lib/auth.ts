// Temporary auth config for schema generation
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";

export const auth = betterAuth({
  database: { type: "postgres" },
  emailAndPassword: { enabled: true },
  plugins: [organization()],
});
