import { supabase } from "@/integrations/supabase/client";

export interface ConflictingBooking {
  id: string;
  title: string;
  room_name: string;
  start_time: string;
  end_time: string;
  user_name: string;
}

/**
 * Check if a time slot is available for booking
 * Returns null if available, or an object with conflicting booking details if not
 */
export async function checkBookingAvailability(
  roomId: string,
  startTime: string,
  endTime: string,
  excludeBookingId?: string
): Promise<ConflictingBooking | null> {
  try {
    const startDateTime = new Date(startTime);
    const endDateTime = new Date(endTime);

    const { data, error } = await supabase
      .from("room_bookings")
      .select(
        `
        id,
        title,
        start_time,
        end_time,
        room_id,
        user_id,
        meeting_rooms!room_bookings_room_id_fkey(name)
      `
      )
      .eq("room_id", roomId)
      .eq("status", "approved")
      .lt("start_time", endDateTime.toISOString())
      .gt("end_time", startDateTime.toISOString());

    if (error) {
      console.error("Error checking availability:", error);
      return null;
    }

    if (data && data.length > 0) {
      const conflict = data[0] as any;
      
      // Fetch user profile separately
      let userName = "Unknown User";
      if (conflict.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", conflict.user_id)
          .maybeSingle();
        
        if (profile) {
          userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || "Unknown User";
        }
      }
      
      return {
        id: conflict.id,
        title: conflict.title,
        room_name: conflict.meeting_rooms?.name || "Unknown Room",
        start_time: conflict.start_time,
        end_time: conflict.end_time,
        user_name: userName,
      };
    }

    return null;
  } catch (error) {
    console.error("Error checking availability:", error);
    return null;
  }
}

/**
 * Check for conflicts when admin approves a booking
 * Returns all conflicting pending or approved bookings
 */
export async function getConflictingBookings(
  roomId: string,
  startTime: string,
  endTime: string,
  excludeBookingId: string
): Promise<ConflictingBooking[]> {
  try {
    const startDateTime = new Date(startTime);
    const endDateTime = new Date(endTime);

    const { data, error } = await supabase
      .from("room_bookings")
      .select(
        `
        id,
        title,
        start_time,
        end_time,
        room_id,
        user_id,
        status,
        meeting_rooms!room_bookings_room_id_fkey(name)
      `
      )
      .eq("room_id", roomId)
      .neq("id", excludeBookingId)
      .or(
        `status.eq.approved,status.eq.pending`
      )
      .lt("start_time", endDateTime.toISOString())
      .gt("end_time", startDateTime.toISOString());

    if (error) {
      console.error("Error checking conflicts:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Fetch user profiles separately
    const uniqueUserIds = [...new Set(data.map((b: any) => b.user_id).filter(Boolean))];
    const profilesMap = new Map<string, string>();
    
    if (uniqueUserIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", uniqueUserIds);
      
      profilesData?.forEach((p) => {
        profilesMap.set(p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim() || "Unknown User");
      });
    }

    return data.map((conflict: any) => ({
      id: conflict.id,
      title: conflict.title,
      room_name: conflict.meeting_rooms?.name || "Unknown Room",
      start_time: conflict.start_time,
      end_time: conflict.end_time,
      user_name: profilesMap.get(conflict.user_id) || "Unknown User",
    }));
  } catch (error) {
    console.error("Error checking conflicts:", error);
    return [];
  }
}

/**
 * Format time range for display
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const startStr = start.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const endStr = end.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${startStr} - ${endStr}`;
}
