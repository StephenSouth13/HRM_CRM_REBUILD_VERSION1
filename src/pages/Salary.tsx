import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import MySalary from "@/components/salary/MySalary";
import { getUserRole, getCurrentUser } from "@/lib/auth";
import { UserRole } from "@/lib/auth";

const Salary = () => {
  const [role, setRole] = useState<UserRole>('staff');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRole = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) return;
        const userRole = await getUserRole(user.id);
        setRole(userRole);
      } finally {
        setLoading(false);
      }
    };
    loadRole();
  }, []);

  if (loading) {
    return (
      <DashboardLayout role={role}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={role}>
      <div className="animate-fade-in pb-20 md:pb-6">
        <MySalary />
      </div>
    </DashboardLayout>
  );
};

export default Salary;
