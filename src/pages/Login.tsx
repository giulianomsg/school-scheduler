import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Lock, Mail } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  // Intercepta erros de OAuth retornados na URL (ex: quando o signup de novos usuários está desativado no Supabase)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && (hash.includes("error_description=Signup+requires") || hash.includes("error=access_denied") || hash.includes("error_description=Email+link+is+invalid+or+has+expired"))) {
      let message = "Acesso Negado: Seu e-mail não está cadastrado no sistema. Por favor, solicite um convite ao administrador.";

      if (hash.includes("error_description=Email+link+is+invalid")) {
        message = "O link utilizado é inválido ou expirou. Tente novamente.";
      }

      toast({
        title: "Acesso Negado",
        description: message,
        variant: "destructive",
        duration: 8000
      });
      // Limpa a URL para não exibir o erro novamente ao recarregar a página
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signIn(email, password);
      navigate("/");
    } catch (error: any) {
      const msg = (error.message || "").toLowerCase();
      const isBanned = msg.includes("banned") || msg.includes("suspended") || msg.includes("ban");
      toast({
        title: isBanned ? "Conta Suspensa" : "Falha no login",
        description: isBanned
          ? "Seu acesso foi suspenso pelo administrador."
          : error.message || "Credenciais inválidas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast({
          title: "Erro ao entrar com Google",
          description: result.error.message || "Tente novamente.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao entrar com Google",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <img src="https://www.riopreto.sp.leg.br/Content/css/images/logo-1.png" alt="Logo SME Rio Preto" className="mx-auto mb-2 h-16 w-auto object-contain" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Secretaria Municipal de Educação
          </h1>
          <p className="mt-1 text-base text-muted-foreground">
            São José do Rio Preto - SP
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Sistema de Agendamento de Reuniões
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>
              Acesso somente por convite. Insira suas credenciais para continuar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="voce@exemplo.com"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <div className="relative my-4">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                ou
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full gap-3 bg-white text-[#3c4043] border border-[#dadce0] hover:bg-[#f8f9fa] hover:text-[#3c4043] shadow-sm font-medium h-10 rounded-md"
              disabled={isGoogleLoading}
              onClick={handleGoogleSignIn}
            >
              <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {isGoogleLoading ? "Conectando..." : "Entrar com o Google"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
