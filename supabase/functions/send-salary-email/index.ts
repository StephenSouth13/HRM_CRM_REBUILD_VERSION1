import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SalaryEmailRequest {
  type: "new_salary" | "salary_paid" | "salary_proposal" | "error_report";
  userId?: string;
  month?: string;
  netSalary?: number;
  proposalDetails?: string;
  errorDetails?: string;
  reporterEmail?: string;
  reporterName?: string;
}

const formatVND = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
};

const sendEmail = async (to: string[], subject: string, html: string) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "HR System <onboarding@resend.dev>",
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return res.json();
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      type, 
      userId, 
      month, 
      netSalary, 
      proposalDetails, 
      errorDetails,
      reporterEmail,
      reporterName 
    }: SalaryEmailRequest = await req.json();

    console.log(`Processing ${type} email request`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let emailTo: string[] = [];
    let emailSubject = "";
    let emailHtml = "";

    // Get user profile if userId provided
    let userProfile = null;
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", userId)
        .single();
      userProfile = profile;
    }

    // Get admin emails
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminIds = adminRoles?.map(r => r.user_id) || [];
    let adminEmails: string[] = [];
    
    if (adminIds.length > 0) {
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("email")
        .in("id", adminIds);
      adminEmails = adminProfiles?.map(p => p.email) || [];
    }

    switch (type) {
      case "new_salary":
        if (!userProfile?.email) {
          throw new Error("User email not found");
        }
        emailTo = [userProfile.email];
        emailSubject = `🎉 Bảng lương tháng ${month} đã được tạo`;
        emailHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">💰 Bảng Lương Mới</h1>
            </div>
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="font-size: 16px; color: #334155;">Xin chào <strong>${userProfile.first_name} ${userProfile.last_name}</strong>,</p>
              <p style="font-size: 16px; color: #334155;">Bảng lương tháng <strong>${month}</strong> của bạn đã được tạo.</p>
              <div style="background: white; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center; border: 2px solid #667eea;">
                <p style="margin: 0; color: #64748b; font-size: 14px;">Lương thực nhận</p>
                <p style="margin: 10px 0 0; color: #667eea; font-size: 32px; font-weight: bold;">${formatVND(netSalary || 0)}</p>
              </div>
              <p style="font-size: 14px; color: #64748b;">Vui lòng đăng nhập hệ thống để xem chi tiết.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
              <p style="font-size: 12px; color: #94a3b8; text-align: center;">Đây là email tự động, vui lòng không trả lời.</p>
            </div>
          </div>
        `;
        break;

      case "salary_paid":
        if (!userProfile?.email) {
          throw new Error("User email not found");
        }
        emailTo = [userProfile.email];
        emailSubject = `✅ Lương tháng ${month} đã được thanh toán`;
        emailHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">✅ Đã Thanh Toán</h1>
            </div>
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="font-size: 16px; color: #334155;">Xin chào <strong>${userProfile.first_name} ${userProfile.last_name}</strong>,</p>
              <p style="font-size: 16px; color: #334155;">Lương tháng <strong>${month}</strong> của bạn đã được xử lý thanh toán thành công! 🎉</p>
              <div style="background: white; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center; border: 2px solid #10b981;">
                <p style="margin: 0; color: #64748b; font-size: 14px;">Số tiền đã thanh toán</p>
                <p style="margin: 10px 0 0; color: #10b981; font-size: 32px; font-weight: bold;">${formatVND(netSalary || 0)}</p>
              </div>
              <p style="font-size: 14px; color: #64748b;">Vui lòng kiểm tra tài khoản ngân hàng của bạn.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
              <p style="font-size: 12px; color: #94a3b8; text-align: center;">Đây là email tự động, vui lòng không trả lời.</p>
            </div>
          </div>
        `;
        break;

      case "salary_proposal":
        if (adminEmails.length === 0) {
          throw new Error("No admin emails found");
        }
        emailTo = adminEmails;
        emailSubject = `📝 Kiến nghị lương thưởng từ ${reporterName}`;
        emailHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">📝 Kiến Nghị Lương Thưởng</h1>
            </div>
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none;">
              <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
                <p style="margin: 0; font-size: 14px; color: #64748b;">Người gửi</p>
                <p style="margin: 5px 0 0; font-size: 16px; color: #334155; font-weight: 500;">${reporterName}</p>
                <p style="margin: 0; font-size: 14px; color: #64748b;">${reporterEmail}</p>
              </div>
              <div style="background: white; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
                <p style="margin: 0 0 10px; font-size: 14px; color: #64748b; font-weight: 500;">Nội dung kiến nghị:</p>
                <p style="margin: 0; font-size: 16px; color: #334155; line-height: 1.6;">${proposalDetails}</p>
              </div>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
              <p style="font-size: 12px; color: #94a3b8; text-align: center;">Vui lòng đăng nhập hệ thống để xử lý kiến nghị này.</p>
            </div>
          </div>
        `;
        break;

      case "error_report":
        if (adminEmails.length === 0) {
          throw new Error("No admin emails found");
        }
        emailTo = adminEmails;
        emailSubject = `🚨 Báo lỗi hệ thống lương từ ${reporterName}`;
        emailHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🚨 Báo Lỗi Hệ Thống</h1>
            </div>
            <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px; border: 1px solid #e2e8f0; border-top: none;">
              <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ef4444;">
                <p style="margin: 0; font-size: 14px; color: #64748b;">Người báo lỗi</p>
                <p style="margin: 5px 0 0; font-size: 16px; color: #334155; font-weight: 500;">${reporterName}</p>
                <p style="margin: 0; font-size: 14px; color: #64748b;">${reporterEmail}</p>
              </div>
              <div style="background: #fef2f2; padding: 20px; border-radius: 12px; border: 1px solid #fecaca;">
                <p style="margin: 0 0 10px; font-size: 14px; color: #991b1b; font-weight: 500;">Mô tả lỗi:</p>
                <p style="margin: 0; font-size: 16px; color: #7f1d1d; line-height: 1.6;">${errorDetails}</p>
              </div>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
              <p style="font-size: 12px; color: #94a3b8; text-align: center;">Vui lòng kiểm tra và xử lý lỗi này sớm nhất có thể.</p>
            </div>
          </div>
        `;
        break;

      default:
        throw new Error("Invalid email type");
    }

    console.log(`Sending ${type} email to:`, emailTo);

    const emailResponse = await sendEmail(emailTo, emailSubject, emailHtml);

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-salary-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
