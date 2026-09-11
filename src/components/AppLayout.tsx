import { ReactNode, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  School,
  Users,
  Clock,
  Menu,
  X,
  User,
  Building2,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import NotificationsPopover from "@/components/NotificationsPopover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  coordinator: "Coordenador de Setores",
  department: "Chefe de Setor",
  school: "Diretor Escolar",
};

const roleColors: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive",
  coordinator: "bg-amber-100 text-amber-900 border-amber-200",
  department: "bg-secondary/20 text-secondary-foreground",
  school: "bg-success/10 text-success",
};

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Persistence for sidebar minification state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
      } catch (e) {
        console.error("Erro ao salvar no localStorage", e);
      }
      return next;
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const navItems = getNavItems(profile?.role);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen bg-background">
        {/* Desktop Sidebar */}
        <aside
          className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out z-40 ${
            isCollapsed ? "lg:w-20" : "lg:w-64"
          }`}
        >
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {/* Header / Logo */}
            <div className={`flex items-center border-b border-sidebar-border py-4 transition-all duration-300 ${
              isCollapsed ? "justify-center px-2" : "justify-between px-4"
            }`}>
              {!isCollapsed ? (
                <div className="flex items-center gap-2.5 truncate">
                  <img
                    src="https://www.riopreto.sp.leg.br/Content/css/images/logo-1.png"
                    alt="Logo SME Rio Preto"
                    className="h-8 w-auto object-contain shrink-0"
                  />
                  <div className="truncate">
                    <p className="text-sm font-semibold text-sidebar-foreground truncate">Agenda SME</p>
                    <p className="text-[11px] text-sidebar-foreground/60 truncate">Sec. de Educação</p>
                  </div>
                </div>
              ) : (
                <Link to="/" title="Agenda SME">
                  <img
                    src="https://www.riopreto.sp.leg.br/Content/css/images/logo-1.png"
                    alt="Logo SME Rio Preto"
                    className="h-7 w-auto object-contain shrink-0"
                  />
                </Link>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 shrink-0"
                title={isCollapsed ? "Expandir Menu" : "Recolher Menu"}
              >
                {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
            </div>

            {/* Navigation Items */}
            <nav className={`flex-1 py-4 space-y-1.5 ${isCollapsed ? "px-2" : "px-3"}`}>
              {navItems.map((item) => {
                const isActive = location.pathname === item.href;

                if (isCollapsed) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>
                        <Link
                          to={item.href}
                          className={`flex items-center justify-center rounded-lg p-2.5 text-sm font-medium transition-colors ${
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                          }`}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          <span className="sr-only">{item.label}</span>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="font-semibold text-xs">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

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
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Footer / User Profile & Actions */}
            <div className={`border-t border-sidebar-border p-3 transition-all duration-300 ${
              isCollapsed ? "flex flex-col items-center gap-3" : ""
            }`}>
              {!isCollapsed ? (
                <>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="truncate">
                      <p className="text-sm font-medium text-sidebar-foreground truncate">
                        {profile?.name || profile?.email}
                      </p>
                      <Badge variant="outline" className={`mt-1 text-[11px] border-0 ${roleColors[profile?.role || "school"]}`}>
                        {roleLabels[profile?.role || "school"]}
                      </Badge>
                    </div>
                    <NotificationsPopover />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 text-xs"
                    onClick={handleSignOut}
                  >
                    <LogOut className="mr-2 h-4 w-4 shrink-0" />
                    Sair
                  </Button>
                </>
              ) : (
                <>
                  <NotificationsPopover />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                        onClick={handleSignOut}
                      >
                        <LogOut className="h-5 w-5" />
                        <span className="sr-only">Sair</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-semibold text-xs">
                      Sair da Conta ({profile?.name || profile?.email})
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          </div>
        </aside>

        {/* Mobile Header */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <img
                src="https://www.riopreto.sp.leg.br/Content/css/images/logo-1.png"
                alt="Logo SME Rio Preto"
                className="h-8 w-auto object-contain"
              />
              <span className="text-sm font-semibold text-sidebar-foreground">Agenda SME</span>
            </div>
            <div className="flex items-center gap-1">
              <NotificationsPopover />
              <Button
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
          {mobileMenuOpen && (
            <div className="border-t border-sidebar-border px-3 py-2 pb-4 animate-in slide-in-from-top-2">
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
        <main
          className={`flex-1 pt-14 lg:pt-0 transition-all duration-300 ease-in-out ${
            isCollapsed ? "lg:ml-20" : "lg:ml-64"
          }`}
        >
          <div className="p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </TooltipProvider>
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
      { href: "/admin/calendar", label: "Calendário Global", icon: CalendarDays },
      { href: "/profile", label: "Meu Perfil", icon: User }
    );
  } else if (role === "department" || role === "coordinator") {
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
      { href: "/school/calendar", label: "Calendário da Escola", icon: Clock },
      { href: "/profile", label: "Meu Perfil", icon: User }
    );
  }

  return items;
}
