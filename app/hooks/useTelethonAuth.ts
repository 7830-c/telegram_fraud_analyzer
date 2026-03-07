import { useState, useCallback } from "react";

type AuthStep = "idle" | "phone" | "otp" | "password" | "authorized" | "error";

interface AuthState {
  step: AuthStep;
  phoneNumber: string;
  phoneCodeHash: string | null;
  otpCode: string;
  password: string;
  error: string | null;
  loading: boolean;
}

export function useTelethonAuth() {
  const [state, setState] = useState<AuthState>({
    step: "idle",
    phoneNumber: "",
    phoneCodeHash: null,
    otpCode: "",
    password: "",
    error: null,
    loading: false,
  });

  const checkAuth = useCallback(async (phoneNumber: string) => {
    try {
      setState((s) => ({ ...s, loading: true }));
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "check_auth",
          phone_number: phoneNumber,
        }),
      });
      const data = await response.json();
      if (data.is_authorized) {
        setState((s) => ({ ...s, step: "authorized", error: null }));
        return true;
      }
      return false;
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Failed to check auth",
      }));
      return false;
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  const startAuth = useCallback(async (phoneNumber: string) => {
    try {
      const isAuthorized = await checkAuth(phoneNumber);
      if (isAuthorized) return;

      setState((s) => ({
        ...s,
        phoneNumber,
        step: "phone",
        error: null,
        loading: true,
      }));

      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_otp",
          phone_number: phoneNumber,
        }),
      });

      const data = await response.json();

      if (data.status === "otp_sent") {
        setState((s) => ({
          ...s,
          step: "otp",
          phoneCodeHash: data.phone_code_hash || null,
          error: null,
          loading: false,
        }));
      } else if (data.status === "already_authorized") {
        setState((s) => ({
          ...s,
          step: "authorized",
          error: null,
          loading: false,
        }));
      } else {
        setState((s) => ({
          ...s,
          error: data.error || "Failed to request OTP",
          loading: false,
        }));
      }
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Failed to start auth",
        loading: false,
      }));
    }
  }, [checkAuth]);

  const verifyOtp = useCallback(async (otpCode: string) => {
    try {
      setState((s) => ({ ...s, loading: true }));
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_otp",
          phone_number: state.phoneNumber,
          otp_code: otpCode,
          phone_code_hash: state.phoneCodeHash,
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        setState((s) => ({
          ...s,
          step: "authorized",
          error: null,
        }));
      } else if (data.status === "password_needed") {
        setState((s) => ({
          ...s,
          step: "password",
          error: null,
        }));
      } else {
        setState((s) => ({
          ...s,
          error: data.error || "Invalid OTP",
        }));
      }
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Failed to verify OTP",
      }));
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [state.phoneNumber]);

  const verifyPassword = useCallback(async (password: string) => {
    try {
      setState((s) => ({ ...s, loading: true }));
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_password",
          phone_number: state.phoneNumber,
          password,
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        setState((s) => ({
          ...s,
          step: "authorized",
          error: null,
        }));
      } else {
        setState((s) => ({
          ...s,
          error: data.error || "Invalid password",
        }));
      }
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : "Failed to verify password",
      }));
    } finally {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [state.phoneNumber]);

  const reset = useCallback(() => {
    setState({
      step: "idle",
      phoneNumber: "",
      phoneCodeHash: null,
      otpCode: "",
      password: "",
      error: null,
      loading: false,
    });
  }, []);

  return {
    ...state,
    checkAuth,
    startAuth,
    verifyOtp,
    verifyPassword,
    reset,
  };
}
