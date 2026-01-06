import { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getUserRole, getCurrentUser } from "@/lib/auth";
import { UserRole } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RoomList from "@/components/rooms/RoomList";
import BookingCalendar from "@/components/rooms/BookingCalendar";
import BookingCalendarView from "@/components/rooms/BookingCalendarView";
import AdminApprovalView from "@/components/rooms/AdminApprovalView";
import MyBookings from "@/components/rooms/MyBookings";

const MeetingRooms = () => {
  const [role, setRole] = useState<UserRole>('staff');

  useEffect(() => {
    const loadRole = async () => {
      const user = await getCurrentUser();
      if (!user) return;
      const userRole = await getUserRole(user.id);
      setRole(userRole);
    };
    loadRole();
  }, []);

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6 animate-fade-in pb-20 md:pb-6">
        <div className="mb-2">
          <h2 className="text-4xl font-heading font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Meeting Rooms
          </h2>
          <p className="text-muted-foreground mt-2">Book and manage meeting rooms</p>
        </div>

        <Tabs defaultValue="schedule" className="w-full">
          <TabsList className="bg-secondary shadow-soft">
            <TabsTrigger value="schedule" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Schedule</TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Bookings</TabsTrigger>
            <TabsTrigger value="rooms" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Rooms</TabsTrigger>
            <TabsTrigger value="my-bookings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">My Bookings</TabsTrigger>
            {(role === 'admin' || role === 'leader') && (
              <TabsTrigger value="approvals" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Approvals</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="schedule" className="mt-6">
            <BookingCalendarView />
          </TabsContent>
          <TabsContent value="calendar" className="mt-6">
            <BookingCalendar role={role} />
          </TabsContent>
          <TabsContent value="rooms" className="mt-6">
            <RoomList role={role} />
          </TabsContent>
          <TabsContent value="my-bookings" className="mt-6">
            <MyBookings />
          </TabsContent>
          {(role === 'admin' || role === 'leader') && (
            <TabsContent value="approvals" className="mt-6">
              <AdminApprovalView />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default MeetingRooms;
