import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vmqrwjlqivaabuwktcol.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtcXJ3amxxaXZhYWJ1d2t0Y29sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyMzY0MjEsImV4cCI6MjA2MzgxMjQyMX0.X2d7twgh-sVQbEGeBCCLMjkeG1zDXlA4GkveuxabDMw'
export const supabase = createClient(supabaseUrl, supabaseKey)