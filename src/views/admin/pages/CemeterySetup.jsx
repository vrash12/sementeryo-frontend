// frontend/src/views/admin/pages/CemeterySetup.jsx
import { useState, useMemo, useEffect } from "react";
import { ImagePlus, Save, TriangleAlert } from "lucide-react";
import { getAuth } from "../../../utils/auth";

import { Button } from "../../../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "../../../components/ui/alert";
import { Toaster, toast } from "sonner";

const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";
const IMG_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL_IMAGE) || API_BASE;

// make a relative path absolute to IMG_BASE (or pass through absolute URLs)
const resolveImageUrl = (p) => {
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  const base = (IMG_BASE || "").replace(/\/+$/, "");
  const path = `${p}`.startsWith("/") ? p : `/${p}`;
  return `${base}${path}`;
};

export default function CemeterySetup() {
  const auth = getAuth();
  const token = auth?.token;
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  const [form, setForm] = useState({
    name: "",
    address: "",
    slogan: "",
    description: "",
  });
  const [logoFile, setLogoFile] = useState(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // prefer newly chosen file preview; else show existing url if any
  const filePreview = useMemo(
    () => (logoFile ? URL.createObjectURL(logoFile) : null),
    [logoFile]
  );
  const logoPreview = filePreview || existingLogoUrl || null;

  const handleChange = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleFile = (e) => {
    const file = e.target.files?.[0] || null;
    setLogoFile(file);
  };

  // Fetch initial data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/cemetery-info/`, {
          headers: { ...authHeader },
        });
        if (!res.ok) {
          const ct = res.headers.get("content-type") || "";
          const msg = ct.includes("application/json")
            ? JSON.stringify(await res.json())
            : await res.text();
          throw new Error(msg || "Failed to load cemetery info.");
        }
        const json = await res.json();
        const d = json?.data || null;
        if (d && !cancelled) {
          setForm({
            name: d.name ?? "",
            address: d.address ?? "",
            slogan: d.slogan ?? "",
            description: d.description ?? "",
          });
          setExistingLogoUrl(resolveImageUrl(d.logo_url) || null);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) return toast.error("Cemetery Name is required.");
    if (!form.address.trim()) return toast.error("Address is required.");

    const fd = new FormData();
    fd.append("name", form.name.trim());
    fd.append("address", form.address.trim());
    fd.append("slogan", form.slogan.trim());
    fd.append("description", form.description.trim());
    if (logoFile) fd.append("logo", logoFile);

    try {
      setSubmitting(true);
      const res = await fetch(`${API_BASE}/superadmin/save-cemetery-info`, {
        method: "PUT",
        headers: { ...authHeader }, // don't set Content-Type with FormData
        body: fd,
      });

      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        const msg = ct.includes("application/json")
          ? JSON.stringify(await res.json())
          : await res.text();
        throw new Error(msg || "Failed to save information.");
      }

      const saved = await res.json().catch(() => null);
      const d = saved?.data || null;
      if (d) {
        // if backend returns relative logo_url, resolve it using IMG_BASE
        setExistingLogoUrl(resolveImageUrl(d.logo_url) || existingLogoUrl);
      }
      toast.success("Cemetery information saved.");
    } catch (err) {
      setError(String(err));
      toast.error("Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Toaster richColors expand={false} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cemetery Setup</h1>
          <p className="text-sm text-muted-foreground">
            Configure basic information for your cemetery
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="border-rose-200">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Request failed</AlertTitle>
          <AlertDescription className="break-words">{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
          <CardDescription>These details appear across the app.</CardDescription>
        </CardHeader>

        <CardContent>
          <form id="cemetery-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cem-name">Cemetery Name</Label>
                <Input
                  id="cem-name"
                  value={form.name}
                  onChange={handleChange("name")}
                  placeholder="e.g., San Roque Memorial Park"
                  required
                  disabled={loading || submitting}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <Label htmlFor="cem-slogan">Slogan</Label>
                <Input
                  id="cem-slogan"
                  value={form.slogan}
                  onChange={handleChange("slogan")}
                  placeholder="A place of peace and remembrance"
                  disabled={loading || submitting}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cem-address">Address</Label>
                <Input
                  id="cem-address"
                  value={form.address}
                  onChange={handleChange("address")}
                  placeholder="Street, Barangay, City, Province, ZIP"
                  required
                  disabled={loading || submitting}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cem-description">Description</Label>
                <Textarea
                  id="cem-description"
                  value={form.description}
                  onChange={handleChange("description")}
                  placeholder="Brief description of the cemetery..."
                  className="min-h-[120px]"
                  disabled={loading || submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cem-logo">Upload Logo</Label>
                <Input
                  id="cem-logo"
                  type="file"
                  accept="image/*"
                  onChange={handleFile}
                  disabled={loading || submitting}
                />
                {logoPreview ? (
                  <div className="mt-2">
                    <div className="text-xs text-muted-foreground mb-1">Preview</div>
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-20 w-20 rounded-md border object-contain bg-white"
                    />
                  </div>
                ) : (
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <ImagePlus className="h-4 w-4" />
                    No file selected
                  </div>
                )}
              </div>
            </div>
          </form>
        </CardContent>

        <CardFooter className="justify-end gap-2">
          <Button form="cemetery-form" type="submit" disabled={submitting || loading}>
            <Save className="h-4 w-4 mr-2" />
            {submitting ? "Saving..." : "Save Information"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
