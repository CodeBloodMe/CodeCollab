import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Code2, ArrowRight, UserCheck, ShieldCheck } from "lucide-react";
import { toast } from "react-hot-toast";

const LoginPage = () => {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, guestLogin } = useAuth();
  const navigate = useNavigate();

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      toast.error("Please enter both username/email and password.");
      return;
    }

    try {
      setLoading(true);
      await login(identifier.trim(), password);
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestClick = async () => {
    try {
      setLoading(true);
      await guestLogin("tester");
      navigate("/dashboard");
    } catch (err) {
      toast.error("Guest login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-slate-100">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="size-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-black text-xl mx-auto">
            CF
          </div>
          <h1 className="text-2xl font-black tracking-wide text-white">
            Log in to <span className="text-cyan-400">CodeForge</span>
          </h1>
          <p className="text-xs text-slate-400">
            Real-time collaborative IDE & execution environment.
          </p>
        </div>

        {/* Card */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 block">
                Username or Email
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="developer or dev@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-300">
                  Password
                </label>
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-cyan-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Log In"}
            </button>
          </form>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[11px] text-slate-500 uppercase tracking-wider font-mono">
              or
            </span>
            <div className="border-t border-slate-800 w-full" />
          </div>

          {/* Quick Demo Guest Button */}
          <button
            onClick={handleGuestClick}
            disabled={loading}
            className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <UserCheck className="size-4 text-emerald-400" />
            <span>Instant Demo Guest Access</span>
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-cyan-400 hover:text-cyan-300 font-semibold underline decoration-cyan-400/30 underline-offset-4"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;

