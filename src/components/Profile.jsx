import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Alert, AlertDescription } from "./ui/alert";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";

// Adjust this to your actual backend route
const UPDATE_PROFILE_ENDPOINT = "/auth/update-profile";

export default function ProfileModal({ open, onOpenChange }) {
  // read auth from localStorage
  const authRaw = typeof window !== "undefined" ? localStorage.getItem("auth") : null;
  const auth = useMemo(() => {
    try { return authRaw ? JSON.parse(authRaw) : null; } catch { return null; }
  }, [authRaw]);

  const user = auth?.user || {};

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const [form, setForm] = useState({
    username: "",
    first_name: "",
    last_name: "",
    email_address: "",
    role: "",
    password: "",
    address: "",
    phone: "",
  });

  // initialize from auth
  // initialize from auth when modal opens
useEffect(() => {
    if (open && user) {
      setForm({
        username: user?.username || "",
        first_name: user?.first_name || "",
        last_name: user?.last_name || "",
        email_address: user?.email || user?.email_address || "",
        role: user?.role || "",
        password: "",
        address: user?.address || "",
        phone: user?.phone || "",
      });
      setEditing(false);
      setMsg({ type: "", text: "" });
    }
  }, [open]); // only run when modal is toggled
  

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  async function handleSave() {
    setMsg({ type: "", text: "" });

    // basic checks
    if (!form.username || !form.first_name || !form.last_name || !form.email_address) {
      setMsg({ type: "error", text: "Username, First name, Last name and Email are required." });
      return;
    }

    setSaving(true);
    try {
      // build payload — omit password if blank
      const payload = {
        username: form.username.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email_address: form.email_address.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
      };
      if (form.password.trim()) payload.password = form.password;

      const res = await fetch(`${API_BASE}${UPDATE_PROFILE_ENDPOINT}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Update failed (${res.status})`);
      }

      // Update localStorage copy if backend returns new user
      const json = await res.json().catch(() => ({}));

      let mergedUser;
      if (json?.data?.user) {
        // Prefer authoritative user from backend
        mergedUser = json.data.user;
      } else {
        // Fallback: patch current local user with the edited fields (never store password)
        mergedUser = {
          ...(auth?.user || {}),
          username: payload.username,
          first_name: payload.first_name,
          last_name: payload.last_name,
          email: payload.email_address,
          email_address: payload.email_address,
          address: payload.address,
          phone: payload.phone,
        };
      }

      // Persist to localStorage.auth
      const updatedAuth = { ...(auth || {}), user: mergedUser };
      localStorage.setItem("auth", JSON.stringify(updatedAuth));

      // UX: success alert and reset password field; stop editing
      setMsg({ type: "ok", text: "Profile updated successfully." });
      setEditing(false);
      setForm((f) => ({ ...f, password: "" }));

      // Auto-dismiss success after 3 seconds
      setTimeout(() => {
        setMsg((m) => (m.type === "ok" ? { type: "", text: "" } : m));
      }, 3000);
    } catch (err) {
      setMsg({ type: "error", text: err.message || "Could not update profile." });
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    // restore from auth copy
    setForm({
      username: user?.username || "",
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      email_address: user?.email || user?.email_address || "",
      role: user?.role || "",
      password: "",
      address: user?.address || "",
      phone: user?.phone || "",
    });
    setEditing(false);
    setMsg({ type: "", text: "" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white/90 backdrop-blur border-white/60 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent">
            My Profile
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            View and update your account information.
          </DialogDescription>
        </DialogHeader>

        {/* Alerts */}
        {msg.text ? (
          <Alert
            // shadcn has "default" & "destructive". We'll style success using classes.
            variant={msg.type === "error" ? "destructive" : "default"}
            className={
              msg.type === "error"
                ? "mb-2 bg-rose-50/90 backdrop-blur border-rose-200 shadow-md"
                : "mb-2 border-emerald-200 bg-emerald-50/90 backdrop-blur text-emerald-700 shadow-md"
            }
          >
            <AlertDescription>{msg.text}</AlertDescription>
          </Alert>
        ) : null}

        <div className="relative p-4 rounded-lg bg-gradient-to-br from-slate-50/50 to-white/50 border border-emerald-100/50 shadow-inner">
          {/* subtle backdrop gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/5 to-cyan-400/5 rounded-lg pointer-events-none"></div>

          <div className="relative grid gap-4">
            <Field label="Username">
              <Input
                name="username"
                value={form.username}
                onChange={onChange}
                disabled={!editing}
                autoComplete="username"
                className="bg-white/80 border-emerald-100 focus:border-emerald-300 transition-colors"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="First Name">
                <Input
                  name="first_name"
                  value={form.first_name}
                  onChange={onChange}
                  disabled={!editing}
                  autoComplete="given-name"
                  className="bg-white/80 border-emerald-100 focus:border-emerald-300 transition-colors"
                />
              </Field>
              <Field label="Last Name">
                <Input
                  name="last_name"
                  value={form.last_name}
                  onChange={onChange}
                  disabled={!editing}
                  autoComplete="family-name"
                  className="bg-white/80 border-emerald-100 focus:border-emerald-300 transition-colors"
                />
              </Field>
            </div>

            <Field label="Email Address">
              <Input
                type="email"
                name="email_address"
                value={form.email_address}
                onChange={onChange}
                disabled={!editing}
                autoComplete="email"
                className="bg-white/80 border-emerald-100 focus:border-emerald-300 transition-colors"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Role">
                <Input value={form.role} disabled className="bg-slate-100/80 border-slate-200" />
              </Field>

              <Field label="Password">
                <Input
                  type="password"
                  name="password"
                  placeholder="•••••••• (leave blank to keep current)"
                  value={form.password}
                  onChange={onChange}
                  disabled={!editing}
                  autoComplete="new-password"
                  className="bg-white/80 border-emerald-100 focus:border-emerald-300 transition-colors"
                />
              </Field>
            </div>

            <Field label="Address">
              <Input
                name="address"
                value={form.address}
                onChange={onChange}
                disabled={!editing}
                autoComplete="street-address"
                className="bg-white/80 border-emerald-100 focus:border-emerald-300 transition-colors"
              />
            </Field>

            <Field label="Phone">
              <Input
                name="phone"
                value={form.phone}
                onChange={onChange}
                disabled={!editing}
                autoComplete="tel"
                className="bg-white/80 border-emerald-100 focus:border-emerald-300 transition-colors"
              />
            </Field>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          {!editing ? (
            <Button onClick={() => setEditing(true)} className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600 shadow-md hover:shadow-lg transition-all">
              Edit
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={saving} className="shadow-md hover:shadow-lg transition-all">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600 shadow-md hover:shadow-lg transition-all">
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }) {
  return (
    <div className="grid gap-2">
      <Label className="text-emerald-600 font-semibold text-sm">{label}</Label>
      {children}
    </div>
  );
}
