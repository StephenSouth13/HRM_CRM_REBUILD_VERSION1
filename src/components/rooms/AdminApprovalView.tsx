import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, Check, X } from "lucide-react";
import { format } from "date-fns";
import { getConflictingBookings, formatTimeRange } from "@/lib/booking-utils";
import { useToast } from "@/hooks/use-toast";

interface PendingBooking {
  id: string;
  title: string;
  room_id: string;
  room_name?: string;
  start_time: string;
  end_time: string;
  user_id: string;
  user_name?: string;
  description?: string;
}

interface ConflictingBooking {
  id: string;
  title: string;
  room_name: string;
  start_time: string;
  end_time: string;
  user_name: string;
}

const AdminApprovalView = () => {
  const [bookings, setBookings] = useState<PendingBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<PendingBooking | null>(null);
  const [conflicts, setConflicts] = useState<ConflictingBooking[]>([]);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [processingBookingId, setProcessingBookingId] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingBookings();

    const channel = supabase
      .channel("pending-bookings-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_bookings" },
        () => {
          fetchPendingBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPendingBookings = async () => {
    try {
      setLoading(true);
      
      // First fetch bookings with room info
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("room_bookings")
        .select(`
          id,
          title,
          description,
          room_id,
          start_time,
          end_time,
          user_id,
          status,
          meeting_rooms!room_bookings_room_id_fkey(name, capacity)
        `)
        .eq("status", "pending")
        .order("start_time");

      if (bookingsError) throw bookingsError;
      
      if (bookingsData && bookingsData.length > 0) {
        // Fetch user profiles separately
        const uniqueUserIds = [...new Set(bookingsData.map(b => b.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", uniqueUserIds);

        const profilesMap = new Map();
        profilesData?.forEach(p => {
          profilesMap.set(p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown User');
        });

        const formattedBookings = bookingsData.map((booking: any) => ({
          id: booking.id,
          title: booking.title,
          description: booking.description,
          room_id: booking.room_id,
          room_name: booking.meeting_rooms?.name || 'Unknown Room',
          start_time: booking.start_time,
          end_time: booking.end_time,
          user_id: booking.user_id,
          user_name: profilesMap.get(booking.user_id) || 'Unknown User',
        }));
        setBookings(formattedBookings);
      } else {
        setBookings([]);
      }
    } catch (error) {
      console.error("Error fetching pending bookings:", error);
      toast({
        title: "Error",
        description: "Failed to load pending bookings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveClick = async (booking: PendingBooking) => {
    setSelectedBooking(booking);
    
    try {
      const conflictingBookings = await getConflictingBookings(
        booking.room_id,
        booking.start_time,
        booking.end_time,
        booking.id
      );
      
      setConflicts(conflictingBookings);
      setApprovalDialogOpen(true);
    } catch (error) {
      console.error("Error checking conflicts:", error);
      toast({
        title: "Error",
        description: "Failed to check for conflicts",
        variant: "destructive",
      });
    }
  };

  const handleApprove = async () => {
    if (!selectedBooking) return;

    setProcessingBookingId(selectedBooking.id);
    try {
      const { error } = await supabase
        .from("room_bookings")
        .update({ status: "approved" })
        .eq("id", selectedBooking.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Booking "${selectedBooking.title}" has been approved`,
      });

      setApprovalDialogOpen(false);
      setSelectedBooking(null);
      setConflicts([]);
      fetchPendingBookings();
    } catch (error: any) {
      const errorMessage = error?.message || "Failed to approve booking";
      console.error("Error approving booking:", errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setProcessingBookingId("");
    }
  };

  const handleReject = async (bookingId: string) => {
    setProcessingBookingId(bookingId);
    try {
      const { error } = await supabase
        .from("room_bookings")
        .update({ status: "rejected" })
        .eq("id", bookingId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Booking has been rejected",
      });

      fetchPendingBookings();
    } catch (error: any) {
      const errorMessage = error?.message || "Failed to reject booking";
      console.error("Error rejecting booking:", errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setProcessingBookingId("");
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading pending bookings...</div>;
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No pending bookings to review
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {bookings.map((booking) => (
          <Card key={booking.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{booking.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Requested by: {booking.user_name}
                  </p>
                </div>
                <Badge variant="secondary">Pending</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Room: </span>
                  <span className="font-medium">{booking.room_name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Date: </span>
                  <span className="font-medium">
                    {format(new Date(booking.start_time), "MMM dd, yyyy")}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Time: </span>
                  <span className="font-medium">
                    {formatTimeRange(booking.start_time, booking.end_time)}
                  </span>
                </div>
              </div>

              {booking.description && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Description:</p>
                  <p className="text-sm bg-secondary/50 p-2 rounded">
                    {booking.description}
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleApproveClick(booking)}
                  disabled={processingBookingId === booking.id}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  onClick={() => handleReject(booking.id)}
                  disabled={processingBookingId === booking.id}
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Approval</DialogTitle>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold">{selectedBooking.title}</h4>
                <p className="text-sm text-muted-foreground">
                  {formatTimeRange(selectedBooking.start_time, selectedBooking.end_time)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedBooking.room_name}
                </p>
              </div>

              {conflicts.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong className="block mb-2">Conflicting Bookings Found!</strong>
                    <div className="text-xs space-y-2">
                      {conflicts.map((conflict) => (
                        <div key={conflict.id} className="border-t pt-2">
                          <div className="font-medium">{conflict.title}</div>
                          <div>{formatTimeRange(conflict.start_time, conflict.end_time)}</div>
                          <div>{conflict.room_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {conflict.user_name}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3">
                      Approving this booking will violate the no-overlapping constraint. 
                      The database will reject this operation.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {conflicts.length === 0 && (
                <div className="bg-green-50 dark:bg-green-950 p-3 rounded border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-900 dark:text-green-100">
                    ✓ No conflicts detected. Safe to approve.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApprovalDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={processingBookingId !== "" || conflicts.length > 0}
            >
              {processingBookingId ? "Processing..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminApprovalView;
