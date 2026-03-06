type ConvexAuthProviderConfig = {
  domain: string | undefined;
  applicationID: string;
};

export const buildConvexAuthConfig = (input?: {
  domain?: string;
  applicationID?: string;
}): { providers: Array<ConvexAuthProviderConfig> } => ({
  providers: [
    {
      domain: input?.domain ?? process.env.CONVEX_SITE_URL,
      applicationID: input?.applicationID ?? "convex",
    },
  ],
});
