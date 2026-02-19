import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Department = Tables<"departments">;
type Profile = Tables<"profiles">;

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<(Department & { head?: Profile })[]>([]);
  const [departmentUsers, setDepartmentUsers] = useState<Profile[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [headId, setHeadId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: depts }, { data: users }] = await Promise.all([
      supabase.from("departments").select("*"),
      supabase.from("profiles").select("*").eq("role", "department"),
    ]);

    const enriched = (depts || []).map((d) => ({
      ...d,
      head: users?.find((u) => u.id === d.head_id),
    }));

    setDepartments(enriched);
    setDepartmentUsers(users || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    if (editingDept) {
      const { error } = await supabase
        .from("departments")
        .update({ name, head_id: headId || null })
        .eq("id", editingDept.id);
      if (error) { toast({ title: "Error updating", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Department updated" });
    } else {
      const { error } = await supabase
        .from("departments")
        .insert({ name, head_id: headId || null });
      if (error) { toast({ title: "Error creating", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Department created" });
    }

    setIsOpen(false);
    setEditingDept(null);
    setName("");
    setHeadId("");
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) { toast({ title: "Error deleting", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Department deleted" });
    fetchData();
  };

  const openEdit = (dept: Department) => {
    setEditingDept(dept);
    setName(dept.name);
    setHeadId(dept.head_id || "");
    setIsOpen(true);
  };

  const openCreate = () => {
    setEditingDept(null);
    setName("");
    setHeadId("");
    setIsOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Departments</h1>
          <p className="text-muted-foreground">Manage departments and their heads</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Add Department
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingDept ? "Edit Department" : "Create Department"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Department Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Human Resources" />
              </div>
              <div className="space-y-2">
                <Label>Department Head</Label>
                <Select value={headId} onValueChange={setHeadId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a head (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} className="w-full">
                {editingDept ? "Update" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : departments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No departments yet. Create one to get started.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Head</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.id}>
                    <TableCell className="font-medium">{dept.name}</TableCell>
                    <TableCell>{dept.head?.name || dept.head?.email || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(dept)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(dept.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
