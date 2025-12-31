// frontend/src/views/admin/pages/VisitorManagement.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { Eye, Pencil, Trash2, Plus, TriangleAlert } from "lucide-react";

// API helpers
import { deleteUser } from "../js/delete-user";
import { addUser } from "../js/add-user";
import { getUsers } from "../js/get-users";
import { updateUser } from "../js/update-user";

// shadcn/ui primitives
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { Switch } from "../../../components/ui/switch";
import { Badge } from "../../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "../../../components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
} from "../../../components/ui/alert-dialog";

// shadcn sonner toasts
import { Toaster, toast } from "sonner";

/* ------------ helpers ------------ */
const isVisitor = (u) => `${u?.role || ""}`.toLowerCase() === "visitor";
const genPass = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 6 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join("");
};

export default function VisitorManagement() {
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [onlyActive, setOnlyActive] = useState(false);

  // dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [selected, setSelected] = useState(null);      // for view/edit
  const [confirmUser, setConfirmUser] = useState(null); // for delete

const fetchUsers = useCallback(async () => {
  setError(null);
  const result = await getUsers();
  if (!result.ok) {
    setError(result.error || "Failed to load users.");
    return;
  }
  // endpoint already returns only visitors
  setRows(result.data || []);
}, []);


  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredRows = useMemo(() => {
    if (!onlyActive) return rows;
    return rows.filter((r) => Number(r.is_active) === 1);
  }, [rows, onlyActive]);

  // ----- CRUD handlers -----
  const openView = (row) => {
    setSelected(row);
    setViewOpen(true);
  };

  const openEdit = (row) => {
    setSelected({
      ...row,
      // normalize is_active to boolean for Switch
      is_active_bool: !!Number(row?.is_active ?? 1),
    });
    setEditOpen(true);
  };

  const openAdd = () => {
    setSelected({
      username: "",
      email: "",
      first_name: "",
      last_name: "",
      phone: "",
      address: "",
      // default active
      is_active_bool: true,
    });
    setAddOpen(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const vals = Object.fromEntries(form.entries());

    const payload = {
      username: (vals.username || "").trim(),
      email: (vals.email || "").trim(),
      first_name: (vals.first_name || "").trim(),
      last_name: (vals.last_name || "").trim(),
      phone: (vals.phone || "").trim(),
      address: (vals.address || "").trim(),
      role: "visitor",
      is_active: 1,
      password_str: genPass(),
    };

    try {
      const result = await addUser(payload);
      if (!result.ok) throw new Error(result.error || "Add failed");
      toast.success("Visitor added successfully.");
      setAddOpen(false);
      setSelected(null);
      await fetchUsers();
    } catch (err) {
      toast.error(err?.message || "Failed to add visitor.");
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selected?.id) return;

    const form = new FormData(e.currentTarget);
    const vals = Object.fromEntries(form.entries());

    const payload = {
      username: (vals.username || selected.username || "").trim(),
      email: (vals.email || selected.email || "").trim(),
      first_name: (vals.first_name || selected.first_name || "").trim(),
      last_name: (vals.last_name || selected.last_name || "").trim(),
      phone: (vals.phone || selected.phone || "").trim(),
      address: (vals.address || selected.address || "").trim(),
      is_active: vals.is_active_bool === "on" ? 1 : 0,
      role: "visitor",
    };

    // optional new password
    const newPwd = (vals.password_str || "").trim();
    if (newPwd.length > 0) payload.password_str = newPwd;

    try {
      const res = await updateUser(selected.id, payload);
      if (!res.ok) throw new Error(res.error || "Update failed");
      toast.success("Visitor updated successfully.");
      setEditOpen(false);
      setSelected(null);
      await fetchUsers();
    } catch (err) {
      toast.error(err?.message || "Failed to update visitor.");
    }
  };

  const askDelete = (row) => {
    setConfirmUser(row);
    setConfirmOpen(true);
  };

  const doDelete = async () => {
    if (!confirmUser?.id) return;
    const label = confirmUser.first_name || confirmUser.username || "this user";
    try {
      const res = await deleteUser(confirmUser.id);
      if (!res.ok) throw new Error(res.error || "Delete failed");
      toast.success(`Deleted "${label}".`);
      setConfirmOpen(false);
      setConfirmUser(null);
      await fetchUsers();
    } catch (err) {
      toast.error(err?.message || "Failed to delete user.");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* toasts */}
      <Toaster richColors expand={false} />

      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Visitors</h1>
          <p className="text-sm text-muted-foreground">Manage visitor accounts</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" /> Add New
        </Button>
      </div>

      {/* error alert */}
      {error && (
        <Alert variant="destructive" className="border-rose-200">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Failed to load visitors</AlertTitle>
          <AlertDescription className="break-words">{String(error)}</AlertDescription>
        </Alert>
      )}

      {/* table card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div />
          <div className="flex items-center gap-2">
            <span className="text-sm">Only Active</span>
            <Switch checked={onlyActive} onCheckedChange={setOnlyActive} />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {/* limit height + vertical scroll, keep sticky header */}
          <div className="max-h-[420px] overflow-y-auto rounded-md border border-border">
            <Table className="min-w-full">
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead className="w-[14%]">First Name</TableHead>
                  <TableHead className="w-[14%]">Last Name</TableHead>
                  <TableHead className="w-[14%]">Phone</TableHead>
                  <TableHead className="w-[22%]">Email</TableHead>
                  <TableHead className="w-[16%]">Username</TableHead>
                  <TableHead className="w-[16%]">Password</TableHead>
                  <TableHead className="w-[10%]">Active</TableHead>
                  <TableHead className="w-[1%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                      No visitors to display.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.first_name ?? "—"}</TableCell>
                      <TableCell>{r.last_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{r.phone ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground break-words">
                        {r.email ?? "—"}
                      </TableCell>
                      <TableCell>{r.username ?? "—"}</TableCell>
                      <TableCell>{r.password_str ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={Number(r.is_active) === 1 ? "success" : "secondary"}>
                          {Number(r.is_active) === 1 ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => openView(r)}>
                          <Eye className="h-4 w-4 mr-1" /> View
                        </Button>
                        <Button size="sm" onClick={() => openEdit(r)}>
                          <Pencil className="h-4 w-4 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => askDelete(r)}>
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* View Dialog (readonly inputs) */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Visitor Details</DialogTitle>
            <DialogDescription>Read-only information</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input value={selected.username ?? "—"} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={selected.email ?? "—"} readOnly />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>First Name</Label>
                  <Input value={selected.first_name ?? "—"} readOnly />
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name</Label>
                  <Input value={selected.last_name ?? "—"} readOnly />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={selected.phone ?? "—"} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input value={selected.address ?? "—"} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Input value={Number(selected.is_active) === 1 ? "Active" : "Inactive"} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label>Created At</Label>
                <Input value={selected.created_at ?? "—"} readOnly />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Add Visitor</DialogTitle>
            <DialogDescription>Create a new visitor account</DialogDescription>
          </DialogHeader>
        <form onSubmit={handleAddSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input name="username" required />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input name="email" type="email" required />
              </div>
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input name="first_name" required />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input name="last_name" required />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input name="phone" />
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input name="address" />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Edit Visitor</DialogTitle>
            <DialogDescription>Update visitor details</DialogDescription>
          </DialogHeader>
          {selected && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <Input name="username" defaultValue={selected.username ?? ""} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input name="email" type="email" defaultValue={selected.email ?? ""} required />
                </div>
                <div className="space-y-1.5">
                  <Label>First Name</Label>
                  <Input name="first_name" defaultValue={selected.first_name ?? ""} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name</Label>
                  <Input name="last_name" defaultValue={selected.last_name ?? ""} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input name="phone" defaultValue={selected.phone ?? ""} />
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input name="address" defaultValue={selected.address ?? ""} />
                </div>
                <div className="space-y-1.5">
                  <Label>New Password (optional)</Label>
                  <Input name="password_str" type="password" placeholder="Leave blank to keep current" />
                </div>
                <div className="space-y-1.5">
                  <Label className="mr-3">Active</Label>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={!!selected.is_active_bool}
                      onCheckedChange={(v) =>
                        setSelected((s) => ({ ...s, is_active_bool: v }))
                      }
                    />
                    {/* hidden control to post value via FormData */}
                    <input
                      type="checkbox"
                      name="is_active_bool"
                      className="hidden"
                      checked={!!selected.is_active_bool}
                      readOnly
                    />
                    <span className="text-sm text-muted-foreground">
                      {selected.is_active_bool ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Update</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation (shadcn AlertDialog) */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete visitor?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.{" "}
              {confirmUser ? (
                <>This will permanently remove “{confirmUser.first_name || confirmUser.username || "this user"}”.</>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={doDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
