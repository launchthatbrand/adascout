import {
  auth as pluginAuth,
  signIn as pluginSignIn,
  signOut as pluginSignOut,
  store as pluginStore,
  isAuthenticated as pluginIsAuthenticated,
} from "launchthat-plugin-auth/convex/component/auth";

export const auth = pluginAuth;
export const signIn = pluginSignIn;
export const signOut = pluginSignOut;
export const store = pluginStore;
export const isAuthenticated = pluginIsAuthenticated;
