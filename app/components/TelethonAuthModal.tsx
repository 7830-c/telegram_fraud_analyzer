"use client";

import { useState } from "react";
import { useTelethonAuth } from "@/app/hooks/useTelethonAuth";

interface TelethonAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (phoneNumber: string) => void;
}

export function TelethonAuthModal({
  isOpen,
  onClose,
  onAuthSuccess,
}: TelethonAuthModalProps) {
  const auth = useTelethonAuth();
  const [localPhoneNumber, setLocalPhoneNumber] = useState("");
  const [localOtp, setLocalOtp] = useState("");
  const [localPassword, setLocalPassword] = useState("");

  if (!isOpen) return null;

  const handleStartAuth = () => {
    if (!localPhoneNumber.trim()) {
      alert("Please enter a phone number");
      return;
    }
    auth.startAuth(localPhoneNumber);
  };

  const handleVerifyOtp = () => {
    if (!localOtp.trim()) {
      alert("Please enter the OTP code");
      return;
    }
    auth.verifyOtp(localOtp);
  };

  const handleVerifyPassword = () => {
    if (!localPassword.trim()) {
      alert("Please enter your 2FA password");
      return;
    }
    auth.verifyPassword(localPassword);
  };

  const handleSuccess = () => {
    onAuthSuccess(auth.phoneNumber);
    onClose();
    auth.reset();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="gradient-border rounded-2xl w-full max-w-md p-8 bg-surface shadow-2xl">
        <h2 className="text-2xl font-bold mb-6 text-gradient">
          {auth.step === "authorized"
            ? "✅ Connected to Telegram"
            : "🔐 Telegram Login"}
        </h2>

        {/* Error Message */}
        {auth.error && (
          <div className="mb-4 p-4 rounded-lg bg-danger/10 border border-danger/50 text-danger text-sm">
            {auth.error}
          </div>
        )}

        {/* Phone Number Input */}
        {auth.step === "phone" && (
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">
              Enter your Telegram phone number to request an OTP
            </p>
            <input
              type="tel"
              placeholder="+1234567890"
              value={localPhoneNumber}
              onChange={(e) => setLocalPhoneNumber(e.target.value)}
              disabled={auth.loading}
              className="w-full rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition duration-200 disabled:opacity-50"
            />
            <button
              onClick={handleStartAuth}
              disabled={auth.loading}
              className="btn-primary w-full rounded-lg font-bold py-3"
            >
              {auth.loading ? "Requesting OTP..." : "Request OTP"}
            </button>
          </div>
        )}

        {/* Idle State - Phone Input */}
        {auth.step === "idle" && (
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">
              Enable full access to analyze any Telegram channel you're a member
              of. One-time login required.
            </p>
            <input
              type="tel"
              placeholder="+1234567890"
              value={localPhoneNumber}
              onChange={(e) => setLocalPhoneNumber(e.target.value)}
              disabled={auth.loading}
              className="w-full rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition duration-200 disabled:opacity-50"
            />
            <button
              onClick={handleStartAuth}
              disabled={auth.loading}
              className="btn-primary w-full rounded-lg font-bold py-3"
            >
              {auth.loading ? "Connecting..." : "🔑 Start Login"}
            </button>
          </div>
        )}

        {/* OTP Input */}
        {auth.step === "otp" && (
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">
              Check your Telegram app or SMS for the verification code
            </p>
            <input
              type="text"
              placeholder="123456"
              value={localOtp}
              onChange={(e) => setLocalOtp(e.target.value)}
              maxLength={6}
              disabled={auth.loading}
              className="w-full rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition duration-200 disabled:opacity-50 text-center text-2xl tracking-widest"
            />
            <button
              onClick={handleVerifyOtp}
              disabled={auth.loading}
              className="btn-primary w-full rounded-lg font-bold py-3"
            >
              {auth.loading ? "Verifying..." : "Verify OTP"}
            </button>
          </div>
        )}

        {/* Password Input (2FA) */}
        {auth.step === "password" && (
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">
              Your Telegram account has 2-factor authentication enabled. Please
              enter your password.
            </p>
            <input
              type="password"
              placeholder="Your 2FA password"
              value={localPassword}
              onChange={(e) => setLocalPassword(e.target.value)}
              disabled={auth.loading}
              className="w-full rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition duration-200 disabled:opacity-50"
            />
            <button
              onClick={handleVerifyPassword}
              disabled={auth.loading}
              className="btn-primary w-full rounded-lg font-bold py-3"
            >
              {auth.loading ? "Verifying..." : "Verify Password"}
            </button>
          </div>
        )}

        {/* Success State */}
        {auth.step === "authorized" && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-accent/10 border border-accent/50">
              <p className="text-accent font-semibold">
                ✅ Successfully logged in!
              </p>
              <p className="text-zinc-400 text-sm mt-2">
                Your session is saved and will work for future analyses.
              </p>
            </div>
            <button
              onClick={handleSuccess}
              className="btn-primary w-full rounded-lg font-bold py-3"
            >
              Start Analyzing Channels
            </button>
          </div>
        )}

        {/* Close Button */}
        {auth.step !== "authorized" && (
          <button
            onClick={onClose}
            disabled={auth.loading}
            className="w-full mt-4 px-4 py-2 text-zinc-400 hover:text-white transition"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
