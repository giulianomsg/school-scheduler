import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import SetPassword from "@/pages/SetPassword";
import Index from "@/pages/Index";
import DepartmentsPage from "@/pages/admin/DepartmentsPage";
import UsersPage from "@/pages/admin/UsersPage";
import SchoolUnitsPage from "@/pages/admin/SchoolUnitsPage";
import ProfilePage from "@/pages/ProfilePage";
import TimeslotsPage from "@/pages/department/TimeslotsPage";
import CalendarPage from "@/pages/department/CalendarPage";
import BookAppointmentPage from "@/pages/school/BookAppointmentPage";
import MyAppointmentsPage from "@/pages/school/MyAppointmentsPage";
import SchoolCalendarPage from "@/pages/school/SchoolCalendarPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/set-password" element={<SetPassword />} />

            <Route path="/" element={<ProtectedRoute><AppLayout><Index /></AppLayout></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><AppLayout><ProfilePage /></AppLayout></ProtectedRoute>} />

            {/* Admin routes */}
            <Route path="/departments" element={<ProtectedRoute allowedRoles={["admin"]}><AppLayout><DepartmentsPage /></AppLayout></ProtectedRoute>} />
            <Route path="/school-units" element={<ProtectedRoute allowedRoles={["admin"]}><AppLayout><SchoolUnitsPage /></AppLayout></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute allowedRoles={["admin"]}><AppLayout><UsersPage /></AppLayout></ProtectedRoute>} />

            {/* Department routes */}
            <Route path="/timeslots" element={<ProtectedRoute allowedRoles={["department"]}><AppLayout><TimeslotsPage /></AppLayout></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute allowedRoles={["department"]}><AppLayout><CalendarPage /></AppLayout></ProtectedRoute>} />

            {/* School routes */}
            <Route path="/book" element={<ProtectedRoute allowedRoles={["school"]}><AppLayout><BookAppointmentPage /></AppLayout></ProtectedRoute>} />
            <Route path="/my-appointments" element={<ProtectedRoute allowedRoles={["school"]}><AppLayout><MyAppointmentsPage /></AppLayout></ProtectedRoute>} />
            <Route path="/school/calendar" element={<ProtectedRoute allowedRoles={["school"]}><AppLayout><SchoolCalendarPage /></AppLayout></ProtectedRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
