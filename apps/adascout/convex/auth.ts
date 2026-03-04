import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import type { DataModel } from "./_generated/dataModel";

const PasswordProvider = Password<DataModel>({
  profile(params) {
    const email = typeof params.email === "string" ? params.email : "";
    const name = typeof params.name === "string" ? params.name : undefined;
    return {
      email,
      name: name?.trim() ? name.trim() : undefined,
    };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [PasswordProvider],
});
