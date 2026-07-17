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
    const detail = err instanceof Error ? err.message : 'Unknown error'
    console.error('send-report failed:', detail)

    // Gmail rejects bad credentials with "535-5.7.8 Username and Password not
    // accepted", which tells the user nothing. The usual cause is an app
    // password pasted with the spaces Google displays it with.
    const looksLikeAuth = /535|Invalid login|Username and Password not accepted|BadCredentials/i.test(detail)
    const friendly = looksLikeAuth
      ? 'Gmail rejected the login. Check GMAIL_APP_PASSWORD — it must be the 16-character app password with no spaces, and GMAIL_USER must be the account it was created on.'
      : `Email failed: ${detail}`

    return NextResponse.json({ error: friendly, detail }, { status: 500 })
  }
}
