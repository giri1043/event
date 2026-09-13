import React, { useState } from 'react';
import { X, Key, User, Check, ShieldAlert, Lock } from 'lucide-react';
import { apiRequest } from '../../utils/api';

interface ChangeCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export const ChangeCredentialsModal: React.FC<ChangeCredentialsModalProps> = ({
  isOpen,
  onClose,
  token
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword) {
      setError('Please enter your current administrator password.');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (!newUsername && !newPassword) {
      setError('Please enter a new username or new password to update.');
      return;
    }

    setLoading(true);

    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newUsername: newUsername.trim() || undefined,
          newPassword: newPassword.trim() || undefined
        })
      });

      setSuccess('Credentials updated successfully!');
      setCurrentPassword('');
      setNewUsername('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Error updating credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-md bg-[#fffefc] rounded-3xl border border-[#ded0be] shadow-2xl overflow-hidden my-auto">
        <div className="p-5 sm:px-6 border-b border-[#ebdcc9] bg-[#faf6ef] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#f2ebd9] border border-[#d9ccb6] flex items-center justify-center text-[#8e6c31]">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#8e6c31]">
                Security Settings
              </span>
              <h2 className="font-serif text-lg text-[#2d241c] font-normal">
                Update Admin Credentials
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#ede4d6] hover:bg-[#e2d5c2] text-[#544331] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#695642] mb-1">
              Current Password *
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf7f2] border border-[#d6c7b5] text-xs text-[#2d251d] focus:outline-hidden focus:ring-1 focus:ring-[#8e6c31]"
            />
          </div>

          <div className="pt-2 border-t border-[#ebdcc9]">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#695642] mb-1">
              New Admin Username (Optional)
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Leave blank to keep current"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf7f2] border border-[#d6c7b5] text-xs text-[#2d251d] focus:outline-hidden focus:ring-1 focus:ring-[#8e6c31]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#695642] mb-1">
              New Password (Optional)
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf7f2] border border-[#d6c7b5] text-xs text-[#2d251d] focus:outline-hidden focus:ring-1 focus:ring-[#8e6c31]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#695642] mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#faf7f2] border border-[#d6c7b5] text-xs text-[#2d251d] focus:outline-hidden focus:ring-1 focus:ring-[#8e6c31]"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#ede4d6] hover:bg-[#e2d5c2] text-[#544331] text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-[#8e6c31] hover:bg-[#785924] text-white text-xs font-semibold tracking-wide transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
