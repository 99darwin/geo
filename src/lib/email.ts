import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  react: React.ReactElement;
}): Promise<{ id: string }> {
  const fromAddress =
    process.env.EMAIL_FROM || "GEO Reports <reports@yourdomain.com>";

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
