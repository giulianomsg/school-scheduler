import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import SchoolUnitCombobox from "@/components/SchoolUnitCombobox";
import DepartmentCombobox from "@/components/DepartmentCombobox";
import { Badge } from "@/components/ui/badge";

export default function FirstAccess() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState("");
  const [cargo, setCargo] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [phone, setPhone] = useState("");
  const [activities, setActivities] = useState("");
  const [schoolUnitId, setSchoolUnitId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setCargo(profile.cargo || "");
      setWhatsapp(profile.whatsapp || "");
      setPhone(profile.phone || "");
      setActivities(profile.activities || "");
      setSchoolUnitId(profile.school_unit_id || "");
      setDepartmentId((profile as any).department_id || "");
    }
  }, [profile]);

  const validate = () => {
    if (!name.trim()) return "O Nome completo é obrigatório.";
    if (profile?.role === "school" && !schoolUnitId) return "A Unidade Escolar é obrigatória.";
    if (profile?.role === "department" && !departmentId) return "O Setor/Departamento é obrigatório.";
    return null;
  };

  const handleSave = async () => {
    const errorMsg = validate();
    if (errorMsg) {
      toast({ title: "Preenchimento obrigatório", description: errorMsg, variant: "destructive" });
      return;
    }

    if (!user) return;
    setSaving(true);
    
    const updates: any = {
      name,
      cargo: cargo || null,
      whatsapp: whatsapp || null,
    };

    if (profile?.role === "school") updates.school_unit_id = schoolUnitId || null;
    if (profile?.role === "department" || profile?.role === "coordinator") {
      updates.phone = phone || null;
      updates.activities = activities || null;
      if (profile?.role === "department") {
        updates.department_id = departmentId || null;
      }
    }

    const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);

    if (error) {
      toast({ title: "Erro de conexão", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil configurado com sucesso!", description: "Bem-vindo ao sistema." });
      await refreshProfile();
      navigate("/");
    }
    setSaving(false);
  };

  if (!profile) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-xl animate-fade-in">
        <div className="mb-8 text-center">
          <img src="https://www.riopreto.sp.leg.br/Content/css/images/logo-1.png" alt="Logo SME Rio Preto" className="mx-auto mb-2 h-16 w-auto object-contain" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Bem-vindo!
          </h1>
          <p className="mt-1 text-base text-muted-foreground">
            Para continuar, complete as informações do seu perfil.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuração Inicial</CardTitle>
            <CardDescription>
              Por favor, preencha seus dados obrigatórios para acessar o sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={profile.email || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Nome Completo <span className="text-destructive">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" required />
            </div>
            
            {profile.role === "school" && (
              <div className="space-y-2">
                <Label>Unidade Escolar <span className="text-destructive">*</span></Label>
                <SchoolUnitCombobox value={schoolUnitId} onChange={setSchoolUnitId} />
              </div>
            )}
            
            {(profile.role === "department" || profile.role === "coordinator") && (
              <>
                {profile.role === "department" && (
                  <div className="space-y-2">
                    <Label>Setor/Departamento <span className="text-destructive">*</span></Label>
                    <DepartmentCombobox value={departmentId} onChange={setDepartmentId} />
                  </div>
                )}
                {profile.role === "coordinator" && (
                   <div className="space-y-2">
                      <Label>Setores Gerenciados</Label>
                      <div className="flex flex-wrap gap-1 p-2 bg-slate-50 border rounded-md min-h-[40px] items-center">
                        {profile.coordinatorDepts && profile.coordinatorDepts.length > 0 ? (
                          profile.coordinatorDepts.map(d => (
                            <Badge variant="secondary" key={d.id} className="mr-1 mb-1">{d.name}</Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">Nenhum setor atribuído ainda. Contate o administrador para providenciar acesso aos setores.</span>
                        )}
                      </div>
                   </div>
                )}

                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(XX) XXXXX-XXXX" />
                </div>
                <div className="space-y-2">
                  <Label className="mb-1">Minhas Atividades</Label>
                  <div className="bg-white rounded-md pb-4">
                    <ReactQuill
                      theme="snow"
                      value={activities}
                      onChange={setActivities}
                      placeholder="Descreva suas funções diárias..."
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex.: Diretor(a), Analista" />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(XX) XXXXX-XXXX" />
            </div>
            
            <Button onClick={handleSave} className="w-full mt-4" disabled={saving}>
              {saving ? "Salvando e Conectando..." : "Concluir e Entrar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
