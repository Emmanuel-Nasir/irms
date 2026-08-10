"use client";

import { useState } from "react";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    setSuccess(true);
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
  }

  return (
    <div className="min-h-screen bg-parchment px-8 py-10">
      <h1 className="mb-6 font-display text-2xl text-navy">Change Password</h1>

      <form onSubmit={handleSubmit} className="max-w-md rounded border-t-4 border-gold bg-white p-6 shadow-sm">
        {error && (
          <p className="mb-3 rounded border border-clay/30 bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>
        )}
        {success && (
          <p className="mb-3 rounded border border-sage/30 bg-sage/10 px-3 py-2 text-sm text-sage">
            Password changed successfully.
          </p>
        )}

        <label className="mb-1 block text-sm font-medium text-navy/80">Current Password</label>
        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
          className="mb-4 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" required />

        <label className="mb-1 block text-sm font-medium text-navy/80">New Password</label>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
          className="mb-4 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" required />

        <label className="mb-1 block text-sm font-medium text-navy/80">Confirm New Password</label>
        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
          className="mb-6 w-full rounded border border-navy/20 px-3 py-2 outline-none focus:border-gold" required />

        <button type="submit" disabled={loading}
          className="rounded bg-navy px-4 py-2 font-medium text-parchment transition-all hover:bg-gold hover:text-navy disabled:opacity-50">
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}