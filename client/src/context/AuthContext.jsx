import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../api/client";
import { toast } from "react-hot-toast";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("codeforge_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem("codeforge_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      const currentToken = localStorage.getItem("codeforge_token");
      if (!currentToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get("/api/auth/me");
        setUser(res.data.user);
        localStorage.setItem("codeforge_user", JSON.stringify(res.data.user));
      } catch (err) {
        console.warn("Session expired or invalid, logging out.");
        logout();
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  const login = async (identifier, password) => {
    const res = await api.post("/api/auth/login", { identifier, password });
    const { user: userData, token: userToken } = res.data;
    setUser(userData);
    setToken(userToken);
    localStorage.setItem("codeforge_token", userToken);
    localStorage.setItem("codeforge_user", JSON.stringify(userData));
    localStorage.setItem("username", userData.username);
    toast.success(`Welcome back, ${userData.username}!`);
    return userData;
  };

  const register = async (username, email, password) => {
    const res = await api.post("/api/auth/register", { username, email, password });
    const { user: userData, token: userToken } = res.data;
    setUser(userData);
    setToken(userToken);
    localStorage.setItem("codeforge_token", userToken);
    localStorage.setItem("codeforge_user", JSON.stringify(userData));
    localStorage.setItem("username", userData.username);
    toast.success("Account created successfully!");
    return userData;
  };

  const guestLogin = async (customName = "") => {
    const randId = Math.random().toString(36).substring(2, 6);
    const guestUser = customName ? `${customName.toLowerCase().replace(/[^a-z0-9]/g, "")}_${randId}` : `guest_${randId}`;
    const guestEmail = `${guestUser}@codeforge.local`;
    const guestPass = "CodeForgeGuest123!";

    return await register(guestUser, guestEmail, guestPass);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("codeforge_token");
    localStorage.removeItem("codeforge_user");
    localStorage.removeItem("username");
    toast("Logged out.");
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, guestLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

