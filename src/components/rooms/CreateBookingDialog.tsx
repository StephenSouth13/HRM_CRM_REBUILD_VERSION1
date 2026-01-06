import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { checkBookingAvailability, ConflictingBooking, formatTimeRange } from "@/lib/booking-utils";
import { AlertTriangle } from "lucide-react";

interface CreateBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookingCreated: () => void;
}

const CreateBookingDialog = ({ open, onOpenChange, onBookingCreated }: CreateBookingDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [roomId, setRoomId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [conflictingBooking, setConflictingBooking] = useState<ConflictingBooking | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      resetForm();
      fetchRooms();
    }
  }, [open]);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('meeting_rooms')
        .select('id, name, capacity')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      if (data) setRooms(data);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast({
        title: "Error",
        description: "Failed to load rooms",
        variant: "destructive"
      });
    }
  };

  const checkAvailability = async (room: string, start: string, startT: string) => {
    if (!room || !start || !startT) {
      setConflictingBooking(null);
      return;
    }

    setCheckingAvailability(true);
    try {
      const startDateTime = `${start}T${startT}`;
      const endDateTime = `${endDate}T${endTime}`;

      if (!endDateTime || !endTime) {
        setConflictingBooking(null);
        setCheckingAvailability(false);
        return;
      }

      const conflict = await checkBookingAvailability(room, startDateTime, endDateTime);
      setConflictingBooking(conflict);
    } catch (error) {
      console.error('Error checking availability:', error);
    } finally {
      setCheckingAvailability(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      checkAvailability(roomId, startDate, startTime);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [roomId, startDate, startTime, endDate, endTime]);

  const validateForm = (): boolean => {
    setValidationError("");

    if (!title.trim()) {
      setValidationError("Meeting title is required");
      return false;
    }

    if (!roomId) {
      setValidationError("Please select a room");
      return false;
    }

    if (!startDate || !startTime) {
      setValidationError("Start date and time are required");
      return false;
    }

    if (!endDate || !endTime) {
      setValidationError("End date and time are required");
      return false;
    }

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);

    if (startDateTime >= endDateTime) {
      setValidationError("End time must be after start time");
      return false;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfSelectedDay = new Date(startDate);

    if (startOfSelectedDay < startOfToday) {
      setValidationError("Cannot book for past dates");
      return false;
    }

    if (startOfSelectedDay.getTime() === startOfToday.getTime() && startDateTime < now) {
      setValidationError("Cannot book for past times today");
      return false;
    }

    if (conflictingBooking) {
      setValidationError(`Room already booked: "${conflictingBooking.title}" from ${formatTimeRange(conflictingBooking.start_time, conflictingBooking.end_time)}`);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const user = await getCurrentUser();
      if (!user) throw new Error("Not authenticated");

      const startDateTime = `${startDate}T${startTime}:00`;
      const endDateTime = `${endDate}T${endTime}:00`;

      const { error } = await supabase.from('room_bookings').insert([{
        title: title.trim(),
        description: description.trim() || null,
        room_id: roomId,
        user_id: user.id,
        start_time: startDateTime,
        end_time: endDateTime,
        status: 'pending'
      }]);

      if (error) {
        const errorMsg = error?.message || 'Unknown error';
        const errorCode = error?.code || '';
        console.error('Booking error:', errorCode, errorMsg);

        if (errorMsg.includes('overlapping') || errorMsg.includes('conflict') || errorCode === '23P01') {
          toast({
            title: "Booking Conflict",
            description: "This room is already booked for the selected time. Please choose a different time or room.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Error",
            description: errorMsg || "Failed to create booking",
            variant: "destructive"
          });
        }
        return;
      }

      toast({
        title: "Success",
        description: "Room booked successfully"
      });

      onBookingCreated();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      const errorMessage = error?.message || error?.error_description || "Failed to create booking";
      console.error('Error creating booking:', errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setRoomId("");
    setStartDate("");
    setStartTime("");
    setEndDate("");
    setEndTime("");
    setValidationError("");
    setConflictingBooking(null);
  };

  const selectedRoom = rooms.find(r => r.id === roomId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Book Meeting Room</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {validationError && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {validationError}
            </div>
          )}

          {conflictingBooking && !validationError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Conflict Detected!</strong>
                <div className="mt-2 text-xs">
                  <div><strong>{conflictingBooking.title}</strong></div>
                  <div>{formatTimeRange(conflictingBooking.start_time, conflictingBooking.end_time)}</div>
                  <div>Booked by: {conflictingBooking.user_name}</div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="title">Meeting Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Team Meeting"
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="room">Room *</Label>
            <Select value={roomId} onValueChange={setRoomId} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Select a room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name} (Capacity: {room.capacity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <Label htmlFor="endTime">End Time *</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add meeting agenda or notes"
              rows={3}
              disabled={loading}
            />
          </div>

          {selectedRoom && (
            <div className="p-3 rounded-lg bg-secondary/50 text-sm">
              <p className="font-medium">{selectedRoom.name}</p>
              <p className="text-muted-foreground">Capacity: {selectedRoom.capacity} people</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Booking..." : "Book Room"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateBookingDialog;
