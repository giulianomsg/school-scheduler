import { useAuth } from "@/contexts/AuthContext";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import DepartmentDashboard from "@/pages/department/DepartmentDashboard";
import CoordinatorDashboard from "@/pages/coordinator/CoordinatorDashboard";
import SchoolDashboard from "@/pages/school/SchoolDashboard";

const Index = () => {
  const { profile } = useAuth();

  if (profile?.role === "admin") return <AdminDashboard />;
  if (profile?.role === "coordinator") return <CoordinatorDashboard />;
  if (profile?.role === "department") return <DepartmentDashboard />;
  return <SchoolDashboard />;
};

export default Index;
