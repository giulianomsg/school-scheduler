import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Save } from "lucide-react";
import SchoolUnitCombobox from "@/components/SchoolUnitCombobox";

export default function ProfilePage() {
  const { user, profile } = useAuth();
  const [name, setName] = useState("");
  const [cargo, setCargo] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [schoolUnitId, setSchoolUnitId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setCargo(profile.cargo || "");
      setWhatsapp(profile.whatsapp || "");
      setSchoolUnitId(profile.school_unit_id || "");
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        name,
        cargo: cargo || null,
        whatsapp: whatsapp || null,
        school_unit_id: schoolUnitId || null,
      })
      .eq("id", user.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado com sucesso" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
        <p className="text-muted-foreground">Atualize suas informações pessoais</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Informações Pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={profile?.email || ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Cargo</Label>
            <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Diretor(a), Coordenador(a)" />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(XX) XXXXX-XXXX" />
          </div>
          {profile?.role === "school" && (
            <div className="space-y-2">
              <Label>Unidade Escolar</Label>
              <SchoolUnitCombobox value={schoolUnitId} onChange={setSchoolUnitId} />
            </div>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
