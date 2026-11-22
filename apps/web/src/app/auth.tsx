import type { JSX } from "solid-js";
import { createContext, createSignal, useContext } from "solid-js";

import { repository } from "../data/repository";
import type { User } from "../data/types";

type AuthContextValue = {
  user: () => User | null;
  ready: () => boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue>();

export function AuthProvider(props: { children: JSX.Element }) {
  const [user, setUser] = createSignal<User | null>(null);

  // The first pass keeps the session in memory only. When the API lands this
  // becomes an async "who am I" check backed by an HttpOnly session cookie.
  const value: AuthContextValue = {
    user,
    ready: () => true,
    async login(username, password) {
      const nextUser = await repository.login(username, password);
      setUser(nextUser);
    },
    logout() {
      setUser(null);
    },
  };

  return (
    <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
