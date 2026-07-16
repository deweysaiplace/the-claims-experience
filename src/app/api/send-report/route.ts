import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(request: NextRequest) {
  try {
    const { subject, body, claimRef } = await request.json() as {
      subject: string
      body: string
      claimRef?: string
    }

    const recipients = [
      process.env.REPORT_EMAIL_WORK,
      process.env.REPORT_EMAIL_PERSONAL,
    ].filter(Boolean).join(', ')

    // Name the missing piece explicitly. Without this, unset credentials surface
    // as an opaque nodemailer auth error that reads like a Gmail outage.
    const missing = [
      !process.env.GMAIL_USER && 'GMAIL_USER',
      !process.env.GMAIL_APP_PASSWORD && 'GMAIL_APP_PASSWORD',
      !recipients && 'REPORT_EMAIL_WORK or REPORT_EMAIL_PERSONAL',
    ].filter(Boolean)

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Email is not configured on this deployment. Missing: ${missing.join(', ')}` },
        { status: 500 }
      )
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })

    const emailSubject = subject || `Claims Experience Report${claimRef ? ` — ${claimRef}` : ''}`

    await transporter.sendMail({
      from: `"Claims Experience" <${process.env.GMAIL_USER}>`,
      to: recipients,
      subject: emailSubject,
      text: body,
      html: `<pre style="font-family: monospace; white-space: pre-wrap; font-size: 13px; line-height: 1.5;">${body.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`,
    })

    return NextResponse.json({ success: true, sentTo: recipients })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
