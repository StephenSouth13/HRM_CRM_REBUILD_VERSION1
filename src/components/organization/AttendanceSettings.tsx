import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AttendanceSettingsData {
  id?: string;
  check_in_time: string;
  check_out_time: string;
  default_work_hours: number;
  grace_period_minutes: number;
  allow_overnight_shift: boolean;
}

const AttendanceSettings = () => {
  const [officeLocation, setOfficeLocation] = useState({ lat: "", lng: "" });
  const [radius, setRadius] = useState("100");
  const [settings, setSettings] = useState<AttendanceSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    checkInTime: "08:00",
    checkOutTime: "17:00",
    defaultWorkHours: "8",
    gracePeriodMinutes: "15",
    allowOvernightShift: true
  });
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
    const savedSettings = localStorage.getItem('attendanceSettings');
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);
      setOfficeLocation(parsedSettings.officeLocation || { lat: "", lng: "" });
      setRadius(parsedSettings.radius || "100");
    }
  }, []);

  const loadSettings = async () => {
    try {
      // Use type assertion to bypass missing table type
      const { data, error } = await (supabase as any)
        .from('attendance_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        const typedData = data as AttendanceSettingsData;
        setSettings(typedData);
        setFormData({
          checkInTime: typedData.check_in_time || "08:00",
          checkOutTime: typedData.check_out_time || "17:00",
          defaultWorkHours: typedData.default_work_hours?.toString() || "8",
          gracePeriodMinutes: typedData.grace_period_minutes?.toString() || "15",
          allowOvernightShift: typedData.allow_overnight_shift !== false
        });
      }
    } catch (error) {
      console.error('Error loading attendance settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setOfficeLocation({
            lat: position.coords.latitude.toString(),
            lng: position.coords.longitude.toString()
          });
          toast({
            title: "Location captured",
            description: "Current location set as office location"
          });
        },
        (error) => {
          toast({
            title: "Error",
            description: "Failed to get current location",
            variant: "destructive"
          });
        }
      );
    } else {
      toast({
        title: "Error",
        description: "Geolocation is not supported by this browser",
        variant: "destructive"
      });
    }
  };

  const handleSaveLocationSettings = () => {
    const locationSettings = {
      officeLocation,
      radius
    };
    localStorage.setItem('attendanceSettings', JSON.stringify(locationSettings));
    toast({
      title: "Success",
      description: "Location settings saved"
    });
  };

  const handleSaveWorkHoursSettings = async () => {
    try {
      const settingsData = {
        check_in_time: formData.checkInTime,
        check_out_time: formData.checkOutTime,
        default_work_hours: parseFloat(formData.defaultWorkHours),
        grace_period_minutes: parseInt(formData.gracePeriodMinutes),
        allow_overnight_shift: formData.allowOvernightShift
      };

      if (!settings) {
        // Use type assertion to bypass missing table type
        const { error } = await (supabase as any)
          .from('attendance_settings')
          .insert([settingsData]);

        if (error) throw error;
      } else {
        // Use type assertion to bypass missing table type
        const { error } = await (supabase as any)
          .from('attendance_settings')
          .update({
            ...settingsData,
            updated_at: new Date().toISOString()
          })
          .eq('id', settings.id);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Work hours settings saved successfully"
      });

      loadSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading attendance settings...</div>;
  }

  return (
    <Tabs defaultValue="work-hours" className="w-full">
      <TabsList className="bg-secondary shadow-soft grid w-full grid-cols-2">
        <TabsTrigger value="work-hours" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          Work Hours
        </TabsTrigger>
        <TabsTrigger value="location" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          Location Settings
        </TabsTrigger>
      </TabsList>

      <TabsContent value="work-hours" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Work Hours Configuration
            </CardTitle>
            <CardDescription>
              Set default work hours, check-in/check-out times, and overtime rules
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="checkInTime">Check-in Time</Label>
                <Input
                  id="checkInTime"
                  type="time"
                  value={formData.checkInTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, checkInTime: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">Expected time employees should check in</p>
              </div>

              <div>
                <Label htmlFor="checkOutTime">Check-out Time</Label>
                <Input
                  id="checkOutTime"
                  type="time"
                  value={formData.checkOutTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, checkOutTime: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">Expected time employees should check out</p>
              </div>
            </div>

            <div>
              <Label htmlFor="defaultWorkHours">Default Daily Work Hours</Label>
              <Input
                id="defaultWorkHours"
                type="number"
                min="1"
                max="24"
                step="0.5"
                value={formData.defaultWorkHours}
                onChange={(e) => setFormData(prev => ({ ...prev, defaultWorkHours: e.target.value }))}
                placeholder="8"
              />
              <p className="text-xs text-muted-foreground mt-1">Standard working hours per day (e.g., 8 hours)</p>
            </div>

            <div>
              <Label htmlFor="gracePeriod">Grace Period (minutes)</Label>
              <Input
                id="gracePeriod"
                type="number"
                min="0"
                max="120"
                value={formData.gracePeriodMinutes}
                onChange={(e) => setFormData(prev => ({ ...prev, gracePeriodMinutes: e.target.value }))}
                placeholder="15"
              />
              <p className="text-xs text-muted-foreground mt-1">Number of minutes allowed before late (e.g., 15 minutes grace period)</p>
            </div>

            <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/50">
              <div className="flex-1">
                <Label htmlFor="overnightShift" className="cursor-pointer">
                  <span className="font-medium">Allow Overnight Shifts</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Allow check-in on one day and check-out on the next day (e.g., 10 PM to 6 AM)
                  </p>
                </Label>
              </div>
              <input
                id="overnightShift"
                type="checkbox"
                checked={formData.allowOvernightShift}
                onChange={(e) => setFormData(prev => ({ ...prev, allowOvernightShift: e.target.checked }))}
                className="w-5 h-5"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => loadSettings()}>
                Cancel
              </Button>
              <Button onClick={handleSaveWorkHoursSettings}>
                Save Work Hours Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="location" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Attendance Location Settings
            </CardTitle>
            <CardDescription>
              Configure office location and check-in radius for attendance validation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="lat">Latitude</Label>
                  <Input
                    id="lat"
                    type="number"
                    step="any"
                    value={officeLocation.lat}
                    onChange={(e) => setOfficeLocation({ ...officeLocation, lat: e.target.value })}
                    placeholder="e.g., 21.028511"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="lng">Longitude</Label>
                  <Input
                    id="lng"
                    type="number"
                    step="any"
                    value={officeLocation.lng}
                    onChange={(e) => setOfficeLocation({ ...officeLocation, lng: e.target.value })}
                    placeholder="e.g., 105.804817"
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleGetCurrentLocation}
                className="w-full"
              >
                <MapPin className="h-4 w-4 mr-2" />
                Use Current Location
              </Button>

              <div>
                <Label htmlFor="radius">Check-in Radius (meters)</Label>
                <Input
                  id="radius"
                  type="number"
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  placeholder="100"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Employees must be within this radius to check in/out
                </p>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => {
                  const savedSettings = localStorage.getItem('attendanceSettings');
                  if (savedSettings) {
                    const settings = JSON.parse(savedSettings);
                    setOfficeLocation(settings.officeLocation || { lat: "", lng: "" });
                    setRadius(settings.radius || "100");
                  }
                }}>
                  Cancel
                </Button>
                <Button onClick={handleSaveLocationSettings} className="w-full">
                  Save Location Settings
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default AttendanceSettings;