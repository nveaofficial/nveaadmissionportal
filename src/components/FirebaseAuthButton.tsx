import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { LogIn, LogOut, Cloud, CloudCheck, AlertCircle, ChevronDown } from 'lucide-react';

interface FirebaseAuthButtonProps {
  user: User | null;
  loading: boolean;
  onSignIn: () => Promise<User | null>;
  onSignOut: () => Promise<void>;
  authError?: string | null;
}

export const FirebaseAuthButton: React.FC<FirebaseAuthButtonProps> = ({
  user,
  loading,
  onSignIn,
  onSignOut,
  authError,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    await onSignIn();
    setIsSigningIn(false);
  };

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await onSignOut();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 bg-slate-800/60 rounded-sm">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-[11px]">Connecting...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative inline-flex flex-col items-end">
        <button
          type="button"
          onClick={handleSignIn}
          disabled={isSigningIn}
          title="Sign in with Google to enable cloud database sync"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-600 rounded-sm transition-colors cursor-pointer whitespace-nowrap shadow-xs"
        >
          {/* Official Google G Logo */}
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span className="hidden sm:inline">Sign In with Google</span>
          <span className="sm:hidden">Sign In</span>
        </button>
        {authError && (
          <div className="absolute top-full mt-1 right-0 bg-red-900/90 text-red-200 border border-red-500 text-[10px] p-1.5 rounded-sm max-w-[220px] shadow-lg z-50 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span className="truncate">{authError}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setDropdownOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-white bg-slate-800/90 hover:bg-slate-700/90 border border-slate-600 rounded-sm cursor-pointer transition-colors"
        title={`Signed in as ${user.email} (Firestore Connected)`}
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            referrerPolicy="no-referrer"
            className="w-4 h-4 rounded-full object-cover shrink-0"
          />
        ) : (
          <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
            {(user.displayName || user.email || 'U')[0].toUpperCase()}
          </div>
        )}
        <div className="flex items-center gap-1">
          <span className="max-w-[100px] truncate text-[11px] font-semibold hidden md:inline">
            {user.displayName || user.email?.split('@')[0]}
          </span>
          <span className="inline-flex items-center text-emerald-400" title="Firestore Connected">
            <Cloud className="w-3 h-3 fill-emerald-400" />
          </span>
        </div>
        <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
      </button>

      {dropdownOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setDropdownOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 w-64 bg-white text-slate-800 rounded-sm shadow-xl border border-slate-200 py-2 z-50 text-xs">
            <div className="px-3 py-1.5 border-b border-slate-100">
              <p className="font-bold text-slate-900 truncate">
                {user.displayName || 'Authorized User'}
              </p>
              <p className="text-[11px] text-slate-500 font-mono truncate">
                {user.email}
              </p>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
                <Cloud className="w-3 h-3 text-emerald-600 fill-emerald-500" />
                <span>Firestore Cloud Sync Active</span>
              </div>
            </div>

            <div className="px-3 py-2 text-[11px] text-slate-600 border-b border-slate-100">
              Your applications and verified records are backed up securely to the official NVEA Firestore database.
            </div>

            <div className="px-2 pt-1">
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-red-700 hover:bg-red-50 rounded-xs font-semibold cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
