import React, { useState } from 'react';
import { Lock, ArrowRight, User, ArrowLeft, Eye, EyeOff, ShieldAlert } from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: (token: string) => void;
  onBackToInvite?: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onBackToInvite }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Please enter the administrator password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      localStorage.setItem('admin_token', data.token);
      onLoginSuccess(data.token);
    } catch (err: any) {
      setError(err.message || 'Invalid administrator credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f4ee] flex flex-col items-center justify-center p-4 selection:bg-[#c49a45]/20 selection:text-[#5a421b]">
      {/* Return to Guest Invitation Banner */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (onBackToInvite) {
              onBackToInvite();
            } else {
              window.location.href = '/';
            }
          }}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7d6852] hover:text-[#2b221a] px-3 py-1.5 rounded-xl hover:bg-[#ede4d6] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Guest Invitation</span>
        </button>

        <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#8e6c31] bg-[#f2ebd9] px-2.5 py-1 rounded-full border border-[#ded0be]">
          <ShieldAlert className="w-3 h-3 text-[#8e6c31]" />
          <span>Restricted Portal</span>
        </span>
      </div>

      <div className="w-full max-w-md bg-[#fffdfa] rounded-3xl border border-[#ded1be] shadow-xl p-8 sm:p-10 relative overflow-hidden">
        {/* Top Header */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-14 h-14 rounded-2xl bg-[#f2ebd9] border border-[#d9ccb6] flex items-center justify-center text-[#8e6c31] mb-4 shadow-xs">
            <Lock className="w-7 h-7" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8e7456]">
            Host & Organizer Access
          </span>
          <h1 className="font-serif text-3xl text-[#2b221a] mt-1 font-normal">
            Administrator Login
          </h1>
          <p className="text-xs text-[#7d6953] mt-2 max-w-xs leading-relaxed">
            This area is restricted to authorized event administrators. Please sign in with your credentials to manage events, guest lists, and live RSVPs.
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Admin Username */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#695641] mb-1.5">
              Admin Username
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full px-4 py-2.5 rounded-xl bg-[#faf7f2] border border-[#d8c8b5] text-sm text-[#2a221b] focus:outline-hidden focus:ring-2 focus:ring-[#b38b4d]/40 focus:border-[#b38b4d] pr-10"
              />
              <User className="w-4 h-4 text-[#9b856f] absolute right-3.5 top-3" />
            </div>
          </div>

          {/* Admin Password */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#695641] mb-1.5">
              Host Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full px-4 py-2.5 rounded-xl bg-[#faf7f2] border border-[#d8c8b5] text-sm text-[#2a221b] focus:outline-hidden focus:ring-2 focus:ring-[#b38b4d]/40 focus:border-[#b38b4d] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-[#9b856f] hover:text-[#5a4430] cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-5 rounded-xl bg-[#8e6c31] hover:bg-[#785924] text-white font-semibold text-sm tracking-wide shadow-md shadow-[#8e6c31]/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <>
                <span>Enter Admin Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Guest Security Notice */}
        <div className="mt-6 pt-5 border-t border-[#ebdcc9] text-center">
          <p className="text-[11px] text-[#8e7c6b] leading-relaxed">
            Guests do not require administrative access. If you received an invitation, please follow the personalized invitation link sent to you by the event host.
          </p>
        </div>
      </div>
    </div>
  );
};
