import nodemailer from 'nodemailer';
import https from 'https';

interface PenaltyEmailData {
  toEmail: string;
  fromEmail: string;
  awayMinutes: number;
  imagePath?: string;
  imageBase64?: string;
}

// Send the embarrassing email via nodemailer (Gmail app password)
async function sendViaNodemailer(data: PenaltyEmailData): Promise<void> {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const snarkyMessages = [
    `Your accountability partner just hit rock bottom — they disappeared for ${data.awayMinutes} minutes and triggered the blackmail clause.`,
    `Breaking news: ${data.fromEmail} has officially failed their focus session. Away for ${data.awayMinutes} minutes. The evidence is attached.`,
    `You're receiving this because your friend ${data.fromEmail} made a commitment and then immediately broke it.`,
  ];

  const msg = snarkyMessages[Math.floor(Math.random() * snarkyMessages.length)];

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"FiveMoreMins ☠️" <${process.env.GMAIL_USER}>`,
    to: data.toEmail,
    subject: `[FiveMoreMins] Your friend failed their focus session 💀`,
    html: `
      <div style="font-family: monospace; background: #0a0a0a; color: #ff3333; padding: 30px; border-radius: 8px;">
        <h1 style="color: #ff3333; font-size: 28px;">⚠️ BLACKMAIL DELIVERED ⚠️</h1>
        <p style="color: #ffffff; font-size: 16px;">${msg}</p>
        <hr style="border-color: #ff3333;" />
        <p style="color: #ff6b35;"><strong>Offender:</strong> ${data.fromEmail}</p>
        <p style="color: #ff6b35;"><strong>Time away:</strong> ${data.awayMinutes} minutes</p>
        <p style="color: #ff6b35;"><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
        <hr style="border-color: #ff3333;" />
        <p style="color: #00ff88; font-size: 12px;">
          This message was sent automatically by FiveMoreMins - the anti-procrastination app that fights dirty.<br>
          Your friend signed up and agreed to this consequence. They had one job.
        </p>
      </div>
    `,
  };

  // Attach the embarrassing image if we have it
  if (data.imagePath) {
    mailOptions.attachments = [
      {
        filename: 'evidence.jpg',
        path: data.imagePath,
      },
    ];
  } else if (data.imageBase64) {
    mailOptions.attachments = [
      {
        filename: 'evidence.jpg',
        content: data.imageBase64,
        encoding: 'base64',
      },
    ];
  }

  await transporter.sendMail(mailOptions);
}

// Send via EmailJS REST API (no SMTP needed, works from server side with private key)
async function sendViaEmailJS(data: PenaltyEmailData): Promise<void> {
  const payload = JSON.stringify({
    service_id: process.env.EMAILJS_SERVICE_ID,
    template_id: process.env.EMAILJS_TEMPLATE_ID,
    user_id: process.env.EMAILJS_PUBLIC_KEY,
    accessToken: process.env.EMAILJS_PRIVATE_KEY,
    template_params: {
      to_email: data.toEmail,
      from_email: data.fromEmail,
      away_minutes: data.awayMinutes,
      message: `Your accountability partner disappeared for ${data.awayMinutes} minutes and the blackmail clause was triggered. The embarrassing photo is attached (if they uploaded one).`,
      timestamp: new Date().toLocaleString(),
    },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.emailjs.com',
        path: '/api/v1.0/email/send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`EmailJS error ${res.statusCode}: ${body}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Main export - tries EmailJS first, falls back to nodemailer
export async function sendPenaltyEmail(data: PenaltyEmailData): Promise<void> {
  const method = process.env.EMAIL_METHOD;

  if (method === 'nodemailer' || process.env.GMAIL_USER) {
    console.log('📧 Sending penalty email via nodemailer...');
    await sendViaNodemailer(data);
  } else if (process.env.EMAILJS_SERVICE_ID) {
    console.log('📧 Sending penalty email via EmailJS...');
    await sendViaEmailJS(data);
  } else {
    // No email configured - log it and pretend it worked (dev mode)
    console.warn('⚠️ No email service configured. Would have sent to:', data.toEmail);
    console.warn('   Set up EmailJS or Gmail in .env to actually send emails');
  }
}
