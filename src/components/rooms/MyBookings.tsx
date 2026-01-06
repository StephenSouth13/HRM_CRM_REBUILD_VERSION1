import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, isPast } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

interface Booking {
  id: string;
  title: string;
  room_id: string;
  start_time: string;
  end_time: string;
  status: string;
  description: string | null;
  meeting_rooms?: { name: string; capacity: number };
}

const MyBookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadBookings = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('room_bookings')
        .select(`
          *,
          meeting_rooms:room_id (name, capacity)
        `)
        .eq('user_id', user.id)
        .order('start_time', { ascending: false });

      if (error) throw error;
      setBookings((data || []) as Booking[]);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast({
        title: "Error",
        description: "Failed to load bookings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();

    const channel = supabase
      .channel('room-bookings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_bookings' }, () => {
        loadBookings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCancel = async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from('room_bookings')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Booking cancelled successfully"
      });

      setCancelingId(null);
      loadBookings();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast({
        title: "Error",
        description: "Failed to cancel booking",
        variant: "destructive"
      });
    }
  };

  const getUpcomingBookings = () => {
    return bookings.filter(b => !isPast(new Date(b.end_time)) && b.status !== 'cancelled');
  };

  const getPastBookings = () => {
    return bookings.filter(b => isPast(new Date(b.end_time)) || b.status === 'cancelled');
  };

  const BookingTable = ({ bookings, showActions = false }: { bookings: Booking[]; showActions?: boolean }) => (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Room</TableHead>
            <TableHead>Start Time</TableHead>
            <TableHead>End Time</TableHead>
            <TableHead>Status</TableHead>
            {showActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showActions ? 6 : 5} className="text-center text-muted-foreground py-8">
                No bookings found
              </TableCell>
            </TableRow>
          ) : (
            bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell className="font-medium">{booking.title}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{booking.meeting_rooms?.name || 'Unknown Room'}</p>
                    <p className="text-xs text-muted-foreground">Capacity: {booking.meeting_rooms?.capacity || 'N/A'}</p>
                  </div>
                </TableCell>
                <TableCell>{format(new Date(booking.start_time), 'MMM dd, yyyy HH:mm')}</TableCell>
                <TableCell>{format(new Date(booking.end_time), 'MMM dd, yyyy HH:mm')}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      booking.status === 'confirmed' ? 'default' :
                      booking.status === 'cancelled' ? 'destructive' : 'secondary'
                    }
                  >
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                  </Badge>
                </TableCell>
                {showActions && (
                  <TableCell className="text-right">
                    {booking.status !== 'cancelled' && !isPast(new Date(booking.end_time)) && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setCancelingId(booking.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  if (loading) {
    return <div className="text-muted-foreground">Loading your bookings...</div>;
  }

  const upcomingBookings = getUpcomingBookings();
  const pastBookings = getPastBookings();

  return (
    <div className="space-y-6">
      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="bg-secondary shadow-soft">
          <TabsTrigger value="upcoming" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Upcoming ({upcomingBookings.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            Past ({pastBookings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-6">
          <BookingTable bookings={upcomingBookings} showActions={true} />
        </TabsContent>

        <TabsContent value="past" className="mt-6">
          <BookingTable bookings={pastBookings} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!cancelingId} onOpenChange={(open) => !open && setCancelingId(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to cancel this room booking? This action cannot be undone.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelingId && handleCancel(cancelingId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancel Booking
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyBookings;
