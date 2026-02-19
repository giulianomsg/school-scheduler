import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Building2,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  School,
  Users,
  Clock,
  Menu,
  X,
  User,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  department: "Chefe de Setor",
  school: "Diretor Escolar",
};

const roleColors: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive",
  department: "bg-secondary/20 text-secondary-foreground",
  school: "bg-success/10 text-success",
};

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const navItems = getNavItems(profile?.role);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border">
        <div className="flex flex-col flex-1 overflow-y-auto">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
              <Building2 className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-sidebar-foreground">Agenda SME</p>
              <p className="text-xs text-sidebar-foreground/60">Sec. de Educação</p>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border p-4">
            <div className="mb-3">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile?.name || profile?.email}
              </p>
              <Badge variant="outline" className={`mt-1 text-xs border-0 ${roleColors[profile?.role || "school"]}`}>
                {roleLabels[profile?.role || "school"]}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <Building2 className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
            <span className="text-sm font-semibold text-sidebar-foreground">Agenda SME</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-sidebar-border px-3 py-2 pb-4">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 justify-start text-sidebar-foreground/70"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0">
        <div className="p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

function getNavItems(role?: string) {
  const items = [];

  if (role === "admin") {
    items.push(
      { href: "/", label: "Painel", icon: LayoutDashboard },
      { href: "/departments", label: "Setores", icon: Building2 },
      { href: "/school-units", label: "Unidades Escolares", icon: School },
      { href: "/users", label: "Usuários", icon: Users },
      { href: "/profile", label: "Meu Perfil", icon: User }
    );
  } else if (role === "department") {
    items.push(
      { href: "/", label: "Painel", icon: LayoutDashboard },
      { href: "/timeslots", label: "Horários", icon: Clock },
      { href: "/calendar", label: "Calendário", icon: CalendarDays },
      { href: "/profile", label: "Meu Perfil", icon: User }
    );
  } else {
    items.push(
      { href: "/", label: "Painel", icon: LayoutDashboard },
      { href: "/book", label: "Agendar", icon: CalendarDays },
      { href: "/my-appointments", label: "Meus Agendamentos", icon: School },
      { href: "/profile", label: "Meu Perfil", icon: User }
    );
  }

  return items;
}
