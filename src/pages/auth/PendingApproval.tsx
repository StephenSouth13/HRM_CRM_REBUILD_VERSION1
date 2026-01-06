import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, checkUserApprovalStatus, signOut } from "@/lib/auth";
import { Leaf, Clock, XCircle, LogOut, RefreshCw } from "lucide-react";

const PendingApproval = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isRejected, setIsRejected] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | undefined>();

  const checkStatus = async () => {
    setIsLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) {
        navigate("/auth/login");
        return;
      }

      const status = await checkUserApprovalStatus(user.id);
      
      if (status.is_approved) {
        navigate("/dashboard");
        return;
      }

      if (status.approval_rejected) {
        setIsRejected(true);
        setRejectionReason(status.rejection_reason);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-secondary p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-medium">
              <Leaf className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-heading font-bold">Vine HRM</h1>
          </div>
        </div>

        <Card className="shadow-strong">
          <CardHeader className="text-center">
            {isRejected ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-destructive" />
                </div>
                <CardTitle className="text-destructive">Tài khoản bị từ chối</CardTitle>
                <CardDescription>
                  Yêu cầu tạo tài khoản của bạn đã bị từ chối bởi quản trị viên.
                </CardDescription>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
                  <Clock className="w-8 h-8 text-warning" />
                </div>
                <CardTitle>Đang chờ phê duyệt</CardTitle>
                <CardDescription>
                  Tài khoản của bạn đang chờ được quản trị viên phê duyệt. 
                  Vui lòng quay lại sau.
                </CardDescription>
              </div>
            )}
          </CardHeader>

          <CardContent>
            {isRejected && rejectionReason && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm font-medium text-destructive mb-1">Lý do từ chối:</p>
                <p className="text-sm text-muted-foreground">{rejectionReason}</p>
              </div>
            )}

            {!isRejected && (
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Bạn sẽ nhận được thông báo khi tài khoản được phê duyệt. 
                  Trong thời gian chờ đợi, bạn có thể liên hệ quản trị viên để được hỗ trợ.
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            {!isRejected && (
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={checkStatus}
                disabled={isLoading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Kiểm tra lại trạng thái
              </Button>
            )}
            <Button 
              variant="ghost" 
              className="w-full" 
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Đăng xuất
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default PendingApproval;
