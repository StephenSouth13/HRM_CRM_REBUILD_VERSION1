import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from "lucide-react";
import {
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  format,
  isSameDay,
} from "date-fns";

interface Booking {
  id: string;
  title: string;
  room_id: string;
  room_name?: string;
  start_time: string;
  end_time: string;
  status: string;
  user_id: string;
  user_name?: string;
}

interface Room {
  id: string;
  name: string;
  capacity: number;
}

const BookingCalendarView = () => {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [view, setView] = useState<"week" | "day">("week");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const timeSlots = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

  useEffect(() => {
    fetchRooms();
    fetchBookings();
  }, [weekStart, selectedRoom]);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from("meeting_rooms")
        .select("id, name, capacity")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      if (data) setRooms(data);
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const weekEnd = addDays(weekStart, 6);
      const startISO = weekStart.toISOString();
      const endISO = addDays(weekEnd, 1).toISOString();

      // First fetch bookings
      let bookingsQuery = supabase
        .from("room_bookings")
        .select(`
          id,
          title,
          room_id,
          start_time,
          end_time,
          status,
          user_id,
          meeting_rooms!room_bookings_room_id_fkey(name, capacity)
        `)
        .eq("status", "approved")
        .gte("start_time", startISO)
        .lt("start_time", endISO);

      if (selectedRoom !== "all") {
        bookingsQuery = bookingsQuery.eq("room_id", selectedRoom);
      }

      const { data: bookingsData, error: bookingsError } = await bookingsQuery;

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
          room_id: booking.room_id,
          room_name: booking.meeting_rooms?.name || 'Unknown Room',
          start_time: booking.start_time,
          end_time: booking.end_time,
          status: booking.status,
          user_id: booking.user_id,
          user_name: profilesMap.get(booking.user_id) || 'Unknown User',
        }));
        setBookings(formattedBookings);
      } else {
        setBookings([]);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const getBookingForSlot = (roomId: string, date: Date, hour: number) => {
    const slotStart = new Date(date);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setHours(hour + 1, 0, 0, 0);

    return bookings.find(
      (booking) =>
        booking.room_id === roomId &&
        new Date(booking.start_time) < slotEnd &&
        new Date(booking.end_time) > slotStart
    );
  };

  const displayRooms =
    selectedRoom === "all" ? rooms : rooms.filter((r) => r.id === selectedRoom);

  const handlePrevWeek = () => setWeekStart(subWeeks(weekStart, 1));
  const handleNextWeek = () => setWeekStart(addWeeks(weekStart, 1));

  if (loading) {
    return <div className="text-muted-foreground">Loading calendar...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Room Booking Schedule
          </h3>
          <Select value={view} onValueChange={(v) => setView(v as "week" | "day")}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week View</SelectItem>
              <SelectItem value="day">Day View</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevWeek}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-40 text-center font-medium text-sm">
            {format(weekStart, "MMM dd")} - {format(addDays(weekStart, 6), "MMM dd, yyyy")}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextWeek}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <Select value={selectedRoom} onValueChange={setSelectedRoom}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select room" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rooms</SelectItem>
            {rooms.map((room) => (
              <SelectItem key={room.id} value={room.id}>
                {room.name} (Cap: {room.capacity})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {view === "week" ? (
        <div className="border rounded-lg overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-secondary">
                <th className="border p-2 w-20 font-semibold text-sm">Time</th>
                {weekDays.map((day) => (
                  <th
                    key={day.toISOString()}
                    className="border p-2 font-semibold text-sm min-w-[120px]"
                  >
                    <div>{format(day, "EEE")}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(day, "MMM dd")}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((time) => (
                <tr key={time}>
                  <td className="border p-2 bg-secondary/50 font-semibold text-xs">
                    {time}
                  </td>
                  {weekDays.map((day) => (
                    <td
                      key={`${day.toISOString()}-${time}`}
                      className="border p-1 min-h-[60px] align-top"
                    >
                      <div className="space-y-1">
                        {displayRooms.map((room) => {
                          const booking = getBookingForSlot(
                            room.id,
                            day,
                            parseInt(time.split(":")[0])
                          );
                          return (
                            <div key={room.id} className="text-xs">
                              {booking ? (
                                <div className="bg-primary/10 p-1 rounded border border-primary/30">
                                  <div className="font-semibold text-primary">
                                    {booking.title}
                                  </div>
                                  <div className="text-primary/70">
                                    {booking.room_name}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-muted-foreground text-xs py-1">
                                  {selectedRoom === "all" ? room.name : "Available"}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4">
          {weekDays.map((day) => (
            <Card key={day.toISOString()}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {format(day, "EEEE, MMMM dd, yyyy")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {displayRooms.length === 0 ? (
                    <p className="text-muted-foreground">No rooms selected</p>
                  ) : (
                    displayRooms.map((room) => {
                      const dayBookings = bookings.filter(
                        (b) =>
                          b.room_id === room.id &&
                          isSameDay(new Date(b.start_time), day)
                      );
                      return (
                        <div key={room.id} className="border rounded p-3">
                          <h4 className="font-semibold mb-2">{room.name}</h4>
                          {dayBookings.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No bookings
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {dayBookings.map((booking) => (
                                <div
                                  key={booking.id}
                                  className="bg-primary/5 p-2 rounded border border-primary/20"
                                >
                                  <div className="font-medium text-sm">
                                    {booking.title}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {format(new Date(booking.start_time), "HH:mm")} -{" "}
                                    {format(new Date(booking.end_time), "HH:mm")}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookingCalendarView;
