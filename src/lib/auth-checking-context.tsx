import { createContext, useContext, useState, type ReactNode } from "react";

type Ctx = { isChecking: boolean; setIsChecking: (v: boolean) => void };
const AuthCheckingContext = createContext<Ctx>({ isChecking: false, setIsChecking: () => {} });

export function AuthCheckingProvider({ children }: { children: ReactNode }) {
  const [isChecking, setIsChecking] = useState(false);
  return (
    <AuthCheckingContext.Provider value={{ isChecking, setIsChecking }}>
      {children}
    </AuthCheckingContext.Provider>
  );
}

export function useAuthChecking() {
  return useContext(AuthCheckingContext);
}
