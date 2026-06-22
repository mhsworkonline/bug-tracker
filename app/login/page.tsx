"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/auth-browser";
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const sb = createSupabaseBrowser();
    const { error: authError } = await sb.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message || "Invalid email or password");
      return;
    }
    router.push("/projects");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#FAFBFC] flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-sm border border-[#E8E8E9]">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded bg-[#4573D9] flex items-center justify-center text-white font-bold text-sm">BT</div>
          <span className="text-lg font-semibold text-[#151B26]">Bug Tracker</span>
        </div>
        <h1 className="text-2xl font-bold text-[#151B26] mb-1">Sign in</h1>
        <p className="text-sm text-[#6B6F76] mb-6">Enter your credentials to continue</p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-[#151B26] mb-1">Email</label>
            <input
              type="email" required autoFocus
              value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-[#E8E8E9] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#4573D9]"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#151B26] mb-1">Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"} required
                value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-[#E8E8E9] rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:border-[#4573D9]"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6F76] hover:text-[#151B26]"
              >
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-[#4573D9] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#3F65C4] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
