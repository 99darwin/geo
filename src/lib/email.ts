import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("[email] RESEND_API_KEY is not configured");
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  react: React.ReactElement;
}): Promise<{ id: string }> {
  const fromAddress = process.env.EMAIL_FROM;
  if (!fromAddress) {
    throw new Error("[email] EMAIL_FROM is not configured");
  }

  const { data, error } = await getResend().emails.send({
    from: fromAddress,
    to: params.to,
    subject: params.subject,
    react: params.react,
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }

  return { id: data?.id ?? "unknown" };
}
