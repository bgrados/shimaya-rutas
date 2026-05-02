import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface PushPayload {
  user_id: string
  title: string
  body: string
}

const webpush = await import("https://esm.sh/webpush@0.14.2").then(m => m.default || m)

serve(async (req) => {
  try {
    const { user_id, title, body }: PushPayload = await req.json()

    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', user_id)

    if (error) throw error

    const notifications = subscriptions?.map(async (sub) => {
      try {
        await webpush.sendNotification(
          JSON.parse(sub.subscription as unknown as string),
          JSON.stringify({ title, body })
        )
      } catch (e) {
        console.error('Push error:', e)
        if (e.statusCode === 410 || e.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('user_id', user_id)
        }
      }
    })

    await Promise.all(notifications || [])

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})
