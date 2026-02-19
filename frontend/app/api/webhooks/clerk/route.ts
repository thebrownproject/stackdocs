import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req)

    if (evt.type === 'user.created') {
      const { id, email_addresses, primary_email_address_id } = evt.data
      const email = email_addresses.find(
        (e: { id: string; email_address: string }) => e.id === primary_email_address_id
      )?.email_address

      // Validate email exists
      if (!email) {
        console.error('No email found for user:', id)
        return new Response('No email found', { status: 400 })
      }

      // Upsert for idempotency (handles duplicate webhook deliveries)
      const { error } = await supabase
        .from('users')
        .upsert({ id, email }, { onConflict: 'id' })

      if (error) {
        // Log but return 200 to prevent Clerk retries
        console.error('Database error on user.created:', error)
      }
    }

    if (evt.type === 'user.updated') {
      const { id, email_addresses, primary_email_address_id } = evt.data
      const email = email_addresses.find(
        (e: { id: string; email_address: string }) => e.id === primary_email_address_id
      )?.email_address

      // Only update if email exists
      if (email) {
        const { error } = await supabase
          .from('users')
          .update({ email })
          .eq('id', id)

        if (error) {
          console.error('Database error on user.updated:', error)
        }
      }
    }

    if (evt.type === 'user.deleted') {
      const { id } = evt.data

      if (!id) {
        console.error('No user ID in deletion event')
        return new Response('No user ID', { status: 400 })
      }

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Database error on user.deleted:', error)
      }
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('Webhook verification failed:', err)
    return new Response('Webhook verification failed', { status: 400 })
  }
}
