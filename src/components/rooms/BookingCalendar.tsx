import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser, getUserRole } from "@/lib/auth";
import { UserRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import CreateBookingDialog from "./CreateBookingDialog";
import BookingDetailsDialog from "./BookingDetailsDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const BookingCalendar = ({ role }: { role: UserRole }) => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [creatorInfo, setCreatorInfo] = useState<Map<string, any>>(new Map());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('staff');

  const fetchBookings = async () => {
    try {
      const user = await getCurrentUser();
      if (user) {
        setCurrentUserId(user.id);
        const userRole = await getUserRole(user.id);
        setCurrentUserRole(userRole);
      }

      // Fetch bookings with room info
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('room_bookings')
        .select(`
          *,
          meeting_rooms!room_bookings_room_id_fkey(name, capacity)
        `)
        .gte('start_time', new Date().toISOString())
        .order('start_time');

      if (bookingsError) throw bookingsError;
      setBookings(bookingsData || []);

      if (bookingsData && bookingsData.length > 0) {
        const uniqueUserIds = [...new Set(bookingsData.map(b => b.user_id))];
        const { data: creatorData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, avatar_url')
          .in('id', uniqueUserIds);

        if (creatorData) {
          const creatorMap = new Map();
          creatorData.forEach(creator => {
            creatorMap.set(creator.id, creator);
          });
          setCreatorInfo(creatorMap);
        }
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();

    const channel = supabase
      .channel('bookings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_bookings' }, () => {
        fetchBookings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Check if current user can see attendees
  const canSeeAttendees = (booking: any) => {
    return currentUserRole === 'admin' || booking.user_id === currentUserId;
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading bookings...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Booking
        </Button>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No upcoming bookings
        </div>
      ) : (
        <div className="grid gap-4">
          {bookings.map((booking) => {
            const creator = creatorInfo.get(booking.user_id);
            const attendeeCount = (booking.attendees || []).length;
            const showAttendees = canSeeAttendees(booking);
            
            return (
              <Card
                key={booking.id}
                className="cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => {
                  setSelectedBooking(booking);
                  setDetailsDialogOpen(true);
                }}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{booking.title}</span>
                    <Badge
                      variant={
                        booking.status === 'approved' ? 'default' :
                        booking.status === 'rejected' ? 'destructive' : 'secondary'
                      }
                    >
                      {booking.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Room: </span>
                      <span className="font-medium">
                        {booking.meeting_rooms?.name || 'Unknown Room'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Start: </span>
                      <span className="font-medium">
                        {format(new Date(booking.start_time), 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">End: </span>
                      <span className="font-medium">
                        {format(new Date(booking.end_time), 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>
                  </div>

                  {booking.description && (
                    <p className="text-sm text-muted-foreground">{booking.description}</p>
                  )}

                  {creator && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={creator.avatar_url || ""} />
                        <AvatarFallback>
                          {`${creator.first_name?.[0] || ''}${creator.last_name?.[0] || ''}`.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-xs text-muted-foreground">
                        Organized by {creator.first_name} {creator.last_name}
                      </div>
                      {showAttendees && attendeeCount > 0 && (
                        <div className="text-xs text-muted-foreground ml-auto">
                          {attendeeCount} attendee{attendeeCount !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BookingDetailsDialog
        booking={selectedBooking}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        onJoinLeave={fetchBookings}
        canSeeAttendees={canSeeAttendees(selectedBooking)}
      />

      <CreateBookingDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onBookingCreated={fetchBookings}
      />
    </div>
  );
};

export default BookingCalendar;
