import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Lock, Mail } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check if there is an error in URL hash (returned by Supabase OAuth on failure)
    const hashParams = new URLSearchParams(location.hash.substring(1));
    const errorDescription = hashParams.get("error_description");

    if (errorDescription) {
      const decodedError = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
      const userMessage = decodedError.includes("Acesso negado")
        ? "Acesso negado: Apenas usuários previamente convidados pelo administrador podem acessar o sistema."
        : decodedError;

      toast({
        title: "Falha na autenticação",
        description: userMessage,
        variant: "destructive",
      });

      // Clean up the URL
      navigate("/login", { replace: true });
    }
  }, [location, navigate]);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Erro ao conectar com Google",
        description: error.message,
        variant: "destructive",
      });
      setIsGoogleLoading(false);
    }
  };

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
              <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
                {isLoading ? "Entrando..." : "Entrar com e-mail"}
              </Button>
            </form>

            <div className="mt-4 flex items-center justify-between">
              <span className="w-1/5 border-b lg:w-1/4"></span>
              <span className="text-xs text-center text-muted-foreground uppercase">
                ou
              </span>
              <span className="w-1/5 border-b lg:w-1/4"></span>
            </div>

            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full"
              onClick={handleGoogleLogin}
              disabled={isLoading || isGoogleLoading}
            >
              {isGoogleLoading ? (
                "Conectando..."
              ) : (
                <>
                  <svg
                    className="mr-2 h-4 w-4"
                    aria-hidden="true"
                    focusable="false"
                    data-prefix="fab"
                    data-icon="google"
                    role="img"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 488 512"
                  >
                    <path
                      fill="currentColor"
                      d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
                    ></path>
                  </svg>
                  Continuar com Google
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
