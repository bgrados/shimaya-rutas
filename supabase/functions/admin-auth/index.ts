import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseServiceKey) {
      throw new Error('SERVICE_ROLE_KEY no está configurada')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { action, userId, email, password, nombre, rol, telefono, activo } = await req.json()

    // Acciones Administrativas (no requiere autenticación porque se usa la SERVICE_ROLE_KEY)
    if (action === 'create_user') {
      if (!email || !password) {
        throw new Error('Email y password son requeridos')
      }
      
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nombre: nombre || '',
          telefono: telefono || '',
          rol: rol || 'chofer',
        }
      })
      
      if (error) {
        console.error('[admin-auth] Error creating user:', error)
        throw error
      }
      
      console.log('[admin-auth] User created:', data.user?.id)
      return new Response(JSON.stringify({ 
        success: true, 
        userId: data.user?.id,
        data 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (action === 'update_user') {
      if (!userId) {
        throw new Error('userId es requerido')
      }
      
      const updateData: any = {}
      if (password) updateData.password = password
      
      const { data, error } = await supabase.auth.admin.updateUserById(userId, updateData)
      
      if (error) {
        console.error('[admin-auth] Error updating user:', error)
        throw error
      }
      
      console.log('[admin-auth] User updated:', userId)
      return new Response(JSON.stringify({ success: true, data }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (action === 'delete_user') {
      if (!userId) {
        throw new Error('userId es requerido')
      }
      
      const { data, error } = await supabase.auth.admin.deleteUser(userId)
      
      if (error) {
        console.error('[admin-auth] Error deleting user:', error)
        throw error
      }
      
      console.log('[admin-auth] User deleted:', userId)
      return new Response(JSON.stringify({ success: true, data }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    return new Response(JSON.stringify({ error: 'Acción no válida' }), { status: 400 })

  } catch (error) {
    console.error('[admin-auth] Error:', error)
    return new Response(JSON.stringify({ 
      error: error.message || 'Error desconocido',
      details: error
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
