import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Room {
  id: string;
  name: string;
  location: string | null;
  capacity: number;
  equipment: string[] | null;
}

interface EditRoomDialogProps {
  room: Room | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRoomUpdated: () => void;
}

const EditRoomDialog = ({ room, open, onOpenChange, onRoomUpdated }: EditRoomDialogProps) => {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("1");
  const [equipment, setEquipment] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (room && open) {
      setName(room.name);
      setLocation(room.location || "");
      setCapacity(String(room.capacity));
      setEquipment(room.equipment?.join(", ") || "");
    }
  }, [room, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room) return;
    
    setLoading(true);

    try {
      const equipmentArray = equipment.split(',').map(e => e.trim()).filter(Boolean);

      const { error } = await supabase
        .from('meeting_rooms')
        .update({
          name,
          location: location || null,
          capacity: parseInt(capacity),
          equipment: equipmentArray.length > 0 ? equipmentArray : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', room.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Room updated successfully"
      });

      onRoomUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating room:', error);
      toast({
        title: "Error",
        description: "Failed to update room",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Room</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="edit-name">Room Name *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="edit-location">Location</Label>
            <Input
              id="edit-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Floor 2, Building A"
            />
          </div>

          <div>
            <Label htmlFor="edit-capacity">Capacity *</Label>
            <Input
              id="edit-capacity"
              type="number"
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="edit-equipment">Equipment (comma-separated)</Label>
            <Input
              id="edit-equipment"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder="e.g., Projector, Whiteboard, TV"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditRoomDialog;
