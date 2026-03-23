import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 w-full max-w-md px-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (profile) {
    const isProfileComplete = () => {
      if (!profile.name?.trim()) return false;
      if (profile.role === "school" && !profile.school_unit_id) return false;
      if (profile.role === "department" && !(profile as any).department_id) return false;
      return true;
    };

    const isFirstAccessRoute = location.pathname === "/first-access";

    if (!isProfileComplete() && !isFirstAccessRoute) {
      return <Navigate to="/first-access" replace />;
    }

    if (isProfileComplete() && isFirstAccessRoute) {
      return <Navigate to="/" replace />;
    }
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
